/**
 * Normalizes string: trims, collapses repeated whitespace inside names.
 */
function normalizeName(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Computes similarity ratio between 0 and 1.
 */
function similarityRatio(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return 1.0 - dist / maxLen;
}

/**
 * Checks whether two names are near-duplicates (similar but not identical).
 * Examples:
 * - "STD Test Kit" vs "STD Tes Kit"
 * - "Glass Repair Kit" vs "Glass Repair"
 */
export function isNearDuplicate(nameA, nameB) {
  const a = normalizeName(nameA).toLowerCase();
  const b = normalizeName(nameB).toLowerCase();

  // If exact match (case-insensitive), not a near-duplicate warning (it's an exact match)
  if (a === b) return false;

  // If one string starts with or contains the other and length difference is small (<= 4 chars)
  if ((a.includes(b) || b.includes(a)) && Math.abs(a.length - b.length) <= 5) {
    return true;
  }

  // Levenshtein distance check:
  // For words > 4 chars, 1-2 edit distance or similarity > 0.82
  const distance = levenshteinDistance(a, b);
  const ratio = similarityRatio(a, b);

  if (Math.min(a.length, b.length) <= 5) {
    return distance === 1;
  }

  return distance <= 2 || ratio >= 0.82;
}

/**
 * Matches parsed Excel rows against current database state.
 *
 * NOTE: As specified, different vendors CAN have the same item name (e.g. "Perfume").
 * Items are strictly matched PER VENDOR.
 *
 * @param {Array} parsedValidRows - Rows output from parseExcelStockFile
 * @param {Array} existingVendors - List of vendors from DB with their items:
 *   [ { id, name, items: [ { id, name, price, actual, expected } ] } ]
 *
 * @returns {Object} {
 *   groupedByVendor: Array,
 *   nearDuplicateWarnings: Array,
 *   priceConflicts: Array,
 *   counts: { newVendors, newItems, newStockRows, updateStockRows, totalUnits }
 * }
 */
export function matchImportDataWithDatabase(parsedValidRows, existingVendors) {
  // 1. Map existing vendors by normalized lowercase name
  const vendorMap = new Map(); // normalizedName -> { vendor, normalizedItemMap }
  const existingVendorNames = [];

  for (const v of existingVendors) {
    const vNorm = normalizeName(v.name).toLowerCase();
    const itemMap = new Map();
    const itemNames = [];

    for (const it of v.items || []) {
      const itNorm = normalizeName(it.name).toLowerCase();
      itemMap.set(itNorm, it);
      itemNames.push({ original: it.name, normalized: itNorm, raw: it });
    }

    vendorMap.set(vNorm, {
      rawVendor: v,
      itemMap,
      itemNames,
    });
    existingVendorNames.push({ original: v.name, normalized: vNorm, raw: v });
  }

  const nearDuplicateWarnings = [];
  const priceConflicts = [];

  // Group valid rows by Vendor
  const incomingByVendor = new Map(); // vendorKey -> { vendorName, items: [] }

  for (const row of parsedValidRows) {
    const vNorm = normalizeName(row.vendor).toLowerCase();
    if (!incomingByVendor.has(vNorm)) {
      incomingByVendor.set(vNorm, {
        vendorName: row.vendor,
        items: [],
      });
    }
    incomingByVendor.get(vNorm).items.push(row);
  }

  // Track counts
  let newVendorsCount = 0;
  let newItemsCount = 0;
  let newStockRowsCount = 0;
  let updateStockRowsCount = 0;
  let totalUnits = 0;

  const groupedByVendor = [];

  // 2. Process each vendor group
  for (const [vNorm, group] of incomingByVendor.entries()) {
    const existingVendorEntry = vendorMap.get(vNorm);
    const isNewVendor = !existingVendorEntry;
    if (isNewVendor) {
      newVendorsCount++;

      // Check for near-duplicate vendor name in existing vendors
      for (const ev of existingVendorNames) {
        if (isNearDuplicate(group.vendorName, ev.original)) {
          nearDuplicateWarnings.push({
            id: `v-warn-${group.vendorName}-${ev.original}`,
            type: 'vendor',
            incomingName: group.vendorName,
            existingName: ev.original,
            existingId: ev.raw.id,
            action: 'keep', // default 'keep' or 'merge'
          });
        }
      }
    }

    const processedItems = [];

    for (const row of group.items) {
      const itNorm = normalizeName(row.item).toLowerCase();
      totalUnits += row.quantity;

      let isExistingItem = false;
      let matchedItemRecord = null;

      if (!isNewVendor) {
        matchedItemRecord = existingVendorEntry.itemMap.get(itNorm);
        if (matchedItemRecord) {
          isExistingItem = true;
        } else {
          // Check for near-duplicate item within THIS VENDOR ONLY
          for (const ei of existingVendorEntry.itemNames) {
            if (isNearDuplicate(row.item, ei.original)) {
              nearDuplicateWarnings.push({
                id: `i-warn-${group.vendorName}-${row.item}-${ei.original}`,
                type: 'item',
                vendorName: group.vendorName,
                incomingName: row.item,
                existingName: ei.original,
                existingId: ei.raw.id,
                action: 'keep', // default 'keep' or 'merge'
              });
            }
          }
        }
      }

      if (isExistingItem) {
        updateStockRowsCount++;

        // Price check: if incoming row has a non-blank price and differs from existing
        const existingPrice = matchedItemRecord.price || 0;
        if (
          row.price !== null &&
          row.price !== undefined &&
          Math.abs(row.price - existingPrice) > 0.001
        ) {
          priceConflicts.push({
            id: `price-${matchedItemRecord.id}`,
            vendorName: group.vendorName,
            itemName: row.item,
            itemId: matchedItemRecord.id,
            existingPrice,
            newPrice: row.price,
            chosenPrice: 'old', // default to keeping existing price
          });
        }
      } else {
        newItemsCount++;
        newStockRowsCount++;
      }

      processedItems.push({
        ...row,
        isNewItem: !isExistingItem,
        existingItemId: isExistingItem ? matchedItemRecord.id : null,
        currentStock: isExistingItem ? (matchedItemRecord.actual || 0) : 0,
        currentPrice: isExistingItem ? (matchedItemRecord.price || 0) : 0,
      });
    }

    groupedByVendor.push({
      vendorName: group.vendorName,
      isNewVendor,
      existingVendorId: isNewVendor ? null : existingVendorEntry.rawVendor.id,
      items: processedItems,
    });
  }

  return {
    groupedByVendor,
    nearDuplicateWarnings,
    priceConflicts,
    counts: {
      newVendors: newVendorsCount,
      newItems: newItemsCount,
      newStockRows: newStockRowsCount,
      updateStockRows: updateStockRowsCount,
      totalUnits,
    },
  };
}
