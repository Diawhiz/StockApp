import { formatNaira } from './currency';

/**
 * Generates the exact Daily Report string matching the required specification:
 * 
 * DAILY REPORT FOR {date}
 * 
 * === DELIVERED ORDERS ===
 * {RIDER NAME}
 * - 1. {location}: {product} {price} ({fee})
 * - 2. {location}: {product} {price} ({fee})
 * - Total for {rider}: {rider subtotal of prices}
 * 
 * {NEXT RIDER NAME}
 * - 3. ...
 * - Total for {rider}: {subtotal}
 * 
 * TOTAL SALES: {total sales}
 * 
 * === EXPENSES ===
 * - 1. {description} {amount}
 * - 2. {description} {amount}
 * --- TOTAL EXPENSES: {total expenses}
 * 
 * === RECONCILIATION ===
 * Client Funds Collected ({total sales}) - Total Expenses Paid ({total expenses}) = Balance: {balance}
 * 
 * = FINAL TRANSFER AMOUNT: {balance}
 */
export function generateDailyReportText({ date, deliveries = [], expenses = [] }) {
  let output = `DAILY REPORT FOR ${date}\n\n`;

  output += '=== DELIVERED ORDERS ===\n';

  // Group deliveries by rider
  const riderMap = new Map();
  for (const d of deliveries) {
    const rName = (d.rider || 'UNASSIGNED').trim().toUpperCase();
    if (!riderMap.has(rName)) {
      riderMap.set(rName, {
        rider: rName,
        subtotal: 0,
        orders: [],
      });
    }
    const group = riderMap.get(rName);
    group.subtotal += d.price || 0;
    group.orders.push(d);
  }

  let globalOrderIndex = 1;
  let totalSales = 0;

  if (riderMap.size === 0) {
    output += 'No deliveries recorded for this date.\n';
  } else {
    const riderEntries = Array.from(riderMap.values());
    riderEntries.forEach((group, groupIdx) => {
      output += `${group.rider}\n`;
      group.orders.forEach((ord) => {
        const formattedPrice = formatNaira(ord.price || 0);
        const formattedFee = formatNaira(ord.fee || 0);
        output += `- ${globalOrderIndex}. ${ord.location}: ${ord.product} ${formattedPrice} (${formattedFee})\n`;
        globalOrderIndex++;
      });
      output += `- Total for ${group.rider}: ${formatNaira(group.subtotal)}\n`;

      totalSales += group.subtotal;

      if (groupIdx < riderEntries.length - 1) {
        output += '\n';
      }
    });
  }

  output += `\nTOTAL SALES: ${formatNaira(totalSales)}\n\n`;

  output += '=== EXPENSES ===\n';
  let totalExpenses = 0;
  if (expenses.length === 0) {
    output += 'No expenses recorded for this date.\n';
  } else {
    expenses.forEach((exp, idx) => {
      output += `- ${idx + 1}. ${exp.description} ${formatNaira(exp.amount)}\n`;
      totalExpenses += exp.amount || 0;
    });
  }
  output += `--- TOTAL EXPENSES: ${formatNaira(totalExpenses)}\n\n`;

  const balance = totalSales - totalExpenses;
  const formattedSales = formatNaira(totalSales);
  const formattedExpenses = formatNaira(totalExpenses);
  const formattedBalance = formatNaira(balance);

  output += '=== RECONCILIATION ===\n';
  output += `Client Funds Collected (${formattedSales}) - Total Expenses Paid (${formattedExpenses}) = Balance: ${formattedBalance}\n\n`;
  output += `= FINAL TRANSFER AMOUNT: ${formattedBalance}\n`;

  return output;
}
