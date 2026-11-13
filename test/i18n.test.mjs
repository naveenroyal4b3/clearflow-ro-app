// Every text wrapped in t('...') or msg('...') in the web and native apps must be translated in
// every language, with the same {placeholders}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { languages, setLanguage, t } from '../src/i18n.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    if (name === 'node_modules' || name === 'locales' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(js|mjs|ts|tsx)$/.test(name) && !/\.test\./.test(name) && !path.includes('__tests__') ? [path] : [];
  });
}

// t('text'), t("text"), msg('text') with a plain string literal as the first argument.
export function usedTexts() {
  const texts = new Set();
  const call = /\b(?:t|msg)\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g;
  for (const file of [...files(join(root, 'src')), ...files(join(root, 'mobile', 'src'))]) {
    for (const match of readFileSync(file, 'utf8').matchAll(call)) {
      texts.add((match[1] ?? match[2]).replace(/\\(['"\\])/g, '$1'));
    }
  }
  return texts;
}

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');

for (const { code } of languages.filter(language => language.code !== 'en')) {
  test(`every text is translated into ${code}`, async () => {
    const { default: dictionary } = await import(`../src/locales/${code}.js`);
    const texts = usedTexts();
    const missing = [...texts].filter(text => !dictionary[text]);
    assert.deepEqual(missing, [], `${missing.length} texts missing in src/locales/${code}.js`);
    for (const text of texts) assert.equal(placeholders(dictionary[text]), placeholders(text), `placeholders differ for "${text}" in ${code}`);
  });
}

test('t() fills placeholders and falls back to English', () => {
  setLanguage('en');
  assert.equal(t('Hello {name}', { name: 'Ravi' }), 'Hello Ravi');
  setLanguage('hi');
  assert.equal(t('A text with no translation'), 'A text with no translation');
  setLanguage('en');
});
