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

    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      mode TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      vendors_added INTEGER NOT NULL,
      items_added INTEGER NOT NULL,
      items_updated INTEGER NOT NULL,
      rows_skipped INTEGER NOT NULL,
      is_undone INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS import_log_details (
      id TEXT PRIMARY KEY,
      import_log_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      is_new_vendor INTEGER NOT NULL DEFAULT 0,
      is_new_item INTEGER NOT NULL DEFAULT 0,
      prev_actual INTEGER NOT NULL,
      prev_expected INTEGER NOT NULL,
      prev_price REAL NOT NULL,
      new_actual INTEGER NOT NULL,
      new_expected INTEGER NOT NULL,
      new_price REAL NOT NULL,
      FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_vendor_items_vendor ON vendor_items(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
    CREATE INDEX IF NOT EXISTS idx_import_log_details_log ON import_log_details(import_log_id);
  `);

  return dbInstance;
}
