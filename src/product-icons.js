// @ts-check
// Pictures for products without a photo, picked from the product's type. Shared by the web app
// and the native app (drawn there with react-native-svg).

/** @type {[string, RegExp][]} */
const rules = [
  ['kit', /\bkit\b/],
  ['membrane', /membrane/],
  ['pump', /\bpump/],
  ['adapter', /smps|adapter|ballast|choke|power supply/],
  ['uv', /\buv\b|ultraviolet/],
  ['meter', /meter|tester/],
  ['tap', /\btap\b|faucet/],
  ['tank', /\btank/],
  ['valve', /valve|switch|restrictor|controller|\bnrv\b|\blps\b|\bhps\b|\baco\b/],
  ['pipe', /pipe|tube|connector|fitting|elbow|\btee\b|push.?fit/],
  ['filter', /filter|cartridge|candle|sediment|carbon|\bgac\b|mineral|alkaline|copper|zinc|antiscalant|iron|\buf\b|housing/]
];

/**
 * The kind of icon for a product.
 * @param {{ name: string, category: string }} product
 */
export function productKind({ name, category }) {
  if (category === 'Purifiers') return 'purifier';
  const text = name.toLowerCase();
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'part';
}

/**
 * Free-licence photos of some product types, served by the website from public/type-photos. Their
 * licences need the credit shown wherever they can appear (the catalogue).
 * @type {Record<string, { file: string, credit: string, link: string }>}
 */
export const builtInTypePhotos = {
  filter: { file: 'type-photos/filter.jpg', credit: 'Filter: Public Domain Photos, CC BY 2.0', link: 'https://www.flickr.com/photos/28958738@N06/6861363972' },
  meter: { file: 'type-photos/meter.jpg', credit: 'TDS meter: Spotless property, CC BY-SA 3.0', link: 'https://commons.wikimedia.org/wiki/File:Tds-meter.jpg' }
};

/**
 * The shared catalogue photo for a product without its own: the photo of its catalogue model, or
 * else of its type, or else a built-in photo of its type. Empty when there is none.
 * @param {{ name: string, category: string }} product
 * @param {Record<string, string>} photos links by key, from loadCatalogPhotos
 * @param {string} [builtInBase] the website's address, ending in '/', for the built-in photos
 */
export function catalogPhotoUrl(product, photos, builtInBase = '') {
  const kind = productKind(product);
  const builtIn = builtInTypePhotos[kind];
  return photos[product.name] || photos[`type:${kind}`] || (builtIn && builtInBase ? builtInBase + builtIn.file : '');
}

/**
 * Credits for the built-in photos the given products can show.
 * @param {{ name: string, category: string }[]} products
 */
export function photoCredits(products) {
  const kinds = new Set(products.map(productKind));
  return Object.entries(builtInTypePhotos).filter(([kind]) => kinds.has(kind)).map(([, photo]) => photo);
}


// Colour drawings of each product type, shown in place of a photo. Flat colours only (no gradient
// ids), so many can sit on one web page and react-native-svg draws them the same way.
const o = 'stroke="#3d5566" stroke-width="1.3" stroke-linejoin="round"';
/** @type {Record<string, string>} */
const art = {
  purifier: `<rect x="15" y="6" width="34" height="44" rx="5" fill="#f5f8fa" ${o}/><rect x="15" y="6" width="34" height="11" rx="5" fill="#1f5f99" ${o}/><rect x="21" y="22" width="22" height="18" rx="3" fill="#d9ecfa" ${o}/><rect x="22.5" y="30" width="19" height="8.5" rx="2" fill="#5aa9e6"/><circle cx="39" cy="11.5" r="2" fill="#7fe0a0"/><rect x="20" y="10" width="12" height="3" rx="1.5" fill="#fff" opacity=".7"/><path d="M29 50v4h6v-4" fill="#c9d3da" ${o}/><path d="M32 54v3.5" stroke="#5aa9e6" stroke-width="2" stroke-linecap="round"/><path d="M18 19v28" stroke="#fff" stroke-width="2" opacity=".6"/>`,
  membrane: `<rect x="6" y="22" width="52" height="20" rx="10" fill="#f2f5f7" ${o}/><rect x="6" y="22" width="9" height="20" rx="4.5" fill="#2f6fb0" ${o}/><rect x="49" y="22" width="9" height="20" rx="4.5" fill="#2f6fb0" ${o}/><rect x="22" y="25" width="20" height="14" rx="1.5" fill="#fff" stroke="#9fb3c2" stroke-width="1"/><path d="M25 29h14M25 32h10M25 35h12" stroke="#2f6fb0" stroke-width="1.4" stroke-linecap="round"/><path d="M2 32h4M58 32h4" stroke="#3d5566" stroke-width="2.5" stroke-linecap="round"/><path d="M16 25.5h5M43 25.5h5" stroke="#fff" stroke-width="2"/>`,
  filter: `<rect x="22" y="12" width="20" height="40" rx="3" fill="#f2f5f7" ${o}/><rect x="21" y="8" width="22" height="7" rx="2" fill="#2f8fd8" ${o}/><rect x="21" y="49" width="22" height="7" rx="2" fill="#2f8fd8" ${o}/><path d="M32 8V3M32 61v-5" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><rect x="25" y="22" width="14" height="20" rx="1.5" fill="#fff" stroke="#9fb3c2" stroke-width="1"/><path d="M28 27h8M28 31h6M28 35h8" stroke="#2f8fd8" stroke-width="1.4" stroke-linecap="round"/><path d="M24 16v4M24 44v3" stroke="#fff" stroke-width="2"/>`,
  pump: `<rect x="5" y="22" width="30" height="24" rx="5" fill="#4a5560" ${o}/><path d="M10 23v22M15 23v22" stroke="#36404a" stroke-width="1.2"/><rect x="11" y="46" width="22" height="4" rx="1.5" fill="#2b3138"/><rect x="33" y="18" width="18" height="32" rx="4" fill="#20262c" ${o}/><circle cx="42" cy="34" r="6" fill="#39424b" stroke="#566370" stroke-width="1.2"/><path d="M51 25h7M51 43h7" stroke="#3d5566" stroke-width="6" stroke-linecap="round"/><path d="M51 25h7M51 43h7" stroke="#e8edf1" stroke-width="4" stroke-linecap="round"/><rect x="18" y="27" width="12" height="8" rx="1" fill="#e9eef2"/><path d="M20 30h8M20 32.5h5" stroke="#4a5560" stroke-width="1"/><path d="M8 25h24" stroke="#fff" stroke-width="1.6" opacity=".3"/>`,
  adapter: `<path d="M18 18v-6M28 18v-6" stroke="#b9c3cb" stroke-width="3" stroke-linecap="round"/><rect x="8" y="18" width="34" height="26" rx="4" fill="#2b3138" ${o}/><path d="M11 21h28" stroke="#fff" stroke-width="1.5" opacity=".25"/><rect x="14" y="26" width="18" height="10" rx="1" fill="#e9eef2"/><path d="M16 29h14M16 32h9" stroke="#2b3138" stroke-width="1"/><circle cx="37" cy="38" r="1.8" fill="#57e389"/><path d="M42 31h6c6 0 8 4 8 9v10" fill="none" stroke="#2b3138" stroke-width="3" stroke-linecap="round"/><rect x="52.5" y="49" width="7" height="8" rx="1.5" fill="#3a424a" ${o}/>`,
  uv: `<rect x="24" y="12" width="5" height="8" fill="#c9d3da" ${o}/><rect x="40" y="38" width="5" height="8" fill="#c9d3da" ${o}/><rect x="10" y="20" width="44" height="18" rx="9" fill="#dfe6ec" ${o}/><path d="M16 23h32" stroke="#fff" stroke-width="2" opacity=".9"/><rect x="2" y="25.5" width="8" height="7" rx="1.5" fill="#2b3138" ${o}/><rect x="14" y="27" width="34" height="4" rx="2" fill="#b27cf0"/><rect x="16" y="28" width="30" height="1.4" rx=".7" fill="#f0e6ff"/><path d="M18 45l-3 5M30 46v6M50 44l3 5" stroke="#9b5de5" stroke-width="2" stroke-linecap="round"/>`,
  valve: `<path d="M27 10V6M37 10V6" stroke="#d94848" stroke-width="2" stroke-linecap="round"/><rect x="20" y="10" width="24" height="24" rx="3" fill="#20262c" ${o}/><path d="M23 13h18" stroke="#fff" stroke-width="1.5" opacity=".25"/><rect x="25" y="17" width="14" height="8" rx="1" fill="#e9eef2"/><path d="M27 20h10M27 22.5h6" stroke="#20262c" stroke-width="1"/><path d="M4 41h10M50 41h10" stroke="#2f8fd8" stroke-width="5" stroke-linecap="round"/><rect x="14" y="34" width="36" height="14" rx="3" fill="#f2f5f7" ${o}/><path d="M17 37h30" stroke="#fff" stroke-width="1.6"/>`,
  tap: `<path d="M24 52V22c0-9 6-14 14-14s13 5 13 13v6" fill="none" stroke="#3d5566" stroke-width="7" stroke-linecap="round"/><path d="M24 52V22c0-9 6-14 14-14s13 5 13 13v6" fill="none" stroke="#dfe6ec" stroke-width="4.6" stroke-linecap="round"/><path d="M23.5 46V23c0-7 5-12.5 12-13" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><rect x="47" y="27" width="8" height="5" rx="1.5" fill="#c9d3da" ${o}/><path d="M51 36v3M51 43v3" stroke="#5aa9e6" stroke-width="2.4" stroke-linecap="round"/><rect x="14" y="50" width="20" height="7" rx="2" fill="#c9d3da" ${o}/><rect x="13" y="34" width="9" height="5" rx="2" fill="#2f6fb0" ${o}/>`,
  tank: `<rect x="28" y="6" width="8" height="8" rx="1" fill="#c9d3da" ${o}/><path d="M36 9h8" stroke="#d94848" stroke-width="3" stroke-linecap="round"/><path d="M25 57v4M39 57v4" stroke="#3d5566" stroke-width="2.5" stroke-linecap="round"/><rect x="14" y="14" width="36" height="44" rx="14" fill="#f5f8fa" ${o}/><rect x="14.7" y="30" width="34.6" height="12" fill="#2f6fb0"/><path d="M14.7 30h34.6M14.7 42h34.6" stroke="#3d5566" stroke-width="1.3"/><path d="M19 22v6M19 45v6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M22 36h20" stroke="#fff" stroke-width="1.4" opacity=".7"/>`,
  pipe: `<circle cx="26" cy="34" r="17" fill="none" stroke="#3d5566" stroke-width="6.4"/><circle cx="26" cy="34" r="17" fill="none" stroke="#5aa9e6" stroke-width="4"/><circle cx="26" cy="34" r="10" fill="none" stroke="#3d5566" stroke-width="6.4"/><circle cx="26" cy="34" r="10" fill="none" stroke="#5aa9e6" stroke-width="4"/><path d="M43 34h4" stroke="#5aa9e6" stroke-width="4"/><path d="M48 26h7a3 3 0 0 1 3 3v9h-10z" fill="#f2f5f7" ${o}/><rect x="45" y="31" width="5" height="6" rx="1" fill="#2f6fb0" ${o}/><rect x="53" y="38" width="6" height="5" rx="1" fill="#2f6fb0" ${o}/><path d="M14 25a15 15 0 0 1 9-7" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  meter: `<path d="M29 48v9M35 48v9" stroke="#8a98a3" stroke-width="2" stroke-linecap="round"/><rect x="22" y="4" width="20" height="44" rx="6" fill="#f5f8fa" ${o}/><rect x="22" y="38" width="20" height="10" rx="3" fill="#2f6fb0" ${o}/><rect x="26" y="10" width="12" height="9" rx="1.5" fill="#cfe8c9" stroke="#3d5566" stroke-width="1"/><text x="32" y="17.2" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" text-anchor="middle" fill="#25402a">120</text><circle cx="32" cy="27" r="3" fill="#2f6fb0"/><text x="32" y="35" font-family="Arial, sans-serif" font-size="4.5" font-weight="700" text-anchor="middle" fill="#3d5566">TDS</text><path d="M24.5 10v26" stroke="#fff" stroke-width="1.6"/>`,
  kit: `<rect x="18" y="5" width="9" height="22" rx="2" fill="#f2f5f7" ${o}/><rect x="18" y="5" width="9" height="4" rx="1.5" fill="#2f8fd8"/><rect x="29" y="2" width="9" height="24" rx="2" fill="#f2f5f7" ${o}/><rect x="29" y="2" width="9" height="4" rx="1.5" fill="#2f8fd8"/><rect x="40" y="8" width="8" height="18" rx="2" fill="#2b3138" ${o}/><path d="M8 26l24 9v26l-24-9z" fill="#d8a96a"/><path d="M32 35l24-9v26l-24 9z" fill="#c4924f"/><path d="M8 26l24-10 24 10v26l-24 9-24-9zM8 26l24 9 24-9M32 35v26" fill="none" ${o}/><path d="M13 36l14 5.2v6L13 42z" fill="#fff" opacity=".85"/>`,
  part: `<circle cx="27" cy="30" r="15" fill="none" stroke="#3d5566" stroke-width="7.4"/><circle cx="27" cy="30" r="15" fill="none" stroke="#2b3138" stroke-width="5"/><path d="M18 21a13 13 0 0 1 10-5" stroke="#7b8792" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M40 40h10l6 6v8H44l-4-4z" fill="#f2f5f7" ${o}/><circle cx="48.5" cy="48.5" r="3" fill="#2f6fb0"/><rect x="8" y="48" width="22" height="7" rx="3.5" fill="#f2f5f7" ${o}/><rect x="8" y="48" width="6" height="7" rx="3" fill="#2f6fb0" ${o}/><rect x="24" y="48" width="6" height="7" rx="3" fill="#2f6fb0" ${o}/>`
};

/**
 * A colour drawing of the product's type, for a product without any photo.
 * @param {{ name: string, category: string }} product
 */
export function productArtSvg(product) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="art" aria-hidden="true">${art[productKind(product)]}</svg>`;
}

/** Product types, for setting a photo per type. */
export const productKinds = Object.keys(art);
