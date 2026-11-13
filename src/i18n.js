// @ts-check
// App languages. Shared by the web app (src/main.js) and the native app (mobile/src/lib/i18n.tsx).
//
// Text is written in English in the code and wrapped in t(). The English text is the key into
// each language file in src/locales/, so a missing translation simply shows English. Placeholders
// use braces, filled from t()'s second argument. test/i18n.test.mjs checks that every language has
// every t() and msg() text in the code.
//
// Printed quotations and invoices stay in English, as GST documents usually are.
import hi from './locales/hi.js';
import te from './locales/te.js';
import ta from './locales/ta.js';
import kn from './locales/kn.js';
import ml from './locales/ml.js';

/** @type {Record<string, Record<string, string>>} */
const dictionaries = { hi, te, ta, kn, ml };

// Each language is named in its own script, so people can find theirs.
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'മലയാളം' }
];

const storageKey = 'clearflow-language';
const supported = (/** @type {unknown} */ code) => typeof code === 'string' && languages.some(language => language.code === code);

function storage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

// The saved choice, else the device's language when we have it, else English.
function initialLanguage() {
  try {
    const saved = storage()?.getItem(storageKey);
    if (supported(saved)) return /** @type {string} */ (saved);
  } catch { /* storage unavailable */ }
  try {
    const device = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
    if (supported(device)) return device;
  } catch { /* no Intl locale */ }
  return 'en';
}

let current = initialLanguage();

export function getLanguage() {
  return current;
}

/** @param {string} code */
export function setLanguage(code) {
  if (!supported(code)) return;
  current = code;
  try { storage()?.setItem(storageKey, code); } catch { /* storage unavailable */ }
}

/**
 * The text in the chosen language.
 * @param {string} text English text, used as the key.
 * @param {Record<string, string | number>} [values] Fills {placeholders}.
 */
export function t(text, values) {
  const translated = (current === 'en' ? undefined : dictionaries[current]?.[text]) || text;
  return values ? translated.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match)) : translated;
}

/**
 * Marks English text that is stored first and translated later with t(value), such as labels in a
 * lookup table. It returns the text unchanged.
 * @template {string} T
 * @param {T} text
 */
export function msg(text) {
  return text;
}
