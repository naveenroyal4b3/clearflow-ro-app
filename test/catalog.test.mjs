import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, catalogBrands, catalogItem, searchCatalog } from '../src/catalog.js';

test('every catalogue item is complete and valid for a GST invoice', () => {
  assert.ok(catalog.length > 100);
  const names = new Set();
  for (const item of catalog) {
    assert.ok(item.brand && item.name, JSON.stringify(item));
    assert.ok(!names.has(item.name.toLowerCase()), `duplicate: ${item.name}`);
    names.add(item.name.toLowerCase());
    assert.ok(['Purifiers', 'Accessories', 'Spare parts'].includes(item.category), item.name);
    assert.match(item.hsn, /^\d{4,8}$/, item.name);
    assert.ok([0, 5, 12, 18, 28].includes(item.gst), item.name);
    assert.ok(['Nos', 'Pcs', 'Set', 'Box', 'Kg', 'Ltr', 'Mtr'].includes(item.unit), item.name);
    // Product names are limited to what the database accepts and fit on an invoice line.
    assert.ok(item.name.length <= 120, item.name);
  }
});

test('search matches every word, by brand and category', () => {
  const [first] = catalog;
  assert.equal(catalogItem(first.name), first);
  assert.ok(searchCatalog(first.name.toLowerCase()).includes(first));
  assert.ok(searchCatalog('', { brand: first.brand }).every(item => item.brand === first.brand));
  assert.ok(searchCatalog('', { category: 'Spare parts' }).every(item => item.category === 'Spare parts'));
  assert.deepEqual(searchCatalog('no such product zzz'), []);
  assert.equal(catalogBrands.at(-1), 'Generic');
});

test('every appliance and part type has catalogue items, and RO items keep their drawings', async () => {
  const { productKind, productKinds } = await import('../src/product-icons.js');
  const kinds = new Set(catalog.map(productKind));
  for (const kind of productKinds) assert.ok(kinds.has(kind), `no catalogue item for ${kind}`);
  // Every water purifier model from before home appliances were added still shows a purifier.
  const purifiers = catalog.filter(item => item.category === 'Purifiers' && item.brand !== 'Generic');
  assert.ok(purifiers.length > 200);
  for (const item of purifiers) assert.equal(productKind(item), 'purifier', item.name);
  assert.equal(productKind({ name: 'Split AC 1.5 ton 3 star inverter', category: 'Purifiers' }), 'ac');
  assert.equal(productKind({ name: 'Home inverter 900 VA', category: 'Purifiers' }), 'inverter');
  assert.equal(productKind({ name: 'Visi cooler 300 L', category: 'Purifiers' }), 'fridge');
  assert.equal(productKind({ name: 'Water cooler with RO 40 L', category: 'Purifiers' }), 'purifier');
  assert.equal(productKind({ name: 'Fan room heater 2000 W', category: 'Purifiers' }), 'heater');
  assert.equal(productKind({ name: 'Refrigerant gas R32', category: 'Spare parts' }), 'gas');
  assert.equal(productKind({ name: 'Fridge door gasket', category: 'Spare parts' }), 'part');
});
