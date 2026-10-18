import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { parseNumber } from '../utils/currency';

export async function getAllItems() {
  const db = await getDatabase();
  return await db.getAllAsync('SELECT * FROM items ORDER BY name COLLATE NOCASE ASC');
}

export async function getItemById(id) {
  const db = await getDatabase();
  return await db.getFirstAsync('SELECT * FROM items WHERE id = ?', [id]);
}

export async function createItem(name, price) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Item name cannot be empty.');
  }

  const parsedPrice = parseNumber(price);
  if (parsedPrice < 0) {
    throw new Error('Price cannot be negative.');
  }

  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO items (id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, trimmed, parsedPrice, now, now]
  );

  return { id, name: trimmed, price: parsedPrice, created_at: now, updated_at: now };
}

export async function updateItemPrice(id, newPrice) {
  const parsedPrice = parseNumber(newPrice);
  if (parsedPrice < 0) {
    throw new Error('Price cannot be negative.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE items SET price = ?, updated_at = ? WHERE id = ?',
    [parsedPrice, now, id]
  );

  return true;
}

export async function deleteItem(id) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Delete item's vendor stock rows first
    await db.runAsync('DELETE FROM vendor_stock WHERE item_id = ?', [id]);
    await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  });
  return true;
}
