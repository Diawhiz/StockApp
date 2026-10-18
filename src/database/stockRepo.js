import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { parseNumber } from '../utils/currency';

export async function assignOrAddStock(vendorId, itemId, quantity) {
  if (!vendorId) throw new Error('Please select a vendor.');
  if (!itemId) throw new Error('Please select an item.');
  
  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    throw new Error('Please enter a valid quantity greater than zero.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync(
      'SELECT id, quantity FROM vendor_stock WHERE vendor_id = ? AND item_id = ?',
      [vendorId, itemId]
    );

    if (existing) {
      const newQty = existing.quantity + parsedQty;
      await db.runAsync(
        'UPDATE vendor_stock SET quantity = ?, updated_at = ? WHERE id = ?',
        [newQty, now, existing.id]
      );
    } else {
      const id = generateUUID();
      await db.runAsync(
        'INSERT INTO vendor_stock (id, vendor_id, item_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, vendorId, itemId, parsedQty, now, now]
      );
    }
  });

  return true;
}

export async function updateStockQuantity(stockId, newQuantity) {
  const parsedQty = parseInt(newQuantity, 10);
  if (isNaN(parsedQty) || parsedQty < 0) {
    throw new Error('Quantity cannot be negative.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE vendor_stock SET quantity = ?, updated_at = ? WHERE id = ?',
    [parsedQty, now, stockId]
  );
  return true;
}

export async function deleteStockRow(stockId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM vendor_stock WHERE id = ?', [stockId]);
  return true;
}

/**
 * Returns list of items currently in stock (> 0) for a specific vendor.
 * Joined with items table to get current item name and price.
 */
export async function getItemsInStockForVendor(vendorId) {
  if (!vendorId) return [];
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT 
      vs.id AS stock_id,
      vs.vendor_id,
      vs.item_id,
      vs.quantity,
      i.name AS item_name,
      i.price AS item_price
    FROM vendor_stock vs
    INNER JOIN items i ON vs.item_id = i.id
    WHERE vs.vendor_id = ? AND vs.quantity > 0
    ORDER BY i.name COLLATE NOCASE ASC`,
    [vendorId]
  );
}

/**
 * Returns grouped vendor stock balances with calculated total values.
 */
export async function getVendorStockBalances() {
  const db = await getDatabase();
  const rows = await db.getAllAsync(`
    SELECT 
      v.id AS vendor_id,
      v.name AS vendor_name,
      vs.id AS stock_id,
      vs.quantity,
      i.id AS item_id,
      i.name AS item_name,
      i.price AS item_price
    FROM vendors v
    LEFT JOIN vendor_stock vs ON v.id = vs.vendor_id
    LEFT JOIN items i ON vs.item_id = i.id
    ORDER BY v.name COLLATE NOCASE ASC, i.name COLLATE NOCASE ASC
  `);

  // Group by vendor
  const vendorMap = new Map();
  let grandTotalValue = 0;

  for (const row of rows) {
    if (!vendorMap.has(row.vendor_id)) {
      vendorMap.set(row.vendor_id, {
        vendor_id: row.vendor_id,
        vendor_name: row.vendor_name,
        total_value: 0,
        items: [],
      });
    }

    const vendorGroup = vendorMap.get(row.vendor_id);
    if (row.stock_id && row.item_id) {
      const lineValue = (row.quantity || 0) * (row.item_price || 0);
      vendorGroup.total_value += lineValue;
      grandTotalValue += lineValue;

      vendorGroup.items.push({
        stock_id: row.stock_id,
        item_id: row.item_id,
        item_name: row.item_name,
        item_price: row.item_price,
        quantity: row.quantity,
        total_value: lineValue,
      });
    }
  }

  return {
    vendors: Array.from(vendorMap.values()),
    grandTotalValue,
  };
}
