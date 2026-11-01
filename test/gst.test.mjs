import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords, stateFromGstin, stateLabel, taxBreakup } from '../src/gst.js';

const karnataka = '29';
const maharashtra = '27';

test('stateFromGstin reads the state code from a GSTIN', () => {
  assert.equal(stateFromGstin('29ABCDE1234F1Z5'), karnataka);
  assert.equal(stateFromGstin('25ABCDE1234F1Z5'), '', 'code 25 is no longer a state');
  assert.equal(stateFromGstin(''), '');
  assert.equal(stateFromGstin(null), '');
});

test('stateLabel shows the code and state name', () => {
  assert.match(stateLabel(karnataka), /^29 .+ Karnataka$/);
  assert.equal(stateLabel('99'), '');
});

test('a sale within the seller state splits GST into CGST and SGST', () => {
  const bill = taxBreakup([{ qty: 2, price: 1000, gst: 18 }], { gstEnabled: true, sellerState: karnataka, buyerState: karnataka });
  assert.equal(bill.interState, false);
  assert.deepEqual(
    { taxable: bill.taxable, cgst: bill.cgst, sgst: bill.sgst, igst: bill.igst, total: bill.total },
    { taxable: 2000, cgst: 180, sgst: 180, igst: 0, total: 2360 }
  );
});

test('a sale to another state charges IGST', () => {
  const bill = taxBreakup([{ qty: 2, price: 1000, gst: 18 }], { gstEnabled: true, sellerState: karnataka, buyerState: maharashtra });
  assert.equal(bill.interState, true);
  assert.equal(bill.placeOfSupply, maharashtra);
  assert.deepEqual({ cgst: bill.cgst, sgst: bill.sgst, igst: bill.igst, total: bill.total }, { cgst: 0, sgst: 0, igst: 360, total: 2360 });
});

test('a walk-in customer with no state is treated as a local sale', () => {
  const bill = taxBreakup([{ qty: 1, price: 500, gst: 12 }], { gstEnabled: true, sellerState: karnataka, buyerState: '' });
  assert.equal(bill.interState, false);
  assert.equal(bill.placeOfSupply, karnataka);
  assert.equal(bill.cgst + bill.sgst, 60);
});

test('no tax is charged when GST is turned off', () => {
  const bill = taxBreakup([{ qty: 3, price: 250, gst: 18 }], { gstEnabled: false, sellerState: karnataka, buyerState: maharashtra });
  assert.deepEqual({ cgst: bill.cgst, sgst: bill.sgst, igst: bill.igst, total: bill.total }, { cgst: 0, sgst: 0, igst: 0, total: 750 });
});

test('CGST and SGST always add up to the same tax as IGST, to the paisa', () => {
  const lines = [
    { qty: 3, price: 10.5, gst: 5 },
    { qty: 1, price: 0.05, gst: 18 },
    { qty: 7, price: 333.33, gst: 28 },
    { qty: 1, price: 99.99, gst: 12 }
  ];
  const local = taxBreakup(lines, { gstEnabled: true, sellerState: karnataka, buyerState: karnataka });
  const interState = taxBreakup(lines, { gstEnabled: true, sellerState: karnataka, buyerState: maharashtra });
  local.rows.forEach((row, i) => {
    assert.equal(Math.round((row.cgst + row.sgst) * 100), Math.round(interState.rows[i].igst * 100), `line ${i + 1}`);
    assert.equal(row.total, interState.rows[i].total, `line ${i + 1}`);
  });
});

test('bill totals are the sum of the line totals', () => {
  const bill = taxBreakup(
    [{ qty: 1, price: 15000, gst: 18 }, { qty: 4, price: 350, gst: 18 }, { qty: 1, price: 800, gst: 0 }],
    { gstEnabled: true, sellerState: karnataka, buyerState: karnataka }
  );
  assert.equal(bill.taxable, 17200);
  assert.equal(bill.total, bill.rows.reduce((sum, row) => sum + row.total, 0));
  assert.equal(bill.rows[2].cgst + bill.rows[2].sgst, 0);
});

test('a discount comes off the price before tax', () => {
  const bill = taxBreakup([{ qty: 2, price: 1000, gst: 18, discount: 200 }], { gstEnabled: true, sellerState: karnataka, buyerState: karnataka });
  assert.deepEqual(
    { discount: bill.discount, taxable: bill.taxable, cgst: bill.cgst, sgst: bill.sgst, total: bill.total },
    { discount: 200, taxable: 1800, cgst: 162, sgst: 162, total: 2124 }
  );
});

test('amountInWords uses lakh and crore and shows paise', () => {
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(11800), 'Rupees Eleven Thousand Eight Hundred Only');
  assert.equal(amountInWords(2360.5), 'Rupees Two Thousand Three Hundred Sixty and Fifty Paise Only');
  assert.equal(amountInWords(120000), 'Rupees One Lakh Twenty Thousand Only');
  assert.equal(amountInWords(12345678.09), 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Nine Paise Only');
  assert.equal(amountInWords(1500000000), 'Rupees One Hundred Fifty Crore Only');
  assert.equal(amountInWords(100), 'Rupees One Hundred Only');
});

test('a missing or invalid GST rate counts as zero', () => {
  const bill = taxBreakup([{ qty: 1, price: 100, gst: '' }, { qty: 1, price: 100, gst: 'abc' }], { gstEnabled: true, sellerState: karnataka, buyerState: karnataka });
  assert.equal(bill.total, 200);
});
