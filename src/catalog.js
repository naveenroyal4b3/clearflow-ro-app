// @ts-check
// The ready-made product catalogue: water purifier models and RO spare parts sold in India, by brand.
// Shared by the web app and the native app. A business picks an item to start a product with its
// name, category, HSN code, GST rate and unit filled in, then enters its own prices and stock.
// The items live in catalog-data.js; add new models there.
import items from './catalog-data.js';

/** @typedef {{ brand: string, name: string, category: 'Purifiers' | 'Accessories' | 'Spare parts', hsn: string, gst: number, unit: string }} CatalogItem */

/** @type {CatalogItem[]} */
export const catalog = items;

// Brands A–Z, with unbranded (Generic) parts last.
export const catalogBrands = [...new Set(catalog.map(item => item.brand))]
  .sort((a, b) => Number(a === 'Generic') - Number(b === 'Generic') || a.localeCompare(b));

/** @param {string} text */
const normalise = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Items matching every word of the search, optionally of one brand and category.
 * @param {string} query
 * @param {{ brand?: string, category?: string }} [filters]
 */
export function searchCatalog(query, { brand, category } = {}) {
  const words = normalise(query).split(' ').filter(Boolean);
  return catalog.filter(item => {
    if (brand && item.brand !== brand) return false;
    if (category && item.category !== category) return false;
    const text = normalise(`${item.brand} ${item.name}`);
    return words.every(word => text.includes(word));
  });
}

/** @param {string} name */
export function catalogItem(name) {
  return catalog.find(item => item.name === name);
}
