import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { parseNumber } from '../utils/currency';

export async function getExpensesByDate(date) {
  const db = await getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM expenses WHERE date = ? ORDER BY created_at ASC',
    [date]
  );
}

export async function createExpense({ date, description, amount }) {
  const desc = (description || '').trim();
  if (!desc) throw new Error('Expense description is required.');

  const parsedAmount = parseNumber(amount);
  if (parsedAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  if (!date) throw new Error('Date is required.');

  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO expenses (id, date, description, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, date, desc, parsedAmount, now, now]
  );

  return { id, date, description: desc, amount: parsedAmount, created_at: now, updated_at: now };
}

export async function updateExpense(id, { date, description, amount }) {
  const desc = (description || '').trim();
  if (!desc) throw new Error('Expense description is required.');

  const parsedAmount = parseNumber(amount);
  if (parsedAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE expenses SET date = ?, description = ?, amount = ?, updated_at = ? WHERE id = ?',
    [date, desc, parsedAmount, now, id]
  );

  return true;
}

export async function deleteExpense(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  return true;
}
