import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { parseNumber } from '../utils/currency';

/**
 * Retrieves deliveries for a given date, including their associated items.
 */
export async function getDeliveriesByDate(date) {
  const db = await getDatabase();
  const deliveries = await db.getAllAsync(
    'SELECT * FROM deliveries WHERE date = ? ORDER BY rider COLLATE NOCASE ASC, created_at ASC',
    [date]
  );

  const deliveryIds = deliveries.map((d) => d.id);
  if (deliveryIds.length === 0) return [];

  const placeholders = deliveryIds.map(() => '?').join(',');
  const items = await db.getAllAsync(
    `SELECT * FROM delivery_items WHERE delivery_id IN (${placeholders}) ORDER BY created_at ASC`,
    deliveryIds
  );

  const itemMap = new Map();
  for (const item of items) {
    if (!itemMap.has(item.delivery_id)) {
      itemMap.set(item.delivery_id, []);
    }
    itemMap.get(item.delivery_id).push(item);
  }

  return deliveries.map((d) => ({
    ...d,
    items: itemMap.get(d.id) || [],
  }));
}

/**
 * Creates a new delivery and atomically deducts from both 'actual' and 'expected' stock.
 */
export async function createDelivery({ date, location, rider, product, price, fee, items = [] }) {
  const loc = (location || '').trim();
  const rid = (rider || '').trim();
  const prod = (product || '').trim();

  if (!loc) throw new Error('Location is required.');
  if (!rid) throw new Error('Rider name is required.');
  if (!prod) throw new Error('Product / Details is required.');
  if (!date) throw new Error('Date is required.');

  const parsedPrice = parseNumber(price);
  const parsedFee = parseNumber(fee);

  const validItems = items.filter(
    (it) => it.vendor_id && it.item_id && parseInt(it.quantity, 10) > 0
  );

  const db = await getDatabase();
  const deliveryId = generateUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Check stock availability for all item rows (based on actual on-hand quantity)
    for (const item of validItems) {
      const stockRow = await db.getFirstAsync(
        'SELECT name, actual, expected FROM vendor_items WHERE id = ?',
        [item.item_id]
      );

      const availableQty = stockRow ? stockRow.actual : 0;
      const requestedQty = parseInt(item.quantity, 10);
      const itemName = stockRow ? stockRow.name : item.item_name || 'selected item';

      if (availableQty < requestedQty) {
        throw new Error(
          `Insufficient stock for "${itemName}". Available actual stock: ${availableQty}, requested: ${requestedQty}`
        );
      }
    }

    // 2. Insert Delivery
    await db.runAsync(
      `INSERT INTO deliveries (id, date, location, rider, product, price, fee, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deliveryId, date, loc, rid, prod, parsedPrice, parsedFee, now, now]
    );

    // 3. Deduct from BOTH actual and expected, and record Delivery Items snapshot
    for (const item of validItems) {
      const qty = parseInt(item.quantity, 10);
      await db.runAsync(
        `UPDATE vendor_items 
         SET actual = actual - ?, expected = expected - ?, updated_at = ? 
         WHERE id = ?`,
        [qty, qty, now, item.item_id]
      );

      const itemId = generateUUID();
      await db.runAsync(
        `INSERT INTO delivery_items 
         (id, delivery_id, vendor_id, item_id, vendor_name_snapshot, item_name_snapshot, unit_price_snapshot, quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          deliveryId,
          item.vendor_id,
          item.item_id,
          item.vendor_name || '',
          item.item_name || '',
          item.unit_price || 0,
          qty,
          now,
          now,
        ]
      );
    }
  });

  return deliveryId;
}

/**
 * Updates an existing delivery: restores old actual & expected, validates & deducts new.
 */
export async function updateDelivery(id, { date, location, rider, product, price, fee, items = [] }) {
  const loc = (location || '').trim();
  const rid = (rider || '').trim();
  const prod = (product || '').trim();

  if (!loc) throw new Error('Location is required.');
  if (!rid) throw new Error('Rider name is required.');
  if (!prod) throw new Error('Product / Details is required.');
  if (!date) throw new Error('Date is required.');

  const parsedPrice = parseNumber(price);
  const parsedFee = parseNumber(fee);

  const validItems = items.filter(
    (it) => it.vendor_id && it.item_id && parseInt(it.quantity, 10) > 0
  );

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Fetch old items for this delivery and restore their stock to both actual & expected
    const oldItems = await db.getAllAsync(
      'SELECT item_id, quantity FROM delivery_items WHERE delivery_id = ?',
      [id]
    );

    for (const oldItem of oldItems) {
      if (oldItem.item_id) {
        await db.runAsync(
          `UPDATE vendor_items 
           SET actual = actual + ?, expected = expected + ?, updated_at = ? 
           WHERE id = ?`,
          [oldItem.quantity, oldItem.quantity, now, oldItem.item_id]
        );
      }
    }

    // 2. Validate new stock availability after restoration
    for (const item of validItems) {
      const stockRow = await db.getFirstAsync(
        'SELECT name, actual FROM vendor_items WHERE id = ?',
        [item.item_id]
      );

      const availableQty = stockRow ? stockRow.actual : 0;
      const requestedQty = parseInt(item.quantity, 10);
      const itemName = stockRow ? stockRow.name : item.item_name || 'selected item';

      if (availableQty < requestedQty) {
        throw new Error(
          `Insufficient stock for "${itemName}". Available actual stock: ${availableQty}, requested: ${requestedQty}`
        );
      }
    }

    // 3. Deduct new stock from actual and expected
    for (const item of validItems) {
      const qty = parseInt(item.quantity, 10);
      await db.runAsync(
        `UPDATE vendor_items 
         SET actual = actual - ?, expected = expected - ?, updated_at = ? 
         WHERE id = ?`,
        [qty, qty, now, item.item_id]
      );
    }

    // 4. Update Delivery row
    await db.runAsync(
      `UPDATE deliveries 
       SET date = ?, location = ?, rider = ?, product = ?, price = ?, fee = ?, updated_at = ?
       WHERE id = ?`,
      [date, loc, rid, prod, parsedPrice, parsedFee, now, id]
    );

    // 5. Replace Delivery Items
    await db.runAsync('DELETE FROM delivery_items WHERE delivery_id = ?', [id]);
    for (const item of validItems) {
      const itemId = generateUUID();
      const qty = parseInt(item.quantity, 10);
      await db.runAsync(
        `INSERT INTO delivery_items 
         (id, delivery_id, vendor_id, item_id, vendor_name_snapshot, item_name_snapshot, unit_price_snapshot, quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          id,
          item.vendor_id,
          item.item_id,
          item.vendor_name || '',
          item.item_name || '',
          item.unit_price || 0,
          qty,
          now,
          now,
        ]
      );
    }
  });

  return true;
}

/**
 * Deletes a delivery and restores both actual & expected stock back to vendor items.
 */
export async function deleteDelivery(id) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Fetch old items
    const oldItems = await db.getAllAsync(
      'SELECT item_id, quantity FROM delivery_items WHERE delivery_id = ?',
      [id]
    );

    // 2. Restore stock for each item to actual & expected
    for (const item of oldItems) {
      if (item.item_id) {
        await db.runAsync(
          `UPDATE vendor_items 
           SET actual = actual + ?, expected = expected + ?, updated_at = ? 
           WHERE id = ?`,
          [item.quantity, item.quantity, now, item.item_id]
        );
      }
    }

    // 3. Delete delivery items and delivery
    await db.runAsync('DELETE FROM delivery_items WHERE delivery_id = ?', [id]);
    await db.runAsync('DELETE FROM deliveries WHERE id = ?', [id]);
  });

  return true;
}
