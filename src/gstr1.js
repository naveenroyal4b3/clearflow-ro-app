// GSTR-1 for one month, as the three CSV sheets the GST offline tool imports: b2b (invoices to
// GST-registered buyers), b2cs (other sales, summed by place of supply and rate) and hsn (HSN-wise
// summary). Shared by the web and native apps. Only GST invoices that aren't cancelled count.
import { gstStates } from './gst.js';

const round = value => Math.round((Number(value) || 0) * 100) / 100;
const money = value => round(value).toFixed(2);
const csvCell = value => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = rows => rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

// "37-Andhra Pradesh", as the offline tool writes a place of supply.
export function placeOfSupply(code) {
  return gstStates[code] ? `${code}-${gstStates[code]}` : '';
}

// dd-Mon-yyyy, the date format the offline tool expects (for example 05-Nov-2026).
export function gstDate(date) {
  const [year, month, day] = date.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${names[Number(month) - 1]}-${year}`;
}

// The GST unit quantity codes for the app's units.
const uqc = { Nos: 'NOS-NUMBERS', Pcs: 'PCS-PIECES', Set: 'SET-SETS', Box: 'BOX-BOX', Kg: 'KGS-KILOGRAMS', Ltr: 'LTR-LITRES', Mtr: 'MTR-METERS' };

/**
 * @param {any[]} documents Sales documents (loadWorkspace).
 * @param {string} month 'YYYY-MM'.
 * @param {(doc: any) => any} detailsFor documentDetails for a document (seller, buyer, tax).
 */
export function gstr1(documents, month, detailsFor) {
  const invoices = documents
    .filter(doc => doc.type === 'Invoice' && doc.gst && doc.status !== 'Cancelled' && doc.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const b2b = [['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount']];
  const b2csTotals = new Map();
  const hsnTotals = new Map();
  for (const doc of invoices) {
    const { buyer, tax } = detailsFor(doc);
    const place = placeOfSupply(tax.placeOfSupply);
    const byRate = new Map();
    for (const row of tax.rows) {
      byRate.set(row.rate, round((byRate.get(row.rate) || 0) + row.taxable));
      const key = `${row.hsn || ''}|${row.rate}`;
      const hsn = hsnTotals.get(key) || { hsn: row.hsn || '', name: row.name, unit: uqc[row.unit] || 'OTH-OTHERS', rate: row.rate, qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      hsn.qty += Number(row.qty) || 0;
      hsn.value += row.total;
      hsn.taxable += row.taxable;
      hsn.igst += row.igst;
      hsn.cgst += row.cgst;
      hsn.sgst += row.sgst;
      hsnTotals.set(key, hsn);
    }
    if (buyer.gstin) {
      for (const [rate, taxable] of byRate) {
        b2b.push([buyer.gstin, buyer.name, doc.id, gstDate(doc.date), money(tax.total), place, 'N', '', 'Regular B2B', '', rate, money(taxable), '0.00']);
      }
    } else {
      for (const [rate, taxable] of byRate) {
        const key = `${place}|${rate}`;
        b2csTotals.set(key, { place, rate, taxable: round((b2csTotals.get(key)?.taxable || 0) + taxable) });
      }
    }
  }
  const b2cs = [['Type', 'Place Of Supply', 'Rate', 'Applicable % of Tax Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
    ...[...b2csTotals.values()].sort((a, b) => a.place.localeCompare(b.place) || a.rate - b.rate).map(item => ['OE', item.place, item.rate, '', money(item.taxable), '0.00', ''])];
  const hsn = [['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'],
    ...[...hsnTotals.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate).map(item => [item.hsn, item.name, item.unit, item.qty, money(item.value), item.rate, money(item.taxable), money(item.igst), money(item.cgst), money(item.sgst), '0.00'])];
  return {
    invoices: invoices.length,
    files: [
      { name: `GSTR1-${month}-b2b.csv`, text: csv(b2b), rows: b2b.length - 1 },
      { name: `GSTR1-${month}-b2cs.csv`, text: csv(b2cs), rows: b2cs.length - 1 },
      { name: `GSTR1-${month}-hsn.csv`, text: csv(hsn), rows: hsn.length - 1 }
    ]
  };
}
