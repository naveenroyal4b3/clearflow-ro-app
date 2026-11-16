// @ts-check
// Drawn icons for products without a photo, picked from the product's type. Shared by the web app
// and the native app (rendered there with react-native-svg).

/** @type {Record<string, string>} */
const shapes = {
  purifier: '<rect x="6" y="2.5" width="12" height="16.5" rx="2"/><path d="M9 6h6M12 19v2.5M8.5 21.5h7"/><path d="M12 9.5s-2.2 2.5-2.2 3.8a2.2 2.2 0 0 0 4.4 0c0-1.3-2.2-3.8-2.2-3.8z"/>',
  membrane: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M7 8v8M17 8v8M1 12h2M21 12h2"/>',
  filter: '<rect x="8" y="2.5" width="8" height="19" rx="2"/><path d="M8 7h8M8 17h8M10.5 10v4M13.5 10v4"/>',
  pump: '<circle cx="10" cy="14" r="6"/><path d="M16 14h5M10 8V4h4M10 14l3-3"/>',
  adapter: '<rect x="2.5" y="7" width="13" height="10" rx="2"/><path d="M15.5 12h2.5a3 3 0 0 0 3-3V5M9.5 9.5 8 12h3l-1.5 2.5"/>',
  uv: '<path d="M9 3v13M15 3v13M9 3h6M12 16v4M8 21h8M4.5 7 2.5 6M4.5 11h-2M19.5 7l2-1M19.5 11h2"/>',
  valve: '<path d="M2 15h6M16 15h6M8 11l8 8v-8l-8 8z"/><path d="M12 15V6M9 6h6"/>',
  tap: '<path d="M3 9h9a5 5 0 0 1 5 5v2M3 6v6M8 9V5M6 5h4"/><path d="M17 19.5s-1.2 1.4-1.2 2a1.2 1.2 0 0 0 2.4 0c0-.6-1.2-2-1.2-2z"/>',
  tank: '<rect x="5" y="4.5" width="14" height="17" rx="3"/><path d="M5 10h14M10 2.5h4v2M9 15h6"/>',
  pipe: '<path d="M3 7h9a5 5 0 0 1 5 5v9M3 12h9v9"/>',
  meter: '<rect x="7" y="2" width="10" height="20" rx="2"/><rect x="9" y="5" width="6" height="4" rx="1"/><path d="M10 13h4M12 17v3"/>',
  kit: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  part: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'
};

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
 * A complete SVG for the product's icon.
 * @param {{ name: string, category: string }} product
 * @param {string} [color]
 */
export function productIconSvg(product, color = 'currentColor') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[productKind(product)]}</svg>`;
}
