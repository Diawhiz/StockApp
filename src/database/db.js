import * as SQLite from 'expo-sqlite';

let dbInstance = null;

export async function getDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabaseAsync('sage_logistics.db');
  
  // Enable foreign keys and WAL mode for better concurrency and durability
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');

  // Run schema migrations matching the original vendor-items model
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendor_items (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      expected INTEGER NOT NULL DEFAULT 0,
      actual INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      rider TEXT NOT NULL,
      product TEXT NOT NULL,
      price REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delivery_items (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL,
      vendor_id TEXT,
      item_id TEXT,
      vendor_name_snapshot TEXT NOT NULL,
      item_name_snapshot TEXT NOT NULL,
      unit_price_snapshot REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_vendor_items_vendor ON vendor_items(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
  `);

  return dbInstance;
}
