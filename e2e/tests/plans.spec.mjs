import { createClient } from '@supabase/supabase-js';
import { test, expect, signUpOwner, signIn, addCustomer, goTo, uniqueEmail } from './helpers.mjs';

// The service key stands in for the Razorpay webhook, which is the only thing that changes plans.
const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SECRET_KEY, { auth: { persistSession: false } });

async function setPlan(business, changes) {
  const { error } = await admin.from('organizations').update(changes).eq('name', business);
  if (error) throw error;
}

test('a new business starts on a free trial with plan options on the web', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Trial Customer');
  await expect(page.locator('#page')).toContainText('Trial Customer');
  await page.click('[data-action="my-account"]');
  await expect(page.locator('#active-form')).toContainText('Free trial until');
  await expect(page.locator('[data-action="buy-plan"]')).toHaveCount(2);
});

test('when the plan ends the workspace is read-only, in the app and in the database', async ({ page }) => {
  const business = `Expired RO ${Date.now()}`;
  const email = uniqueEmail('expired');
  await signUpOwner(page, { business, email });
  await addCustomer(page, 'Kept Customer');
  await setPlan(business, { trial_ends_at: new Date(Date.now() - 60_000).toISOString() });

  await page.reload();
  await expect(page.locator('.plan-notice')).toContainText('plan has ended');
  await goTo(page, 'customers');
  await expect(page.locator('#page')).toContainText('Kept Customer');
  await page.click('[data-action="new-customer"]');
  await expect(page.locator('.toast')).toContainText('plan has ended');
  await expect(page.locator('#active-form')).toHaveCount(0);

  // The database refuses the change even if the app is bypassed.
  const ownerClient = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await page.click('[data-action="my-account"]');
  await expect(page.locator('#active-form')).toContainText('Ended');
  await page.click('.modal-head [data-close]');
  await page.click('#signout-button');
  const { error: signInError } = await ownerClient.auth.signInWithPassword({ email, password: 'Test-pass-123' });
  expect(signInError).toBeNull();
  const { data: profileRow } = await ownerClient.from('profiles').select('organization_id').single();
  const { error } = await ownerClient.from('customers').insert({ id: 'C-BLOCKED', organization_id: profileRow.organization_id, name: 'Blocked', phone: '90000 00001' });
  expect(error?.message).toContain('plan has ended');
  await ownerClient.auth.signOut();

  // A payment (paid_until in the future) unlocks it again.
  await setPlan(business, { paid_until: new Date(Date.now() + 30 * 86400_000).toISOString(), plan_interval: 'monthly' });
  await signIn(page, email);
  await expect(page.locator('.plan-notice')).toHaveCount(0);
  await addCustomer(page, 'After Renewal');
  await expect(page.locator('#page')).toContainText('After Renewal');
});
