import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amcActive, amcRenewal, amcRenewals, monthReport, purchaseTotals } from '../src/reminders.js';
import { gstDate, gstr1, placeOfSupply } from '../src/gstr1.js';
import { documentDetails } from '../src/documents.js';

const contract = (id, customerId, start, end, extra = {}) => ({ id, customerId, appliance: 'RO', start, end, amount: 1500, visits: 3, visitsUsed: 1, notes: '', status: 'Active', ...extra });

test('AMC renewals list contracts ending soon or recently ended, unless renewed or cancelled', () => {
  const contracts = [
    contract('A1', 'C1', '2025-12-10', '2026-12-09'),
    contract('A2', 'C2', '2025-11-01', '2026-10-31'),
    contract('A3', 'C3', '2025-11-20', '2026-11-19'),
    contract('A4', 'C3', '2026-11-20', '2027-11-19'),
    contract('A5', 'C4', '2025-12-01', '2026-11-30', { status: 'Cancelled' }),
    contract('A6', 'C5', '2026-06-01', '2027-05-31'),
    contract('A7', 'C6', '2025-01-01', '2025-12-31')
  ];
  const due = amcRenewals(contracts, '2026-11-25');
  assert.deepEqual(due.map(item => item.contract.id), ['A2', 'A1']);
  assert.equal(due[0].daysLeft, -25);
});

test('a renewal starts the day after and lasts as long', () => {
  const next = amcRenewal(contract('A1', 'C1', '2025-12-10', '2026-12-09'));
  assert.equal(next.start, '2026-12-10');
  assert.equal(next.end, '2027-12-09');
  assert.equal(next.visitsUsed, 0);
  assert.equal(next.id, '');
  assert.ok(amcActive(contract('A1', 'C1', '2025-12-10', '2026-12-09'), '2026-11-25'));
});

test('purchase totals add GST paid; the month report shows purchases', () => {
  const bill = { id: 'PB-1', supplierId: 'S1', billNumber: '77', date: '2026-11-03', gst: true, items: [{ productId: 'P1', qty: 10, rate: 100, gst: 18 }] };
  assert.deepEqual(purchaseTotals(bill), { taxable: 1000, tax: 180, total: 1180 });
  const report = monthReport({ customers: [], jobs: [], documents: [], purchases: [bill] }, '2026-11');
  assert.equal(report.purchases, 1);
  assert.equal(report.purchased, 1180);
  assert.equal(report.inputTax, 180);
});

test('GSTR-1 splits B2B and B2C sales and sums HSN', () => {
  assert.equal(placeOfSupply('37'), '37-Andhra Pradesh');
  assert.equal(gstDate('2026-11-05'), '05-Nov-2026');
  const organization = { name: 'Sai', gstin: '37AAAAA0000A1Z5', address: '', state_code: '37', phone: '' };
  const customers = [{ id: 'C1', name: 'Hotel', gstin: '36BBBBB1111B1Z6', state: '36', address: '' }, { id: 'C2', name: 'Ravi', gstin: '', state: '37', address: '' }];
  const products = [{ id: 'P1', name: 'Filter', hsn: '8421' }];
  const item = qty => ({ productId: 'P1', name: 'Filter', qty, price: 100, gst: 18, discount: 0, hsn: '8421', unit: 'Nos' });
  const documents = [
    { id: 'INV-1', type: 'Invoice', status: 'Paid', customerId: 'C1', date: '2026-11-02', due: '', gst: true, items: [item(2)] },
    { id: 'INV-2', type: 'Invoice', status: 'Pending', customerId: 'C2', date: '2026-11-04', due: '', gst: true, items: [item(1)] },
    { id: 'INV-3', type: 'Invoice', status: 'Cancelled', customerId: 'C2', date: '2026-11-05', due: '', gst: true, items: [item(9)] },
    { id: 'INV-4', type: 'Invoice', status: 'Pending', customerId: 'C2', date: '2026-10-30', due: '', gst: true, items: [item(9)] }
  ];
  const detailsFor = doc => documentDetails(doc, { customer: customers.find(c => c.id === doc.customerId), products, organization });
  const result = gstr1(documents, '2026-11', detailsFor);
  assert.equal(result.invoices, 2);
  const [b2b, b2cs, hsn] = result.files.map(file => file.text.trim().split('\r\n'));
  assert.equal(b2b.length, 2);
  assert.equal(b2b[1], '36BBBBB1111B1Z6,Hotel,INV-1,02-Nov-2026,236.00,36-Telangana,N,,Regular B2B,,18,200.00,0.00');
  assert.equal(b2cs[1], 'OE,37-Andhra Pradesh,18,,100.00,0.00,');
  assert.equal(hsn[1], '8421,Filter,NOS-NUMBERS,3,354.00,18,300.00,36.00,9.00,9.00,0.00');
});
