// Service-due and payment reminders and the monthly business report, shared by the web and native
// apps. Dates are 'YYYY-MM-DD' strings in the business's local time.
import { taxBreakup } from './gst.js';

const DAY = 24 * 60 * 60 * 1000;
const parse = date => new Date(`${date}T00:00:00Z`);
const format = date => date.toISOString().slice(0, 10);

export function daysBetween(from, to) {
  return Math.round((parse(to) - parse(from)) / DAY);
}

// Adds whole months, keeping the day where the month has it (31 Jan + 1 month = 28/29 Feb).
export function addMonths(date, months) {
  const start = parse(date);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return format(target);
}

// The first next-service date for a customer: from the installation date (or today) by the
// interval, moved on until it is today or later.
export function firstServiceDate(installed, months, today) {
  let next = addMonths(installed || today, months);
  for (let guard = 0; next < today && guard < 600; guard++) next = addMonths(next, months);
  return next;
}

// Customers with a next service date within `days` days (or overdue), soonest first. A customer
// who already has an open (scheduled or in progress) job is left out: the visit is booked.
export function serviceDue(customers, jobs, today, days = 7) {
  const limit = format(new Date(parse(today).getTime() + days * DAY));
  const booked = new Set(jobs.filter(job => job.status === 'Scheduled' || job.status === 'In progress').map(job => job.customerId));
  return customers
    .filter(customer => customer.nextService && customer.nextService <= limit && !booked.has(customer.id))
    .map(customer => ({ customer, due: customer.nextService, daysLeft: daysBetween(today, customer.nextService) }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

// AMC contracts that end within `days` days or ended in the last 60 days and have not been renewed
// (no later contract for the same customer and appliance), soonest first.
export function amcRenewals(contracts, today, days = 30) {
  const limit = format(new Date(parse(today).getTime() + days * DAY));
  const since = format(new Date(parse(today).getTime() - 60 * DAY));
  const renewed = contract => contracts.some(other => other.id !== contract.id && other.status !== 'Cancelled'
    && other.customerId === contract.customerId && other.appliance === contract.appliance && other.start > contract.start);
  return contracts
    .filter(contract => contract.status !== 'Cancelled' && contract.end <= limit && contract.end >= since && !renewed(contract))
    .map(contract => ({ contract, daysLeft: daysBetween(today, contract.end) }))
    .sort((a, b) => a.contract.end.localeCompare(b.contract.end));
}

// A contract is running when today falls between its start and end dates.
export function amcActive(contract, today) {
  return contract.status !== 'Cancelled' && contract.start <= today && contract.end >= today;
}

// The renewal of a contract: the next year (same length), the same amount and visits.
export function amcRenewal(contract) {
  const lengthDays = daysBetween(contract.start, contract.end);
  const start = format(new Date(parse(contract.end).getTime() + DAY));
  return { ...contract, id: '', start, end: format(new Date(parse(start).getTime() + lengthDays * DAY)), visitsUsed: 0, status: 'Active', notes: '' };
}

// The total of a purchase bill and the GST paid on it (input tax).
export function purchaseTotals(bill) {
  const lines = bill.items.map(item => ({ productId: item.productId, qty: item.qty, price: item.rate, gst: item.gst, discount: 0 }));
  const breakup = taxBreakup(lines, { gstEnabled: bill.gst });
  return { taxable: breakup.taxable, tax: Math.round((breakup.total - breakup.taxable) * 100) / 100, total: breakup.total };
}

export function documentTotal(doc) {
  return taxBreakup(doc.items || [], { gstEnabled: doc.gst }).total;
}

// Invoices not yet paid or cancelled, oldest due first. daysOverdue is 0 or more once the due
// date (or, without one, the invoice date) has passed.
export function unpaidInvoices(documents, today) {
  return documents
    .filter(doc => doc.type === 'Invoice' && doc.status !== 'Paid' && doc.status !== 'Cancelled')
    .map(doc => {
      const due = doc.due || doc.date;
      return { doc, due, amount: documentTotal(doc), daysOverdue: daysBetween(due, today) };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

// A wa.me link; Indian 10-digit numbers get the 91 country code.
export function whatsappLink(phone, text = '') {
  // Leading zeros are a trunk prefix; what remains must look like a real number (the sample
  // customers' all-zero numbers don't).
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 8) return '';
  const number = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// The owner's report for one month ('YYYY-MM'): sales from invoices that aren't cancelled, what
// has been collected, service work and the best products and customers by sales.
export function monthReport(data, month) {
  const invoices = data.documents.filter(doc => doc.type === 'Invoice' && doc.status !== 'Cancelled' && doc.date.startsWith(month));
  const quotations = data.documents.filter(doc => doc.type === 'Quotation' && doc.status !== 'Cancelled' && doc.date.startsWith(month));
  let sales = 0;
  let tax = 0;
  let collected = 0;
  const byProduct = new Map();
  const byCustomer = new Map();
  for (const doc of invoices) {
    const bill = taxBreakup(doc.items || [], { gstEnabled: doc.gst });
    sales += bill.total;
    tax += bill.total - bill.taxable;
    if (doc.status === 'Paid') collected += bill.total;
    byCustomer.set(doc.customerId, (byCustomer.get(doc.customerId) || 0) + bill.total);
    bill.rows.forEach(row => {
      const key = row.productId || row.name;
      const current = byProduct.get(key) || { name: row.name, qty: 0, amount: 0 };
      current.qty += Number(row.qty) || 0;
      current.amount += row.total;
      byProduct.set(key, current);
    });
  }
  const jobs = data.jobs.filter(job => job.date.startsWith(month));
  const purchases = (data.purchases || []).filter(bill => bill.date.startsWith(month)).map(purchaseTotals);
  const purchased = purchases.reduce((sum, bill) => sum + bill.total, 0);
  const inputTax = purchases.reduce((sum, bill) => sum + bill.tax, 0);
  const customerName = id => data.customers.find(item => item.id === id)?.name || '';
  const round = value => Math.round(value * 100) / 100;
  return {
    sales: round(sales),
    tax: round(tax),
    collected: round(collected),
    pending: round(sales - collected),
    invoices: invoices.length,
    purchases: purchases.length,
    purchased: round(purchased),
    inputTax: round(inputTax),
    quotations: quotations.length,
    jobsDone: jobs.filter(job => job.status === 'Completed').length,
    jobsOpen: jobs.filter(job => job.status === 'Scheduled' || job.status === 'In progress').length,
    topProducts: [...byProduct.values()].sort((a, b) => b.amount - a.amount).slice(0, 5).map(item => ({ ...item, amount: round(item.amount) })),
    topCustomers: [...byCustomer.entries()].map(([id, amount]) => ({ name: customerName(id), amount: round(amount) })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  };
}
