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
