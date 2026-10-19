import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Normalizes string: trims, collapses repeated whitespace inside names.
 */
export function normalizeName(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes header string to match standard column keys:
 * 'vendor', 'item', 'quantity', 'price'
 */
function normalizeHeader(colName) {
  const clean = String(colName || '').toLowerCase().trim();
  if (clean.includes('vendor')) return 'vendor';
  if (clean.includes('item') || clean.includes('product')) return 'item';
  if (clean.includes('quant') || clean.includes('qty')) return 'quantity';
  if (clean.includes('price') || clean.includes('cost') || clean.includes('₦')) return 'price';
  return null;
}

/**
 * Parses raw Excel rows into structured objects with validation and skipped row tracking.
 * 
 * Rules:
 * - Sheet: "Stock Import" if present, else first sheet.
 * - Columns: Vendor | Item | Quantity | Price (₦).
 * - Price is optional (blank -> 0 for new items).
 * - Ignore grey example rows if Vendor is "Example Vendor" (case-insensitive).
 * - Ignore empty rows.
 * - Quantities of 0 are valid (creates vendor + item).
 * - Invalid quantity (NaN, negative) or missing vendor/item rows are recorded as skipped.
 * - Duplicate vendor + item rows within the file are aggregated and flagged.
 */
export async function parseExcelStockFile(fileUri) {
  let fileBase64;
  try {
    fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (err) {
    throw new Error('Unable to read the chosen file from device storage: ' + (err.message || ''));
  }

  const workbook = XLSX.read(fileBase64, { type: 'base64' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The selected Excel file contains no worksheets.');
  }

  // Find sheet: "Stock Import" or default to the first sheet
  const targetSheetName =
    workbook.SheetNames.find((s) => s.trim().toLowerCase() === 'stock import') ||
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Could not access sheet "${targetSheetName}".`);
  }

  // Convert to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) {
    throw new Error('The selected Excel worksheet is empty.');
  }

  // Find header row (search first 10 rows for vendor & item headers)
  let headerRowIndex = -1;
  let colIndices = { vendor: -1, item: -1, quantity: -1, price: -1 };

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const testIndices = { vendor: -1, item: -1, quantity: -1, price: -1 };
    row.forEach((cell, idx) => {
      const colKey = normalizeHeader(cell);
      if (colKey && testIndices[colKey] === -1) {
        testIndices[colKey] = idx;
      }
    });

    if (testIndices.vendor !== -1 && testIndices.item !== -1 && testIndices.quantity !== -1) {
      headerRowIndex = r;
      colIndices = testIndices;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find required header columns ("Vendor", "Item", and "Quantity") in the sheet.'
    );
  }

  const skippedRows = [];
  const validMap = new Map(); // key: "vendorLower:::itemLower" -> combined row
  let combinedDuplicateCount = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const excelRowNumber = r + 1;

    if (!Array.isArray(row) || row.every((c) => String(c).trim() === '')) {
      // Empty row, ignore
      continue;
    }

    const rawVendor = colIndices.vendor !== -1 ? row[colIndices.vendor] : '';
    const rawItem = colIndices.item !== -1 ? row[colIndices.item] : '';
    const rawQty = colIndices.quantity !== -1 ? row[colIndices.quantity] : '';
    const rawPrice = colIndices.price !== -1 ? row[colIndices.price] : '';

    const vendor = normalizeName(rawVendor);
    const item = normalizeName(rawItem);

    // Skip example row if vendor is "Example Vendor"
    if (vendor.toLowerCase() === 'example vendor') {
      continue;
    }

    // Validation checks
    if (!vendor && !item) {
      continue; // empty row data
    }
    if (!vendor) {
      skippedRows.push({
        rowNumber: excelRowNumber,
        vendor: '',
        item: item || 'N/A',
        quantity: rawQty,
        reason: 'Missing vendor name',
      });
      continue;
    }
    if (!item) {
      skippedRows.push({
        rowNumber: excelRowNumber,
        vendor,
        item: '',
        quantity: rawQty,
        reason: 'Missing item name',
      });
      continue;
    }

    // Validate quantity
    const cleanedQtyStr = String(rawQty).replace(/,/g, '').trim();
    const qty = Number(cleanedQtyStr);

    if (cleanedQtyStr === '' || isNaN(qty)) {
      skippedRows.push({
        rowNumber: excelRowNumber,
        vendor,
        item,
        quantity: rawQty,
        reason: 'Quantity is not a valid number',
      });
      continue;
    }

    if (qty < 0) {
      skippedRows.push({
        rowNumber: excelRowNumber,
        vendor,
        item,
        quantity: qty,
        reason: 'Quantity cannot be negative',
      });
      continue;
    }

    // Parse optional price
    let parsedPrice = null; // null represents blank / not provided
    if (rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== '') {
      const cleanPriceStr = String(rawPrice).replace(/[₦,\s]/g, '').trim();
      const numPrice = Number(cleanPriceStr);
      if (!isNaN(numPrice) && numPrice >= 0) {
        parsedPrice = numPrice;
      }
    }

    const key = `${vendor.toLowerCase()}:::${item.toLowerCase()}`;

    if (validMap.has(key)) {
      // Combine duplicates inside the file
      const existing = validMap.get(key);
      existing.quantity += qty;
      existing.internalDuplicates.push({
        rowNumber: excelRowNumber,
        quantity: qty,
        price: parsedPrice,
      });
      // If previous price was null and new price is defined, take the defined price
      if (existing.price === null && parsedPrice !== null) {
        existing.price = parsedPrice;
      }
      combinedDuplicateCount++;
    } else {
      validMap.set(key, {
        rowNumber: excelRowNumber,
        vendor,
        item,
        quantity: qty,
        price: parsedPrice,
        internalDuplicates: [],
      });
    }
  }

  const validRows = Array.from(validMap.values());

  return {
    sheetName: targetSheetName,
    validRows,
    skippedRows,
    combinedDuplicateCount,
  };
}

/**
 * Generates and shares a sample Excel template for Vendor Stock Import.
 */
export async function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();

  const data = [
    ['Vendor', 'Item', 'Quantity', 'Price (₦)'],
    ['Example Vendor', 'Sample Product 500ml', 50, 2500],
    ['ABC Enterprises', 'Pain Reliever Tablets', 100, 1500],
    ['ABC Enterprises', 'Bandage Rolls 10cm', 40, 600],
    ['Global Pharma', 'Vitamin C 1000mg', 85, 3000],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 22 }, // Vendor
    { wch: 28 }, // Item
    { wch: 14 }, // Quantity
    { wch: 14 }, // Price (₦)
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Stock Import');

  const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}Vendor_Stock_Import_Template.xlsx`;

  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Download Vendor Stock Import Template',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }

  return fileUri;
}
