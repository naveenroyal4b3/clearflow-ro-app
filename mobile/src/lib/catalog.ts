// The ready-made product catalogue shared with the web app (../src/catalog.js).
export type CatalogItem = { brand: string; name: string; category: 'Purifiers' | 'Accessories' | 'Spare parts'; hsn: string; gst: number; unit: string };

type CatalogModule = {
  catalog: CatalogItem[];
  catalogBrands: string[];
  searchCatalog: (query: string, filters?: { brand?: string; category?: string }) => CatalogItem[];
  catalogItem: (name: string) => CatalogItem | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shared: CatalogModule = require('../../../src/catalog.js');
export const { catalog, catalogBrands, searchCatalog, catalogItem } = shared;
