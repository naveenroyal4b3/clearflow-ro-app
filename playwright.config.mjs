import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';

// The tests run against the local Supabase stack from `npm run e2e:prepare`, never production.
function localSupabase() {
  const status = JSON.parse(execSync('npx --yes supabase@2.122.0 status -o json --workdir e2e', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  if (!/^http:\/\/127\.0\.0\.1:/.test(status.API_URL)) throw new Error(`Refusing to run end-to-end tests against ${status.API_URL}`);
  return status;
}

const supabase = localSupabase();
process.env.E2E_SUPABASE_URL = supabase.API_URL;
process.env.E2E_MAILPIT_URL = supabase.MAILPIT_URL || supabase.INBUCKET_URL;

export default defineConfig({
  testDir: 'e2e/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5180/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180/',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: supabase.API_URL,
      VITE_SUPABASE_ANON_KEY: supabase.PUBLISHABLE_KEY || supabase.ANON_KEY
    }
  }
});
