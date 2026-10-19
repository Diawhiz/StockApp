import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { normalizeName } from '../utils/excelParser';

/**
 * Executes the entire Excel stock import inside one atomic SQLite transaction.
 * If anything fails, the entire transaction is rolled back.
 *
 * Updates BOTH 'actual' and 'expected' stock as required.
 */
export async function executeStockImport({
  matchResult,
  parsedData,
  importMode = 'add', // 'add' | 'replace'
  warningActions = {},
  priceSelections = {},
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const importLogId = generateUUID();

  let vendorsAddedCount = 0;
  let itemsAddedCount = 0;
  let itemsUpdatedCount = 0;
  const rowsSkippedCount = parsedData.skippedRows ? parsedData.skippedRows.length : 0;
  let totalUnitsProcessed = 0;

  await db.withTransactionAsync(async () => {
    // 1. Fetch current vendors and vendor_items
    const currentVendors = await db.getAllAsync('SELECT * FROM vendors');
    const vendorByName = new Map();
    for (const v of currentVendors) {
      vendorByName.set(normalizeName(v.name).toLowerCase(), v);
    }

    const currentItems = await db.getAllAsync('SELECT * FROM vendor_items');
    // Map: `${vendor_id}:::${normalized_item_name}` -> item
    const itemByVendorAndName = new Map();
    for (const it of currentItems) {
      itemByVendorAndName.set(`${it.vendor_id}:::${normalizeName(it.name).toLowerCase()}`, it);
    }

    const logDetails = [];

    // 2. Iterate through each vendor group in matchResult
    for (const group of matchResult.groupedByVendor) {
      let targetVendorName = group.vendorName;

      // Check if user chose to merge near-duplicate vendor
      for (const w of matchResult.nearDuplicateWarnings) {
        if (
          w.type === 'vendor' &&
          w.incomingName === group.vendorName &&
          warningActions[w.id] === 'merge'
        ) {
          targetVendorName = w.existingName;
          break;
        }
      }

      const normTargetVendor = normalizeName(targetVendorName).toLowerCase();
      let vendorRecord = vendorByName.get(normTargetVendor);
      let isNewVendor = false;

      // Create vendor if not exists
      if (!vendorRecord) {
        const newVendorId = generateUUID();
        await db.runAsync(
          'INSERT INTO vendors (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [newVendorId, targetVendorName, now, now]
        );
        vendorRecord = { id: newVendorId, name: targetVendorName, created_at: now, updated_at: now };
        vendorByName.set(normTargetVendor, vendorRecord);
        isNewVendor = true;
        vendorsAddedCount++;
      }

      // 3. Process items for this vendor
      for (const rowItem of group.items) {
        let targetItemName = rowItem.item;

        // Check if user chose to merge near-duplicate item
        for (const w of matchResult.nearDuplicateWarnings) {
          if (
            w.type === 'item' &&
            w.vendorName === group.vendorName &&
            w.incomingName === rowItem.item &&
            warningActions[w.id] === 'merge'
          ) {
            targetItemName = w.existingName;
            break;
          }
        }

        const normItemKey = `${vendorRecord.id}:::${normalizeName(targetItemName).toLowerCase()}`;
        let itemRecord = itemByVendorAndName.get(normItemKey);

        const qty = rowItem.quantity || 0;
        totalUnitsProcessed += qty;

        if (itemRecord) {
          // Existing Item: Update stock (and price if opted)
          const prevActual = itemRecord.actual || 0;
          const prevExpected = itemRecord.expected || 0;
          const prevPrice = itemRecord.price || 0;

          const newActual = importMode === 'add' ? prevActual + qty : qty;
          const newExpected = importMode === 'add' ? prevExpected + qty : qty;

          let newPrice = prevPrice;
          if (rowItem.price !== null && rowItem.price !== undefined) {
            const chosen = priceSelections[itemRecord.id] || 'old';
            if (chosen === 'new') {
              newPrice = rowItem.price;
            }
          }

          await db.runAsync(
            `UPDATE vendor_items 
             SET actual = ?, expected = ?, price = ?, updated_at = ? 
             WHERE id = ?`,
            [newActual, newExpected, newPrice, now, itemRecord.id]
          );

          itemsUpdatedCount++;

          logDetails.push({
            id: generateUUID(),
            import_log_id: importLogId,
            vendor_id: vendorRecord.id,
            item_id: itemRecord.id,
            is_new_vendor: isNewVendor ? 1 : 0,
            is_new_item: 0,
            prev_actual: prevActual,
            prev_expected: prevExpected,
            prev_price: prevPrice,
            new_actual: newActual,
            new_expected: newExpected,
            new_price: newPrice,
          });

          // Update in-memory record for future duplicate encounters
          itemRecord.actual = newActual;
          itemRecord.expected = newExpected;
          itemRecord.price = newPrice;
        } else {
          // New Item: Insert
          const newItemId = generateUUID();
          const itemPrice = rowItem.price !== null && rowItem.price !== undefined ? rowItem.price : 0;

          await db.runAsync(
            `INSERT INTO vendor_items 
             (id, vendor_id, name, price, expected, actual, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newItemId, vendorRecord.id, targetItemName, itemPrice, qty, qty, now, now]
          );

          itemsAddedCount++;

          const createdItemObj = {
            id: newItemId,
            vendor_id: vendorRecord.id,
            name: targetItemName,
            price: itemPrice,
            expected: qty,
            actual: qty,
          };
          itemByVendorAndName.set(normItemKey, createdItemObj);

          logDetails.push({
            id: generateUUID(),
            import_log_id: importLogId,
            vendor_id: vendorRecord.id,
            item_id: newItemId,
            is_new_vendor: isNewVendor ? 1 : 0,
            is_new_item: 1,
            prev_actual: 0,
            prev_expected: 0,
            prev_price: 0,
            new_actual: qty,
            new_expected: qty,
            new_price: itemPrice,
          });
        }
      }
    }

    // 4. Save Import Log Master
    await db.runAsync(
      `INSERT INTO import_logs 
       (id, timestamp, mode, total_units, vendors_added, items_added, items_updated, rows_skipped, is_undone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        importLogId,
        now,
        importMode,
        totalUnitsProcessed,
        vendorsAddedCount,
        itemsAddedCount,
        itemsUpdatedCount,
        rowsSkippedCount,
      ]
    );

    // 5. Save Import Log Details
    for (const d of logDetails) {
      await db.runAsync(
        `INSERT INTO import_log_details
         (id, import_log_id, vendor_id, item_id, is_new_vendor, is_new_item, prev_actual, prev_expected, prev_price, new_actual, new_expected, new_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id,
          d.import_log_id,
          d.vendor_id,
          d.item_id,
          d.is_new_vendor,
          d.is_new_item,
          d.prev_actual,
          d.prev_expected,
          d.prev_price,
          d.new_actual,
          d.new_expected,
          d.new_price,
        ]
      );
    }
  });

  return {
    importLogId,
    vendorsAdded: vendorsAddedCount,
    itemsAdded: itemsAddedCount,
    itemsUpdated: itemsUpdatedCount,
    rowsSkipped: rowsSkippedCount,
    totalUnits: totalUnitsProcessed,
    mode: importMode,
  };
}

/**
 * Checks whether an active, non-undone import exists.
 */
export async function getLastActiveImport() {
  const db = await getDatabase();
  return await db.getFirstAsync(
    'SELECT * FROM import_logs WHERE is_undone = 0 ORDER BY timestamp DESC LIMIT 1'
  );
}

/**
 * Undoes the most recent import transaction:
 * - Restores previous actual, expected, and price on modified items.
 * - Deletes items that were newly created by this import.
 * - If a vendor was newly created and now has no other items, removes it.
 * - Marks the import log as undone.
 */
export async function undoLastImport() {
  const db = await getDatabase();
  const lastLog = await getLastActiveImport();

  if (!lastLog) {
    throw new Error('No recent import found to undo.');
  }

  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const details = await db.getAllAsync(
      'SELECT * FROM import_log_details WHERE import_log_id = ?',
      [lastLog.id]
    );

    for (const d of details) {
      if (d.is_new_item === 1) {
        // Remove item created by this import
        await db.runAsync('DELETE FROM vendor_items WHERE id = ?', [d.item_id]);
      } else {
        // Restore prior stock & price
        await db.runAsync(
          `UPDATE vendor_items 
           SET actual = ?, expected = ?, price = ?, updated_at = ? 
           WHERE id = ?`,
          [d.prev_actual, d.prev_expected, d.prev_price, now, d.item_id]
        );
      }

      // If vendor was newly created, check if it has remaining items; if none, delete
      if (d.is_new_vendor === 1) {
        const remaining = await db.getFirstAsync(
          'SELECT COUNT(*) as count FROM vendor_items WHERE vendor_id = ?',
          [d.vendor_id]
        );
        if (!remaining || remaining.count === 0) {
          await db.runAsync('DELETE FROM vendors WHERE id = ?', [d.vendor_id]);
        }
      }
    }

    // Mark import log as undone
    await db.runAsync('UPDATE import_logs SET is_undone = 1 WHERE id = ?', [lastLog.id]);
  });

  return lastLog;
}
