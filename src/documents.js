// @ts-check
// Printable quotations, GST invoices and the invoice register. Shared by the web app (src/main.js)
// and the native app (mobile/src/lib/shared.ts), so both print exactly the same documents.
import { amountInWords, stateFromGstin, stateLabel, taxBreakup } from './gst.js';

/** @param {unknown} value */
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}

/** @param {number} value */
function rupees(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

/** @param {string} value A YYYY-MM-DD date. */
function printDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

/**
 * Seller, buyer and tax breakup for a document. Documents issued before seller/buyer snapshots
 * existed fall back to the business's and the customer's current details.
 * @param {any} doc A sales document as returned by loadWorkspace.
 * @param {{ customer: any, products: any[], organization: any }} context
 */
export function documentDetails(doc, { customer, products, organization }) {
  const person = customer || { name: 'Unknown customer', address: '', gstin: '', state: '' };
  const seller = doc.seller?.name ? doc.seller : { name: organization?.name || '', gstin: organization?.gstin || '', address: organization?.address || '', state: organization?.state_code || '', phone: organization?.phone || '' };
  const buyer = doc.buyer?.name ? doc.buyer : { name: person.name, gstin: person.gstin || '', address: person.address, state: person.state || '' };
  const sellerState = seller.state || stateFromGstin(seller.gstin);
  const buyerState = buyer.state || stateFromGstin(buyer.gstin);
  const product = (/** @type {string} */ id) => products.find(item => item.id === id) || { name: 'Removed product', hsn: '' };
  const lines = doc.items.map((/** @type {any} */ item) => ({ ...item, name: item.name || product(item.productId).name, hsn: item.hsn ?? product(item.productId).hsn ?? '' }));
  const tax = taxBreakup(lines, { gstEnabled: doc.gst, sellerState, buyerState });
  return { seller, buyer, sellerState, buyerState, tax };
}

/**
 * A complete HTML page for a quotation or invoice, ready to print or save as PDF.
 * @param {any} doc
 * @param {ReturnType<typeof documentDetails>} details
 */
export function documentHtml(doc, { seller, buyer, sellerState, buyerState, tax }) {
  const esc = escapeHtml;
  const title = doc.type === 'Quotation' ? 'Quotation' : doc.gst && seller.gstin ? 'Tax Invoice' : 'Invoice';
  const hasDiscount = tax.discount > 0;
  const taxHead = tax.interState ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>';
  const taxCell = (/** @type {number} */ amount, /** @type {number} */ rate) => `<td class="n">${rupees(amount)}<small>@ ${rate}%</small></td>`;
  const rows = tax.rows.map((/** @type {any} */ row, /** @type {number} */ index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td>${esc(row.hsn || '—')}</td><td class="n">${row.qty} ${esc(row.unit || 'Nos')}</td><td class="n">${rupees(row.price)}</td>${hasDiscount ? `<td class="n">${row.discount ? rupees(row.discount) : '—'}</td>` : ''}<td class="n">${rupees(row.taxable)}</td>${tax.interState ? taxCell(row.igst, row.rate) : taxCell(row.cgst, row.rate / 2) + taxCell(row.sgst, row.rate / 2)}<td class="n">${rupees(row.total)}</td></tr>`).join('');
  const taxTotals = tax.interState
    ? `<p><span>IGST</span><strong>${rupees(tax.igst)}</strong></p>`
    : `<p><span>CGST</span><strong>${rupees(tax.cgst)}</strong></p><p><span>SGST</span><strong>${rupees(tax.sgst)}</strong></p>`;
  const party = (/** @type {string} */ label, /** @type {any} */ details, /** @type {string} */ state) => `<div class="party"><small>${label}</small><strong>${esc(details.name)}</strong>${details.address ? `<span>${esc(details.address)}</span>` : ''}${details.phone ? `<span>Phone: ${esc(details.phone)}</span>` : ''}${details.gstin ? `<span>GSTIN: ${esc(details.gstin)}</span>` : ''}${state ? `<span>State: ${esc(stateLabel(state))}</span>` : ''}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.id)}</title><style>body{font:13px Arial,sans-serif;color:#24342d;padding:40px}h1{margin:0;font-size:22px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #197c70;padding-bottom:16px}.meta{text-align:right}.meta span{display:block}.parties{display:flex;gap:24px;margin:20px 0}.party{flex:1}.party small{display:block;color:#68756e;text-transform:uppercase;font-size:10px;letter-spacing:.06em;margin-bottom:4px}.party strong,.party span{display:block}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;font-size:12px}th{background:#f4f7f4}.n{text-align:right}td small{display:block;color:#77827c;font-size:10px}.words{margin:16px 0 0;text-align:right}.total{width:300px;margin:20px 0 0 auto}.total p{display:flex;justify-content:space-between;margin:6px 0}.grand{border-top:1px solid #aaa;padding-top:10px;font-size:16px;font-weight:bold}.foot{display:flex;justify-content:space-between;margin-top:60px;color:#77827c;font-size:11px}.sign{text-align:right;color:#24342d}</style></head><body>
<div class="head"><div><h1>${esc(seller.name)}</h1></div><div class="meta"><h1>${title}</h1><span>${esc(doc.id)}</span><span>Date: ${printDate(doc.date)}</span><span>${doc.type === 'Quotation' ? 'Valid until' : 'Due date'}: ${printDate(doc.due)}</span></div></div>
<div class="parties">${party('From', seller, sellerState)}${party(doc.type === 'Quotation' ? 'Quotation for' : 'Bill to', buyer, buyerState)}</div>
${doc.gst ? `<p>Place of supply: <strong>${esc(stateLabel(tax.placeOfSupply) || 'Not specified')}</strong> · Reverse charge: No</p>` : '<p>GST not applied to this document.</p>'}
<table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="n">Qty</th><th class="n">Rate</th>${hasDiscount ? '<th class="n">Discount</th>' : ''}<th class="n">Taxable value</th>${taxHead.replace(/<th>/g, '<th class="n">')}<th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total">${hasDiscount ? `<p><span>Discount</span><strong>${rupees(tax.discount)}</strong></p>` : ''}<p><span>Taxable value</span><strong>${rupees(tax.taxable)}</strong></p>${doc.gst ? taxTotals : ''}<p class="grand"><span>Total</span><strong>${rupees(tax.total)}</strong></p></div>
<p class="words">Amount in words: <strong>${amountInWords(tax.total)}</strong></p>
<div class="foot"><span>This is a computer-generated document.</span><span class="sign">For ${esc(seller.name)}<br><br><br>Authorised signatory</span></div>
</body></html>`;
}

export const invoiceRegisterHeader = ['Invoice number', 'Date', 'Status', 'Customer', 'Customer GSTIN', 'Place of supply', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total'];

/**
 * One row per invoice for the accountant, oldest first.
 * @param {any[]} documents
 * @param {(doc: any) => ReturnType<typeof documentDetails>} detailsFor
 */
export function invoiceRegisterRows(documents, detailsFor) {
  return documents
    .filter(doc => doc.type === 'Invoice')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map(doc => {
      const { buyer, tax } = detailsFor(doc);
      return [doc.id, doc.date, doc.status, buyer.name, buyer.gstin, doc.gst ? stateLabel(tax.placeOfSupply) : '', tax.taxable, tax.cgst, tax.sgst, tax.igst, tax.total];
    });
}

/**
 * The invoice register as a printable HTML page (saved as PDF on phones).
 * @param {string} title
 * @param {any[][]} rows
 */
export function invoiceRegisterHtml(title, rows) {
  const esc = escapeHtml;
  const cells = (/** @type {any[]} */ row) => row.map(value => `<td>${esc(typeof value === 'number' ? rupees(value) : value)}</td>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:11px Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:5px;border-bottom:1px solid #ddd}</style></head><body><h2>${esc(title)}</h2><table><thead><tr>${invoiceRegisterHeader.map(name => `<th>${name}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${cells(row)}</tr>`).join('')}</tbody></table></body></html>`;
}
