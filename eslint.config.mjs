import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'e2e/dist/', 'android/', 'node_modules/', 'playwright-report/', 'test-results/', 'e2e/supabase/', 'supabase/functions/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['*.mjs', 'e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
];
