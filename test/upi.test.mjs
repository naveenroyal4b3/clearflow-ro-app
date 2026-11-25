import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentDetails, documentHtml } from '../src/documents.js';
import { validUpi } from '../src/gst.js';

const organization = { name: 'Sai Services', gstin: '', address: 'Tirupati', state_code: '37', phone: '9848012345', upi_id: 'sai@okhdfcbank' };
const products = [{ id: 'P1', name: 'Filter', hsn: '8421' }];
const invoice = status => ({ id: 'INV-1', type: 'Invoice', status, customerId: 'C1', date: '2026-11-25', due: '', gst: false, items: [{ productId: 'P1', name: 'Filter', qty: 1, price: 500, gst: 18, discount: 0 }] });
const html = (doc, org = organization) => documentHtml(doc, documentDetails(doc, { customer: { name: 'Ravi', address: '', gstin: '', state: '37' }, products, organization: org }));

test('UPI IDs are checked', () => {
  assert.equal(validUpi(' sai@okhdfcbank '), 'sai@okhdfcbank');
  assert.equal(validUpi('9848012345@ybl'), '9848012345@ybl');
  assert.equal(validUpi('not an id'), '');
  assert.equal(validUpi('@ybl'), '');
});

test('an unpaid invoice carries a scan-to-pay QR code for the amount', () => {
  const page = html(invoice('Pending'));
  assert.match(page, /<svg/);
  assert.match(page, /Scan to pay ₹500\.00/);
  assert.match(page, /UPI ID: sai@okhdfcbank/);
});

test('no QR code on paid invoices, quotations or without a UPI ID', () => {
  assert.doesNotMatch(html(invoice('Paid')), /Scan to pay/);
  assert.doesNotMatch(html({ ...invoice('Draft'), type: 'Quotation' }), /Scan to pay/);
  assert.doesNotMatch(html(invoice('Pending'), { ...organization, upi_id: '' }), /Scan to pay/);
});
