import test from 'node:test';
import assert from 'node:assert/strict';
import { documentDetails, documentHtml, escapeHtml, invoiceRegisterRows } from '../src/documents.js';

const organization = { name: 'Asha RO <Services>', gstin: '36ABCDE1234F1Z5', address: 'Madhapur', state_code: '36', phone: '90000' };
const customer = { id: 'C-1', name: 'Lakshmi', address: 'Kondapur', gstin: '', state: '' };
const products = [{ id: 'P-1', name: 'Filter', hsn: '8421' }];
const invoice = {
  id: 'INV-26-27-0001', type: 'Invoice', customerId: 'C-1', date: '2026-11-12', due: '2026-11-26', gst: true, status: 'Pending',
  seller: { name: '' }, buyer: { name: '' },
  items: [{ productId: 'P-1', name: '', qty: 2, price: 500, gst: 18, hsn: undefined, unit: 'Nos', discount: 0 }]
};

test('an intra-state GST invoice splits tax into CGST and SGST', () => {
  const details = documentDetails(invoice, { customer, products, organization });
  assert.equal(details.tax.interState, false);
  assert.equal(details.tax.cgst, 90);
  assert.equal(details.tax.sgst, 90);
  assert.equal(details.tax.total, 1180);
  const html = documentHtml(invoice, details);
  assert.match(html, /Tax Invoice/);
  assert.match(html, /HSN/);
  assert.match(html, /8421/);
  assert.match(html, /One Thousand One Hundred Eighty/);
  assert.match(html, /Asha RO &lt;Services&gt;/, 'business name is escaped');
});

test('a quotation is titled and labelled as a quotation', () => {
  const quotation = { ...invoice, id: 'QT-26-27-0001', type: 'Quotation' };
  const html = documentHtml(quotation, documentDetails(quotation, { customer, products, organization }));
  assert.match(html, /<h1>Quotation<\/h1>/);
  assert.match(html, /Valid until/);
});

test('the invoice register lists invoices only, oldest first', () => {
  const later = { ...invoice, id: 'INV-26-27-0002', date: '2026-11-20' };
  const quotation = { ...invoice, id: 'QT-1', type: 'Quotation' };
  const rows = invoiceRegisterRows([later, quotation, invoice], doc => documentDetails(doc, { customer, products, organization }));
  assert.deepEqual(rows.map(row => row[0]), ['INV-26-27-0001', 'INV-26-27-0002']);
  assert.equal(rows[0][10], 1180);
});

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
