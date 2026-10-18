import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { parseNumber } from '../utils/currency';

export async function getAllVendorsWithItems() {
  const db = await getDatabase();
  const vendors = await db.getAllAsync('SELECT * FROM vendors ORDER BY name COLLATE NOCASE ASC');
  const items = await db.getAllAsync('SELECT * FROM vendor_items ORDER BY name COLLATE NOCASE ASC');

  const itemMap = new Map();
  for (const it of items) {
    if (!itemMap.has(it.vendor_id)) {
      itemMap.set(it.vendor_id, []);
    }
    const exp = it.expected ?? 0;
    const act = it.actual ?? 0;
    itemMap.get(it.vendor_id).push({
      ...it,
      missing: exp - act,
    });
  }

  return vendors.map((v) => ({
    ...v,
    items: itemMap.get(v.id) || [],
  }));
}export async function getAllVendors() {
  const db = await getDatabase();
  return await db.getAllAsync('SELECT * FROM vendors ORDER BY name COLLATE NOCASE ASC');
}

export async function createVendor(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Vendor name cannot be empty.');
  }

  const db = await getDatabase();
  const existing = await db.getFirstAsync(
    'SELECT id FROM vendors WHERE LOWER(name) = LOWER(?)',
    [trimmed]
  );
  if (existing) {
    throw new Error(`Vendor "${trimmed}" already exists.`);
  }

  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO vendors (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, trimmed, now, now]
  );

  return { id, name: trimmed, created_at: now, updated_at: now, items: [] };
}

export async function deleteVendor(id) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM vendor_items WHERE vendor_id = ?', [id]);
    await db.runAsync('DELETE FROM vendors WHERE id = ?', [id]);
  });
  return true;
}

export async function addVendorItem(vendorId, { name, price = 0, expected = 0, actual = 0 }) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Item name is required.');
  }

  const parsedPrice = parseNumber(price);
  const parsedExp = parseInt(expected, 10) || 0;
  const parsedAct = parseInt(actual, 10) || 0;

  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO vendor_items (id, vendor_id, name, price, expected, actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, vendorId, trimmed, parsedPrice, parsedExp, parsedAct, now, now]
  );

  return {
    id,
    vendor_id: vendorId,
    name: trimmed,
    price: parsedPrice,
    expected: parsedExp,
    actual: parsedAct,
    missing: parsedExp - parsedAct,
    created_at: now,
    updated_at: now,
  };
}

export async function updateVendorItem(itemId, updates = {}) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const setClauses = [];
  const params = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name.trim());
  }
  if (updates.price !== undefined) {
    setClauses.push('price = ?');
    params.push(parseNumber(updates.price));
  }
  if (updates.expected !== undefined) {
    setClauses.push('expected = ?');
    params.push(parseInt(updates.expected, 10) || 0);
  }
  if (updates.actual !== undefined) {
    setClauses.push('actual = ?');
    params.push(parseInt(updates.actual, 10) || 0);
  }

  if (setClauses.length === 0) return true;

  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(itemId);

  await db.runAsync(
    `UPDATE vendor_items SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );

  return true;
}

export async function deleteVendorItem(itemId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM vendor_items WHERE id = ?', [itemId]);
  return true;
}

/**
 * Returns list of items for a vendor that have actual > 0 (for delivery selection)
 */
export async function getInStockItemsForVendor(vendorId) {
  if (!vendorId) return [];
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT * FROM vendor_items 
     WHERE vendor_id = ? AND actual > 0
     ORDER BY name COLLATE NOCASE ASC`,
    [vendorId]
  );
}
