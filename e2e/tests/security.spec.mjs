// Checks the database's row-level security directly, the way a tampered app or script would call it.
import { createClient } from '@supabase/supabase-js';
import { test, expect, uniqueEmail, password } from './helpers.mjs';

const url = process.env.E2E_SUPABASE_URL;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.E2E_SECRET_KEY, options);

async function signedIn(email) {
  const client = createClient(url, process.env.E2E_PUBLISHABLE_KEY, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function member(organizationId, role, customerId = null) {
  const email = uniqueEmail(role);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const update = await admin.from('profiles').update({ organization_id: organizationId, role, customer_id: customerId }).eq('user_id', data.user.id);
  if (update.error) throw update.error;
  return { id: data.user.id, client: await signedIn(email) };
}

let business;

test.beforeAll(async () => {
  const ownerEmail = uniqueEmail('owner');
  const created = await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  if (created.error) throw created.error;
  const owner = await signedIn(ownerEmail);
  const { data: organizationId, error } = await owner.rpc('create_organization', { organization_name: 'Security RO' });
  if (error) throw error;
  const must = result => { if (result.error) throw result.error; };
  must(await owner.from('customers').insert([
    { organization_id: organizationId, id: 'C-1', name: 'Customer One', phone: '1' },
    { organization_id: organizationId, id: 'C-2', name: 'Customer Two', phone: '2' }
  ]));
  must(await owner.from('products').insert({ organization_id: organizationId, id: 'P-1', name: 'Filter', category: 'Spare parts', stock: 10 }));
  must(await owner.from('product_prices').insert(['customer', 'technician', 'shop'].map((audience, index) => ({ organization_id: organizationId, product_id: 'P-1', audience, amount: 300 - index * 50 }))));
  for (const customerId of ['C-1', 'C-2']) {
    must(await owner.rpc('create_sales_document', { p_document_type: 'Invoice', p_customer_id: customerId, p_document_date: '2026-10-28', p_due_date: null, p_gst_enabled: true, p_line_items: [{ product_id: 'P-1', quantity: 1, unit_price: 300 }] }));
  }
  business = {
    organizationId,
    owner,
    technician: await member(organizationId, 'technician'),
    shop: await member(organizationId, 'shop'),
    customer: await member(organizationId, 'customer', 'C-1')
  };
});

test('each role reads only its own price tier', async () => {
  for (const role of ['technician', 'shop', 'customer']) {
    const { data } = await business[role].client.from('product_prices').select('audience');
    expect(data.map(row => row.audience)).toEqual([role]);
  }
});

test('customers see only their own customer record and invoices', async () => {
  const { client } = business.customer;
  expect((await client.from('customers').select('id')).data.map(row => row.id)).toEqual(['C-1']);
  const documents = (await client.from('sales_documents').select('customer_id')).data;
  expect(documents.map(row => row.customer_id)).toEqual(['C-1']);
});

test('shops and unassigned technicians cannot read customers', async () => {
  expect((await business.shop.client.from('customers').select('id')).data).toEqual([]);
  expect((await business.technician.client.from('customers').select('id')).data).toEqual([]);
});

test('only owners can change prices, products and customers', async () => {
  for (const role of ['technician', 'shop', 'customer']) {
    const { client } = business[role];
    await client.from('product_prices').update({ amount: 1 }).eq('product_id', 'P-1');
    await client.from('products').update({ stock: 0 }).eq('id', 'P-1');
    await client.from('customers').update({ name: 'Hacked' }).eq('id', 'C-1');
  }
  const { data: prices } = await admin.from('product_prices').select('amount').eq('organization_id', business.organizationId);
  expect(prices.map(row => Number(row.amount)).sort()).toEqual([200, 250, 300]);
  const { data: product } = await admin.from('products').select('stock').eq('organization_id', business.organizationId).single();
  expect(product.stock).toBe(8);
  const { data: customer } = await admin.from('customers').select('name').eq('organization_id', business.organizationId).eq('id', 'C-1').single();
  expect(customer.name).toBe('Customer One');
});

test('team members cannot promote themselves to owner', async () => {
  const { client, id } = business.technician;
  await client.from('profiles').update({ role: 'owner' }).eq('user_id', id);
  const { data } = await admin.from('profiles').select('role').eq('user_id', id).single();
  expect(data.role).toBe('technician');
});

test('only owners can create invoices', async () => {
  const { error } = await business.shop.client.rpc('create_sales_document', { p_document_type: 'Invoice', p_customer_id: 'C-1', p_document_date: '2026-10-28', p_due_date: null, p_gst_enabled: true, p_line_items: [{ product_id: 'P-1', quantity: 1, unit_price: 1 }] });
  expect(error?.message).toMatch(/only an owner/i);
});

test('the audit log records changes and only owners can read it', async () => {
  const { data: ownerView } = await business.owner.from('audit_log').select('table_name, action');
  expect(ownerView).toEqual(expect.arrayContaining([
    { table_name: 'customers', action: 'insert' },
    { table_name: 'sales_documents', action: 'insert' }
  ]));
  expect((await business.technician.client.from('audit_log').select('id')).data).toEqual([]);
});

test('app errors can be reported but not read back', async () => {
  const anonymous = createClient(url, process.env.E2E_PUBLISHABLE_KEY, options);
  expect((await anonymous.from('client_errors').insert({ message: 'e2e anonymous error' })).error).toBeNull();
  const message = `e2e signed-in error ${Date.now()}`;
  expect((await business.customer.client.from('client_errors').insert({ message })).error).toBeNull();
  expect((await business.owner.from('client_errors').select('id')).data).toEqual([]);
  const { data } = await admin.from('client_errors').select('user_id').eq('message', message).single();
  expect(data.user_id).toBe(business.customer.id);
});

test('nobody can read another business', async () => {
  const outsiderEmail = uniqueEmail('outsider');
  await admin.auth.admin.createUser({ email: outsiderEmail, password, email_confirm: true });
  const outsider = await signedIn(outsiderEmail);
  await outsider.rpc('create_organization', { organization_name: 'Other RO' });
  for (const table of ['customers', 'products', 'product_prices', 'sales_documents', 'audit_log']) {
    const { data } = await outsider.from(table).select('organization_id').eq('organization_id', business.organizationId);
    expect(data, table).toEqual([]);
  }
});
