import { test as base, expect } from '@playwright/test';

export { expect };

export const password = 'Test-pass-123';

// Every test gets a page that cannot reach a hosted Supabase project, as a second guard
// (after playwright.config.mjs) against touching production data.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/supabase\.co/, route => route.abort());
    await use(page);
  }
});

export function uniqueEmail(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;
}

// Waits for the newest email to `to` in the local Mailpit inbox and returns its Supabase verify link.
export async function emailLink(to, subjectPattern = /./) {
  const mailpit = process.env.E2E_MAILPIT_URL;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then(response => response.json());
    const message = (search.messages || []).find(item => subjectPattern.test(item.Subject));
    if (message) {
      const full = await fetch(`${mailpit}/api/v1/message/${message.ID}`).then(response => response.json());
      const link = `${full.HTML || ''} ${full.Text || ''}`.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/);
      if (link) return link[0].replace(/&amp;/g, '&');
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`No email with a sign-in link arrived for ${to}`);
}

export async function signUpOwner(page, { name = 'Test Owner', business = 'Test RO Services', email = uniqueEmail('owner') } = {}) {
  await page.goto('/');
  await page.click('[data-auth-mode="sign-up"]');
  await page.fill('input[name="full_name"]', name);
  await page.fill('input[name="phone"]', '90000 00000');
  await page.fill('input[name="organization_name"]', business);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('#auth-form [type="submit"]');
  await page.click('#organization-form [type="submit"]');
  await expect(page.locator('.nav-item[data-view="overview"]')).toBeVisible();
  return { email, name, business };
}

export async function signIn(page, email, pass = password) {
  await page.goto('/');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('#auth-form [type="submit"]');
  await expect(page.locator('.nav-item[data-view="overview"]')).toBeVisible();
}

export async function signOut(page) {
  await page.click('#signout-button');
  await expect(page.locator('#auth-form')).toBeVisible();
}

export async function goTo(page, view) {
  await page.click(`.nav-item[data-view="${view}"]`);
  await expect(page.locator(`.nav-item[data-view="${view}"]`)).toHaveClass(/active/);
}

export async function submitModal(page) {
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('#active-form')).toHaveCount(0);
}

export async function addCustomer(page, name, phone = '98480 11111') {
  await goTo(page, 'customers');
  await page.click('[data-action="new-customer"]');
  await page.fill('#active-form input[name="name"]', name);
  await page.fill('#active-form input[name="phone"]', phone);
  await page.fill('#active-form textarea[name="address"]', 'Madhapur, Hyderabad');
  await submitModal(page);
}

export async function addProduct(page, name, { customer = 1000, technician = 800, shop = 700, stock = 10 } = {}) {
  await goTo(page, 'catalog');
  await page.click('[data-action="new-product"]');
  await page.fill('#active-form input[name="name"]', name);
  await page.fill('#active-form input[name="customer"]', String(customer));
  await page.fill('#active-form input[name="technician"]', String(technician));
  await page.fill('#active-form input[name="shop"]', String(shop));
  await page.fill('#active-form input[name="stock"]', String(stock));
  await submitModal(page);
}

export async function invite(page, { name, email, role }) {
  await goTo(page, 'accounts');
  await page.click('[data-action="new-account"]');
  await page.fill('#active-form input[name="name"]', name);
  await page.fill('#active-form input[name="username"]', email);
  await page.selectOption('#active-form select[name="role"]', role);
  await submitModal(page);
}

// Opens an invite or recovery email link and chooses a new password on the set-password screen.
export async function acceptEmailLink(page, link, newPassword = password) {
  await page.goto(link);
  await page.fill('#password-form input[name="password"]', newPassword);
  await page.fill('#password-form input[name="confirm"]', newPassword);
  await page.click('#password-form [type="submit"]');
  await expect(page.locator('.nav-item[data-view="overview"]')).toBeVisible();
}

export async function deleteMyAccount(page) {
  await page.click('[data-action="my-account"]');
  await page.fill('#delete-confirm', 'DELETE');
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('.auth-message')).toContainText('Your account has been deleted');
}
