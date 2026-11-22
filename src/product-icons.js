// @ts-check
// Pictures for products without a photo, picked from the product's type. Shared by the web app
// and the native app (drawn there with react-native-svg).

/** @type {[string, RegExp][]} */
const rules = [
  ['kit', /\bkit\b/],
  ['compressor', /compressor/],
  ['gas', /refrigerant|\bgas\b/],
  ['capacitor', /capacitor/],
  ['remote', /\bremote\b/],
  ['motor', /\bmotor\b/],
  ['element', /heating element|heating coil|defrost heater|magnetron/],
  ['board', /\bpcb\b|\bboard\b|motherboard|thermostat|\btimer\b|\brelay\b|sensor|regulator/],
  ['membrane', /membrane/],
  ['pump', /\bpump/],
  ['adapter', /smps|adapter|ballast|choke|power supply/],
  ['uv', /\buv\b|ultraviolet/],
  ['meter', /meter|tester/],
  ['tap', /\btap\b|faucet/],
  ['tank', /\btank/],
  ['valve', /valve|switch|restrictor|controller|\bnrv\b|\blps\b|\bhps\b|\baco\b/],
  ['pipe', /pipe|tube|hose|connector|fitting|elbow|\btee\b|push.?fit/],
  ['filter', /filter|cartridge|candle|sediment|carbon|\bgac\b|mineral|alkaline|copper|zinc|antiscalant|iron|\buf\b|housing/]
];

// Appliances (the stored category 'Purifiers', shown as "Appliances"), checked in this order. A
// water purifier is matched first, and any appliance not listed here keeps the purifier drawing,
// as every product in this category had before home appliances were added.
/** @type {[string, RegExp][]} */
const applianceRules = [
  ['airpurifier', /air purifier|humidifier/],
  ['purifier', /\bro\b|purifier|\buv\b|\buf\b|water cooler|dispenser|\blph\b|softener|alkaline/],
  ['stabilizer', /stabili[sz]er/],
  ['ac', /\bac\b|air condition|\bton\b|\bsplit\b/],
  ['fridge', /refrigerator|fridge|freezer|visi cooler/],
  ['personal', /hair dryer|straightener|trimmer|shaver/],
  ['dishwasher', /dishwasher/],
  ['washer', /washing machine|washer|dryer/],
  ['microwave', /microwave|\botg\b|oven/],
  ['geyser', /geyser|water heater/],
  ['tv', /\btv\b|television|soundbar|home theatre|speaker/],
  ['chimney', /chimney/],
  ['cooler', /cooler/],
  ['heater', /heater/],
  ['fan', /\bfan\b/],
  ['mixer', /mixer|grinder|blender|juicer|food processor|chopper/],
  ['stove', /induction|cooktop|stove|\bhob\b|burner/],
  ['vacuum', /vacuum/],
  ['iron', /\biron\b|steamer/],
  ['kitchen', /kettle|toaster|sandwich|cooker|roti maker|air fryer|coffee/],
  ['pump', /\bpump\b/],
  ['inverter', /inverter|\bups\b|battery/]
];

/**
 * The kind of icon for a product.
 * @param {{ name: string, category: string }} product
 */
export function productKind({ name, category }) {
  const text = name.toLowerCase();
  if (category === 'Purifiers') return applianceRules.find(([, pattern]) => pattern.test(text))?.[0] || 'purifier';
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
  airpurifier: `<rect x="18" y="6" width="28" height="52" rx="6" fill="#f5f8fa" ${o}/><circle cx="32" cy="20" r="8" fill="#d9ecfa" ${o}/><path d="M26 20h12M32 14v12M27.8 15.8l8.4 8.4M36.2 15.8l-8.4 8.4" stroke="#5aa9e6" stroke-width="1.2"/><path d="M23 34h18M23 39h18M23 44h18M23 49h18" stroke="#9fb3c2" stroke-width="1.6" stroke-linecap="round"/><circle cx="40" cy="10.5" r="1.6" fill="#7fe0a0"/>`,
  ac: `<rect x="5" y="14" width="54" height="22" rx="5" fill="#f5f8fa" ${o}/><path d="M9 30h46" stroke="#9fb3c2" stroke-width="1.4"/><rect x="9" y="31.5" width="46" height="3" rx="1.5" fill="#dfe6ec"/><rect x="43" y="19" width="10" height="4" rx="1" fill="#2b3138"/><text x="48" y="22.3" font-family="Arial, sans-serif" font-size="3.4" font-weight="700" text-anchor="middle" fill="#7fe0a0">24°</text><path d="M16 42c-2 4 2 6 0 10M28 42c-2 4 2 6 0 10M40 42c-2 4 2 6 0 10" fill="none" stroke="#5aa9e6" stroke-width="2" stroke-linecap="round"/><path d="M10 18h26" stroke="#fff" stroke-width="2"/>`,
  fridge: `<rect x="16" y="4" width="32" height="56" rx="4" fill="#f5f8fa" ${o}/><path d="M16 24h32" stroke="#3d5566" stroke-width="1.3"/><rect x="40" y="10" width="3" height="9" rx="1.5" fill="#9fb3c2"/><rect x="40" y="29" width="3" height="14" rx="1.5" fill="#9fb3c2"/><path d="M19 8v12M19 28v28" stroke="#fff" stroke-width="2"/><rect x="18" y="58" width="6" height="3" fill="#3d5566"/><rect x="40" y="58" width="6" height="3" fill="#3d5566"/><circle cx="25" cy="14" r="2" fill="#5aa9e6"/>`,
  dishwasher: `<rect x="10" y="6" width="44" height="52" rx="4" fill="#f5f8fa" ${o}/><rect x="10" y="6" width="44" height="10" rx="4" fill="#3d5566"/><circle cx="18" cy="11" r="1.6" fill="#7fe0a0"/><rect x="36" y="9.5" width="14" height="3" rx="1" fill="#9fb3c2"/><rect x="22" y="20" width="20" height="3" rx="1.5" fill="#9fb3c2"/><path d="M16 32h32M16 40h32M16 48h32" stroke="#c9d3da" stroke-width="1.4"/><circle cx="22" cy="36" r="3.5" fill="#d9ecfa" stroke="#5aa9e6" stroke-width="1.2"/><circle cx="32" cy="36" r="3.5" fill="#d9ecfa" stroke="#5aa9e6" stroke-width="1.2"/><circle cx="42" cy="44" r="3.5" fill="#d9ecfa" stroke="#5aa9e6" stroke-width="1.2"/>`,
  washer: `<rect x="12" y="5" width="40" height="54" rx="4" fill="#f5f8fa" ${o}/><path d="M12 15h40" stroke="#3d5566" stroke-width="1.3"/><circle cx="18" cy="10" r="2" fill="#5aa9e6"/><rect x="34" y="8" width="14" height="4" rx="1" fill="#2b3138"/><circle cx="32" cy="37" r="14" fill="#dfe6ec" ${o}/><circle cx="32" cy="37" r="10" fill="#5aa9e6" stroke="#3d5566" stroke-width="1.2"/><path d="M24 39c3-3 6 1 9-1s5-3 7-1" fill="none" stroke="#d9ecfa" stroke-width="1.6" stroke-linecap="round"/><path d="M26 31a8 8 0 0 1 6-3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
  microwave: `<rect x="5" y="14" width="54" height="36" rx="4" fill="#f5f8fa" ${o}/><rect x="10" y="19" width="32" height="26" rx="2" fill="#2b3138" ${o}/><path d="M13 22l8 8M13 28l5 5" stroke="#fff" stroke-width="1.4" opacity=".35"/><rect x="46" y="19" width="9" height="5" rx="1" fill="#2b3138"/><circle cx="50.5" cy="31" r="2.6" fill="#c9d3da" ${o}/><circle cx="50.5" cy="39" r="2.6" fill="#c9d3da" ${o}/><rect x="9" y="50" width="6" height="3" fill="#3d5566"/><rect x="49" y="50" width="6" height="3" fill="#3d5566"/>`,
  geyser: `<rect x="17" y="5" width="30" height="46" rx="13" fill="#f5f8fa" ${o}/><rect x="25" y="14" width="14" height="7" rx="2" fill="#2b3138"/><circle cx="29" cy="17.5" r="1.6" fill="#ff7b54"/><circle cx="35" cy="17.5" r="1.6" fill="#7fe0a0"/><path d="M22 12v30" stroke="#fff" stroke-width="2.4" opacity=".8"/><path d="M26 51v7M38 51v7" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><path d="M26 51v7" stroke="#5aa9e6" stroke-width="1.6" stroke-linecap="round"/><path d="M38 51v7" stroke="#ff7b54" stroke-width="1.6" stroke-linecap="round"/>`,
  tv: `<rect x="4" y="8" width="56" height="36" rx="3" fill="#2b3138" ${o}/><rect x="7.5" y="11.5" width="49" height="29" rx="1.5" fill="#2f6fb0"/><path d="M7.5 33l12-9 9 7 10-11 18 14v7h-49z" fill="#5aa9e6"/><circle cx="47" cy="18" r="3" fill="#ffd166"/><path d="M24 52l4-8h8l4 8z" fill="#c9d3da" ${o}/><path d="M20 52h24" stroke="#3d5566" stroke-width="2.4" stroke-linecap="round"/>`,
  chimney: `<rect x="26" y="4" width="12" height="20" fill="#dfe6ec" ${o}/><path d="M14 24h36l8 16H6z" fill="#f5f8fa" ${o}/><rect x="6" y="40" width="52" height="6" rx="1.5" fill="#3d5566"/><circle cx="46" cy="43" r="1.4" fill="#7fe0a0"/><path d="M18 28h28" stroke="#fff" stroke-width="2"/><path d="M20 52v4M32 51v6M44 52v4" stroke="#ffd166" stroke-width="2" stroke-linecap="round"/>`,
  cooler: `<rect x="12" y="6" width="40" height="48" rx="5" fill="#f5f8fa" ${o}/><rect x="17" y="12" width="30" height="24" rx="2" fill="#dfe6ec" stroke="#9fb3c2" stroke-width="1"/><path d="M17 16h30M17 20h30M17 24h30M17 28h30M17 32h30" stroke="#9fb3c2" stroke-width="1.2"/><rect x="17" y="40" width="30" height="9" rx="2" fill="#5aa9e6" opacity=".6"/><circle cx="18" cy="57" r="3" fill="#3d5566"/><circle cx="46" cy="57" r="3" fill="#3d5566"/>`,
  heater: `<path d="M14 50h36" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><rect x="10" y="12" width="8" height="36" rx="4" fill="#f5f8fa" ${o}/><rect x="20" y="12" width="8" height="36" rx="4" fill="#f5f8fa" ${o}/><rect x="30" y="12" width="8" height="36" rx="4" fill="#f5f8fa" ${o}/><rect x="40" y="12" width="8" height="36" rx="4" fill="#f5f8fa" ${o}/><rect x="48" y="20" width="8" height="14" rx="2" fill="#2b3138"/><circle cx="52" cy="25" r="2" fill="#ff7b54"/><path d="M18 8c-2-3 2-4 0-7M30 8c-2-3 2-4 0-7M42 8c-2-3 2-4 0-7" fill="none" stroke="#ff7b54" stroke-width="1.6" stroke-linecap="round"/>`,
  fan: `<path d="M32 2v18" stroke="#3d5566" stroke-width="3"/><path d="M32 30C24 25 9 25 4 29c6 3 20 4 28 1z" fill="#dfe6ec" ${o}/><path d="M32 30c8-5 23-5 28-1-6 3-20 4-28 1z" fill="#dfe6ec" ${o}/><path d="M32 30c-2 7-1 20 3 25 2-6 1-19-3-25z" fill="#dfe6ec" ${o}/><circle cx="32" cy="28" r="7" fill="#f5f8fa" ${o}/><circle cx="32" cy="28" r="2.5" fill="#2f6fb0"/>`,
  mixer: `<path d="M20 6h24l-3 28H23z" fill="#d9ecfa" ${o}/><rect x="18" y="3" width="28" height="5" rx="2" fill="#3d5566"/><path d="M44 12h6v14h-7" fill="none" stroke="#3d5566" stroke-width="2.6"/><path d="M26 26l6-4 6 4" fill="none" stroke="#9fb3c2" stroke-width="1.6"/><rect x="14" y="34" width="36" height="22" rx="5" fill="#f5f8fa" ${o}/><circle cx="32" cy="45" r="5" fill="#2f6fb0" ${o}/><path d="M32 41v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  stove: `<rect x="4" y="24" width="56" height="22" rx="4" fill="#2b3138" ${o}/><ellipse cx="19" cy="33" rx="9" ry="5" fill="#4a5560" stroke="#8a98a3" stroke-width="1.2"/><ellipse cx="45" cy="33" rx="9" ry="5" fill="#4a5560" stroke="#8a98a3" stroke-width="1.2"/><path d="M14 31c1-4 3-4 5-8 1 4 4 5 5 8M40 31c1-4 3-4 5-8 1 4 4 5 5 8" fill="#ff9f43"/><circle cx="19" cy="42" r="2" fill="#c9d3da"/><circle cx="45" cy="42" r="2" fill="#c9d3da"/><path d="M8 27h48" stroke="#fff" stroke-width="1.4" opacity=".25"/>`,
  vacuum: `<rect x="6" y="34" width="30" height="20" rx="9" fill="#d94848" ${o}/><circle cx="14" cy="54" r="4" fill="#3d5566"/><circle cx="30" cy="54" r="4" fill="#3d5566"/><path d="M34 38c10-2 14-10 14-22" fill="none" stroke="#3d5566" stroke-width="4" stroke-linecap="round"/><path d="M48 16V6" stroke="#9fb3c2" stroke-width="3.4" stroke-linecap="round"/><rect x="40" y="54" width="20" height="5" rx="2" fill="#3d5566"/><path d="M48 18v36" stroke="#9fb3c2" stroke-width="3"/><path d="M11 39h18" stroke="#fff" stroke-width="1.6" opacity=".6"/>`,
  iron: `<path d="M6 46c2-14 14-24 34-24h16v24z" fill="#f5f8fa" ${o}/><path d="M4 46h54v6H6z" fill="#c9d3da" ${o}/><path d="M30 22c0-8 6-12 14-12h12v12" fill="none" stroke="#2f6fb0" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="34" r="4" fill="#2f6fb0" ${o}/><path d="M14 58c-2-2 2-3 0-5M24 58c-2-2 2-3 0-5" fill="none" stroke="#9fb3c2" stroke-width="1.4" stroke-linecap="round"/>`,
  kitchen: `<path d="M16 22h28l4 32H12z" fill="#f5f8fa" ${o}/><path d="M20 22c0-8 4-12 10-12s10 4 10 12" fill="none" stroke="#3d5566" stroke-width="3"/><path d="M44 28c8 0 10 6 6 12l-4 4" fill="none" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><path d="M12 28l-6-6" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><rect x="10" y="54" width="40" height="5" rx="2" fill="#2f6fb0" ${o}/><circle cx="30" cy="38" r="4" fill="#5aa9e6"/><path d="M26 6c-1-2 1-3 0-5M34 6c-1-2 1-3 0-5" fill="none" stroke="#9fb3c2" stroke-width="1.4" stroke-linecap="round"/>`,
  inverter: `<rect x="6" y="14" width="30" height="40" rx="4" fill="#f5f8fa" ${o}/><rect x="11" y="20" width="20" height="9" rx="1.5" fill="#2b3138"/><text x="21" y="27" font-family="Arial, sans-serif" font-size="6" font-weight="700" text-anchor="middle" fill="#7fe0a0">230</text><circle cx="14" cy="36" r="1.8" fill="#7fe0a0"/><circle cx="20" cy="36" r="1.8" fill="#ffd166"/><path d="M11 46h20" stroke="#c9d3da" stroke-width="2"/><rect x="38" y="26" width="22" height="28" rx="3" fill="#2f6fb0" ${o}/><rect x="42" y="22" width="5" height="4" fill="#d94848" ${o}/><rect x="51" y="22" width="5" height="4" fill="#3d5566" ${o}/><path d="M46 36l-3 6h5l-3 6" fill="none" stroke="#ffd166" stroke-width="1.8" stroke-linejoin="round"/>`,
  personal: `<path d="M8 18c0-7 6-12 14-12h14a12 12 0 0 1 0 24H22C14 30 8 25 8 18z" fill="#b27cf0" ${o}/><circle cx="36" cy="18" r="6" fill="#2b3138" stroke="#8a98a3" stroke-width="1.2"/><path d="M32 18h8M36 14v8" stroke="#8a98a3" stroke-width="1"/><path d="M20 30l-2 26h10l2-26" fill="#9b5de5" ${o}/><circle cx="23.5" cy="38" r="1.6" fill="#fff"/><path d="M50 14h8M50 18h10M50 22h8" stroke="#ffb4a2" stroke-width="1.6" stroke-linecap="round"/><path d="M14 12a10 10 0 0 1 6-4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  stabilizer: `<rect x="8" y="10" width="48" height="44" rx="5" fill="#f5f8fa" ${o}/><path d="M18 34a14 14 0 0 1 28 0z" fill="#fff" ${o}/><path d="M32 34l7-9" stroke="#d94848" stroke-width="2" stroke-linecap="round"/><path d="M21 32l2 1M24 26l1.6 1.4M32 22v2M40 26l-1.6 1.4M43 32l-2 1" stroke="#3d5566" stroke-width="1.2"/><circle cx="20" cy="45" r="2.2" fill="#7fe0a0"/><circle cx="28" cy="45" r="2.2" fill="#ffd166"/><rect x="36" y="42" width="14" height="6" rx="1.5" fill="#2b3138"/>`,
  compressor: `<path d="M16 22c0-10 7-16 16-16s16 6 16 16v24H16z" fill="#2b3138" ${o}/><rect x="12" y="46" width="40" height="8" rx="2" fill="#4a5560" ${o}/><path d="M20 16c2-4 6-6 10-6" fill="none" stroke="#fff" stroke-width="1.6" opacity=".4" stroke-linecap="round"/><path d="M48 28h8v-8M48 36h10" fill="none" stroke="#c87533" stroke-width="3" stroke-linecap="round"/><rect x="24" y="28" width="16" height="9" rx="1" fill="#e9eef2"/><path d="M26 31h12M26 34h8" stroke="#2b3138" stroke-width="1"/>`,
  gas: `<rect x="22" y="14" width="20" height="44" rx="10" fill="#3fa7d6" ${o}/><rect x="28" y="6" width="8" height="8" fill="#c9d3da" ${o}/><path d="M36 9h7" stroke="#3d5566" stroke-width="3" stroke-linecap="round"/><rect x="25" y="30" width="14" height="12" rx="1.5" fill="#fff"/><text x="32" y="38.6" font-family="Arial, sans-serif" font-size="6" font-weight="700" text-anchor="middle" fill="#1f5f99">R32</text><path d="M26 20v6M26 46v6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  capacitor: `<rect x="20" y="16" width="24" height="40" rx="5" fill="#f2f5f7" ${o}/><rect x="20" y="16" width="24" height="8" rx="4" fill="#c9d3da" ${o}/><rect x="24" y="30" width="16" height="16" rx="1.5" fill="#2f6fb0"/><text x="32" y="40" font-family="Arial, sans-serif" font-size="5.2" font-weight="700" text-anchor="middle" fill="#fff">MFD</text><path d="M27 16V8M37 16V8" stroke="#8a98a3" stroke-width="2.4" stroke-linecap="round"/><path d="M23 26v26" stroke="#fff" stroke-width="1.6"/>`,
  remote: `<rect x="20" y="4" width="24" height="56" rx="8" fill="#2b3138" ${o}/><circle cx="32" cy="12" r="3" fill="#d94848"/><circle cx="32" cy="26" r="6" fill="#4a5560" stroke="#8a98a3" stroke-width="1.2"/><circle cx="32" cy="26" r="2" fill="#c9d3da"/><path d="M26 38h3M31 38h3M36 38h3M26 43h3M31 43h3M36 43h3M26 48h3M31 48h3M36 48h3" stroke="#c9d3da" stroke-width="2.4" stroke-linecap="round"/>`,
  motor: `<rect x="8" y="18" width="36" height="30" rx="6" fill="#4a5560" ${o}/><path d="M14 19v28M20 19v28M26 19v28M32 19v28M38 19v28" stroke="#36404a" stroke-width="1.4"/><rect x="44" y="24" width="6" height="18" rx="2" fill="#8a98a3" ${o}/><path d="M50 33h10" stroke="#c9d3da" stroke-width="3.4" stroke-linecap="round"/><rect x="12" y="48" width="28" height="5" rx="1.5" fill="#2b3138"/><path d="M18 12h10v6H18z" fill="#c87533" ${o}/>`,
  element: `<path d="M10 14v30c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V14" fill="none" stroke="#3d5566" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14v30c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V20c0-6 6-6 6 0v24c0 6 6 6 6 0V14" fill="none" stroke="#ff7b54" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="6" width="56" height="8" rx="2" fill="#c9d3da" ${o}/>`,
  board: `<rect x="6" y="12" width="52" height="40" rx="3" fill="#2e8b57" ${o}/><rect x="14" y="20" width="14" height="12" rx="1" fill="#2b3138"/><path d="M14 22h-3M14 26h-3M14 30h-3M28 22h3M28 26h3M28 30h3" stroke="#c9d3da" stroke-width="1.2"/><rect x="36" y="18" width="8" height="14" rx="4" fill="#2f6fb0" ${o}/><rect x="46" y="40" width="8" height="8" fill="#c9d3da" ${o}/><path d="M12 44h22l6-6M20 38h12" fill="none" stroke="#ffd166" stroke-width="1.2"/><circle cx="10" cy="16" r="1.4" fill="#c9d3da"/><circle cx="54" cy="16" r="1.4" fill="#c9d3da"/>`,
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

/**
 * English names of the product types, for the platform admins' photo library (not translated).
 * @type {Record<string, string>}
 */
export const productKindLabels = { purifier: 'Purifier', membrane: 'RO membrane', filter: 'Filter / cartridge', pump: 'Pump (booster / water)', adapter: 'Adapter / SMPS', uv: 'UV lamp', valve: 'Valve / switch', tap: 'Tap', tank: 'Tank', pipe: 'Pipe / fitting', meter: 'TDS meter', kit: 'Service kit', airpurifier: 'Air purifier', ac: 'Air conditioner', fridge: 'Refrigerator / freezer', dishwasher: 'Dishwasher', washer: 'Washing machine / dryer', microwave: 'Microwave / oven', geyser: 'Water heater (geyser)', tv: 'Television', chimney: 'Kitchen chimney', cooler: 'Air cooler', heater: 'Room heater', fan: 'Fan', mixer: 'Mixer / grinder', stove: 'Stove / induction / hob', vacuum: 'Vacuum cleaner', iron: 'Iron / steamer', personal: 'Hair dryer and personal care', kitchen: 'Kettle, toaster and small kitchen', inverter: 'Inverter / UPS / battery', stabilizer: 'Voltage stabilizer', compressor: 'Compressor', gas: 'Refrigerant gas', capacitor: 'Capacitor', remote: 'Remote', motor: 'Motor', element: 'Heating element', board: 'PCB / thermostat / timer', part: 'Other part' };

// Appliance types for browsing: every product belongs to one, so the catalogue and the product list
// can be shown type by type (ACs, refrigerators, RO and so on) instead of one long list. Appliances
// get theirs from their drawing kind; parts and accessories from the appliance named in them, and
// otherwise RO (the parts the catalogue started with) or Other. Labels are English, shown with t().
/** @type {[string, string][]} */
export const applianceGroups = [
  ['ro', 'RO & water purifiers'],
  ['ac', 'Air conditioners'],
  ['fridge', 'Refrigerators & freezers'],
  ['washer', 'Washing machines & dishwashers'],
  ['tv', 'TVs & audio'],
  ['kitchen', 'Kitchen appliances'],
  ['heater', 'Water heaters'],
  ['cooling', 'Coolers, fans & room heaters'],
  ['care', 'Cleaning & personal care'],
  ['power', 'Inverters, batteries & stabilizers'],
  ['pump', 'Water pumps'],
  ['other', 'Other']
];

/** @type {Record<string, string>} */
const groupOfKind = {
  purifier: 'ro', airpurifier: 'care', ac: 'ac', fridge: 'fridge', dishwasher: 'washer', washer: 'washer', microwave: 'kitchen',
  chimney: 'kitchen', stove: 'kitchen', mixer: 'kitchen', kitchen: 'kitchen', geyser: 'heater', tv: 'tv', cooler: 'cooling',
  fan: 'cooling', heater: 'cooling', vacuum: 'care', iron: 'care', personal: 'care', inverter: 'power', stabilizer: 'power', pump: 'pump'
};

// Parts and accessories, by the appliance in their name, checked in this order.
/** @type {[string, RegExp][]} */
const partGroupRules = [
  ['power', /inverter|battery|stabili[sz]er|\bups\b/],
  ['ac', /\bac\b|air condition|\br32\b|\br22\b|r410/],
  ['fridge', /refrigerator|fridge|freezer|r600a|r134a/],
  ['washer', /washing machine|dishwasher|dryer/],
  ['heater', /geyser|water heater/],
  ['tv', /\btv\b|television|soundbar/],
  ['kitchen', /microwave|chimney|induction|\bhob\b|mixer|grinder|kettle|oven|stove/],
  ['cooling', /cooler|\bfan\b|room heater/],
  ['care', /vacuum|\biron\b|steamer|air purifier|humidifier|hair/],
  ['pump', /water pump/],
  ['ro', /\bro\b|purifier|membrane|\buv\b|\buf\b|tds|sediment|cartridge|candle/]
];
const roPartKinds = new Set(['membrane', 'filter', 'uv', 'tap', 'tank', 'meter', 'pump', 'valve', 'adapter', 'pipe', 'kit']);

/**
 * The appliance type a product belongs to (a key of applianceGroups).
 * @param {{ name: string, category: string }} product
 */
export function applianceGroup(product) {
  const kind = productKind(product);
  if (product.category === 'Purifiers') return groupOfKind[kind] || 'other';
  const text = product.name.toLowerCase();
  return partGroupRules.find(([, pattern]) => pattern.test(text))?.[0] || (roPartKinds.has(kind) ? 'ro' : 'other');
}

/**
 * The appliance types that have at least one of the given products, in the usual order.
 * @param {{ name: string, category: string }[]} products
 */
export function groupsIn(products) {
  const present = new Set(products.map(applianceGroup));
  return applianceGroups.filter(([key]) => present.has(key));
}
