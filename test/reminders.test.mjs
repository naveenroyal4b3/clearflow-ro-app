import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, firstServiceDate, monthReport, serviceDue, unpaidInvoices, whatsappLink } from '../src/reminders.js';

test('addMonths keeps the day where the month has it', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-05-10', 12), '2027-05-10');
});

test('the first service date is moved on until it is not in the past', () => {
  assert.equal(firstServiceDate('2025-01-10', 6, '2026-11-24'), '2027-01-10');
  assert.equal(firstServiceDate('', 3, '2026-11-24'), '2027-02-24');
});

test('service due lists customers due within a week, soonest first, unless a visit is booked', () => {
  const customers = [
    { id: 'A', nextService: '2026-11-30' },
    { id: 'B', nextService: '2026-11-20' },
    { id: 'C', nextService: '2026-12-20' },
    { id: 'D', nextService: '' },
    { id: 'E', nextService: '2026-11-25' }
  ];
  const jobs = [{ customerId: 'E', status: 'Scheduled' }];
  const due = serviceDue(customers, jobs, '2026-11-24');
  assert.deepEqual(due.map(item => item.customer.id), ['B', 'A']);
  assert.equal(due[0].daysLeft, -4);
});

test('unpaid invoices skip paid, cancelled and quotations, and count days overdue', () => {
  const item = { productId: 'P', name: 'Filter', qty: 1, price: 100, gst: 18, discount: 0 };
  const documents = [
    { id: '1', type: 'Invoice', status: 'Pending', date: '2026-11-01', due: '2026-11-10', gst: true, items: [item] },
    { id: '2', type: 'Invoice', status: 'Paid', date: '2026-11-01', due: '', gst: true, items: [item] },
    { id: '3', type: 'Quotation', status: 'Draft', date: '2026-11-01', due: '', gst: true, items: [item] },
    { id: '4', type: 'Invoice', status: 'Cancelled', date: '2026-11-01', due: '', gst: true, items: [item] }
  ];
  const unpaid = unpaidInvoices(documents, '2026-11-24');
  assert.deepEqual(unpaid.map(entry => entry.doc.id), ['1']);
  assert.equal(unpaid[0].daysOverdue, 14);
  assert.equal(unpaid[0].amount, 118);
});

test('WhatsApp links add 91 to Indian numbers and skip sample zeros', () => {
  assert.equal(whatsappLink('98480 12345'), 'https://wa.me/919848012345');
  assert.equal(whatsappLink('+44 7700 900123', 'Hi'), 'https://wa.me/447700900123?text=Hi');
  assert.equal(whatsappLink('00000 00001'), '');
});

test('the month report adds up invoices, collections and the best sellers', () => {
  const item = (productId, name, qty, price) => ({ productId, name, qty, price, gst: 0, discount: 0 });
  const data = {
    customers: [{ id: 'C1', name: 'Ravi' }, { id: 'C2', name: 'Hotel' }],
    jobs: [{ date: '2026-11-03', status: 'Completed' }, { date: '2026-11-20', status: 'Scheduled' }, { date: '2026-10-03', status: 'Completed' }],
    documents: [
      { type: 'Invoice', status: 'Paid', date: '2026-11-02', customerId: 'C1', gst: false, items: [item('P1', 'AC', 1, 30000)] },
      { type: 'Invoice', status: 'Pending', date: '2026-11-05', customerId: 'C2', gst: false, items: [item('P2', 'Filter', 2, 500)] },
      { type: 'Invoice', status: 'Cancelled', date: '2026-11-06', customerId: 'C2', gst: false, items: [item('P2', 'Filter', 9, 500)] },
      { type: 'Quotation', status: 'Draft', date: '2026-11-07', customerId: 'C2', gst: false, items: [item('P1', 'AC', 1, 30000)] }
    ]
  };
  const report = monthReport(data, '2026-11');
  assert.equal(report.sales, 31000);
  assert.equal(report.collected, 30000);
  assert.equal(report.pending, 1000);
  assert.equal(report.invoices, 2);
  assert.equal(report.quotations, 1);
  assert.equal(report.jobsDone, 1);
  assert.equal(report.jobsOpen, 1);
  assert.deepEqual(report.topProducts.map(entry => entry.name), ['AC', 'Filter']);
  assert.deepEqual(report.topCustomers[0], { name: 'Ravi', amount: 30000 });
});
