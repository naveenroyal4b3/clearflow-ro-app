import { test, expect, signUpOwner, signIn, signOut, goTo, submitModal, addCustomer, addProduct, uniqueEmail, emailLink, acceptEmailLink, password } from './helpers.mjs';

test('owner signs up and creates a workspace', async ({ page }) => {
  await signUpOwner(page, { name: 'Asha Rao' });
  await expect(page.locator('#user-name')).toHaveText('Asha Rao');
  await expect(page.locator('.nav-item[data-view="accounts"]')).toBeVisible();
});

test('customers, products and service jobs persist after reload', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Lakshmi Prasad');
  await addProduct(page, 'Aqua Pro 8L');
  await goTo(page, 'jobs');
  await page.click('[data-action="new-job"]');
  await page.selectOption('#active-form select[name="type"]', 'Installation');
  await submitModal(page);

  await page.reload();
  await expect(page.locator('.nav-item[data-view="overview"]')).toBeVisible();
  await goTo(page, 'customers');
  await expect(page.locator('#page')).toContainText('Lakshmi Prasad');
  await goTo(page, 'catalog');
  await expect(page.locator('#page')).toContainText('Aqua Pro 8L');
  await goTo(page, 'jobs');
  await expect(page.locator('#page')).toContainText('Installation');
});

test('owner creates a numbered GST invoice and stock goes down', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Priya Sharma');
  await addProduct(page, 'RO membrane', { customer: 2400, stock: 5 });
  await goTo(page, 'sales');
  await page.locator('[data-action="new-sale"]').first().click();
  await page.selectOption('#active-form select[name="docType"]', 'Invoice');
  await expect(page.locator('#active-form .sale-price')).toHaveValue('2400');
  await submitModal(page);
  await expect(page.locator('#page')).toContainText(/INV-\d{2}-\d{2}-0001/);

  await goTo(page, 'catalog');
  await expect(page.locator('#page')).toContainText('4 in stock');
});

test('businesses cannot see each other\'s records', async ({ page }) => {
  await signUpOwner(page, { business: 'First RO' });
  await addCustomer(page, 'Private Customer One');
  await signOut(page);

  await signUpOwner(page, { business: 'Second RO' });
  await goTo(page, 'customers');
  await expect(page.locator('#page')).not.toContainText('Private Customer One');
});

test('forgotten password can be reset from the email link', async ({ page }) => {
  const { email } = await signUpOwner(page);
  await signOut(page);

  await page.click('[data-reset-password]');
  await page.fill('#reset-form input[name="email"]', email);
  await page.click('#reset-form [type="submit"]');
  await expect(page.locator('.auth-message')).toBeVisible();

  await acceptEmailLink(page, await emailLink(email, /reset/i), 'New-pass-456');
  await signOut(page);
  await signIn(page, email, 'New-pass-456');

  await signOut(page);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('#auth-form [type="submit"]');
  await expect(page.locator('.auth-message')).toContainText(/invalid/i);
});

test('price preview only shows on the catalogue for owners', async ({ page }) => {
  await signUpOwner(page);
  await expect(page.locator('#role-control')).toBeHidden();
  await goTo(page, 'catalog');
  await expect(page.locator('#role-control')).toBeVisible();
  await expect(page.locator('#role-select option:checked')).toHaveText('Customer prices');
});

test('unknown sign-in is rejected', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', uniqueEmail('nobody'));
  await page.fill('input[name="password"]', password);
  await page.click('#auth-form [type="submit"]');
  await expect(page.locator('.auth-message')).toContainText(/invalid/i);
});
