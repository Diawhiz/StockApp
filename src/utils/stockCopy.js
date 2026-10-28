/**
 * Copied stock always shows the EXPECTED quantity only — actual/missing
 * figures differ and must not leave the app.
 */
export function vendorStockLines(vendor) {
  return vendor.items.map((item) => `• ${item.name}: ${item.expected}`).join('\n');
}

export function buildVendorStockText(vendor) {
  return `--- ${vendor.name.toUpperCase()} STOCK ---\n${vendorStockLines(vendor)}`;
}

export function buildAllStockText(vendorsWithItems) {
  const active = vendorsWithItems.filter((v) => v.items && v.items.length > 0);
  const sections = active.map(
    (v) => `--- ${v.name.toUpperCase()} STOCK ---\n${vendorStockLines(v)}`
  );
  return `=== GENERAL STOCK REPORT ===\n\n${sections.join('\n\n')}`;
}
