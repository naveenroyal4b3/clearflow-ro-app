import { createClient } from '@supabase/supabase-js';
import { test, expect, signUpOwner, signIn, signOut, goTo, submitModal, addCustomer, addProduct, setBusinessGstin, uniqueEmail, emailLink, acceptEmailLink, password } from './helpers.mjs';

test('a login can be signed in on only one device at a time', async ({ page, browser }) => {
  const { email } = await signUpOwner(page);

  // A second browser stands in for a second device.
  const otherDevice = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await otherDevice.route(/supabase\.co/, route => route.abort());
  await otherDevice.goto('/');
  await otherDevice.fill('input[name="email"]', email);
  await otherDevice.fill('input[name="password"]', password);
  await otherDevice.click('#auth-form [type="submit"]');
  await expect(otherDevice.locator('.auth-message')).toContainText('already signed in on another device');
  await expect(otherDevice.locator('.nav-item[data-view="overview"]')).toBeHidden();

  // Signing out on the first device frees the login.
  await signOut(page);
  await signIn(otherDevice, email);
  await otherDevice.close();
});

test('a new device can sign out the other device and continue', async ({ page, browser }) => {
  const { email } = await signUpOwner(page);

  const otherDevice = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await otherDevice.goto('/');
  otherDevice.once('dialog', dialog => dialog.accept());
  await signIn(otherDevice, email);
  await otherDevice.close();
});

test('signing out of other devices from My account keeps this device signed in', async ({ page }) => {
  await signUpOwner(page);
  await page.click('[data-action="my-account"]');
  await page.click('[data-action="sign-out-others"]');
  await expect(page.locator('.toast')).toContainText('Signed out of all other devices');
  await page.reload();
  await expect(page.locator('.nav-item[data-view="overview"]')).toBeVisible();
});

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
  await setBusinessGstin(page);
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

test('a business without a GSTIN cannot charge GST on an invoice', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Walk-in Customer');
  await addProduct(page, 'Sediment filter', { customer: 300 });
  await goTo(page, 'sales');
  await page.locator('[data-action="new-sale"]').first().click();
  await page.selectOption('#active-form select[name="docType"]', 'Invoice');
  await expect(page.locator('#gst-check')).not.toBeChecked();
  await page.check('#gst-check');
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('.toast')).toContainText('Add your GSTIN');

  await page.uncheck('#gst-check');
  await submitModal(page);
  await expect(page.locator('#page')).toContainText(/INV-\d{2}-\d{2}-0001/);
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

test('a product can be started from the ready-made catalogue', async ({ page }) => {
  await signUpOwner(page);
  await goTo(page, 'catalog');
  await page.click('[data-action="new-product"]');
  await page.fill('#catalog-pick', 'Kent Grand Plus RO+UV+UF+TDS Control');
  await expect(page.locator('#name')).toHaveValue('Kent Grand Plus RO+UV+UF+TDS Control');
  await expect(page.locator('#hsn')).toHaveValue('84212120');
  await expect(page.locator('#gst')).toHaveValue('18');
  await expect(page.locator('#category')).toHaveValue('Purifiers');
});

test('a product photo is uploaded and shown', async ({ page }) => {
  await signUpOwner(page);
  await goTo(page, 'catalog');
  await page.click('[data-action="new-product"]');
  await page.fill('#catalog-pick', 'Kent Grand Plus RO+UV+UF+TDS Control');
  await page.fill('#customer', '15000');
  await page.fill('#technician', '13000');
  await page.fill('#shop', '12500');
  // A small red square, drawn by the browser, stands in for a phone photo.
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = '#c33';
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await page.setInputFiles('#photo', { name: 'purifier.png', mimeType: 'image/png', buffer: png });
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('.product', { hasText: 'Kent Grand Plus' }).locator('.product-art img')).toBeVisible();
});

test('a platform admin sets a shared catalogue photo that businesses see', async ({ page }) => {
  const { email } = await signUpOwner(page);
  const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SECRET_KEY, { auth: { persistSession: false } });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find(item => item.email === email);
  expect((await admin.from('platform_admins').insert({ user_id: user.id })).error).toBeNull();
  const model = 'CSM RE1812-100 RO membrane 100 GPD';
  try {
    await page.reload();
    await goTo(page, 'catalog');
    await page.click('[data-action="open-photo-library"]');
    await page.fill('[data-search]', model);
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 16;
      const context = canvas.getContext('2d');
      context.fillStyle = '#36c';
      context.fillRect(0, 0, 16, 16);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    await page.setInputFiles(`[data-photo-key="${model}"]`, { name: 'membrane.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator(`[data-remove-photo="${model}"]`)).toBeVisible();
    await page.click('[data-action="close-photo-library"]');

    // A product picked from the catalogue shows the shared photo without one of its own.
    await page.click('[data-action="new-product"]');
    await page.fill('#catalog-pick', model);
    await page.fill('#customer', '2500');
    await page.fill('#technician', '2200');
    await page.fill('#shop', '2000');
    await page.click('#active-form [type="submit"]');
    await expect(page.locator('.product', { hasText: 'RE1812-100' }).locator('.product-art img')).toBeVisible();
  } finally {
    const { data } = await admin.from('catalog_photos').delete().eq('key', model).select('path');
    if (data?.length) await admin.storage.from('catalog-photos').remove(data.map(row => row.path));
  }
});

test('feedback about the app is sent from any page and read by the platform admin', async ({ page }) => {
  const { email } = await signUpOwner(page);
  const message = `e2e suggestion ${Date.now()}`;
  await goTo(page, 'customers');
  await page.click('#suggest-button');
  await page.fill('#message', message);
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('.toast')).toBeVisible();
  // An ordinary owner has no inbox; the platform admin sees it with the page it came from.
  await page.click('#suggest-button');
  await expect(page.locator('[data-action="open-app-feedback"]')).toHaveCount(0);
  const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SECRET_KEY, { auth: { persistSession: false } });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find(item => item.email === email);
  expect((await admin.from('platform_admins').insert({ user_id: user.id })).error).toBeNull();
  try {
    await page.reload();
    // The catalogue shows an admin button once the admin check has finished.
    await goTo(page, 'catalog');
    await expect(page.locator('[data-action="open-photo-library"]')).toBeVisible();
    await page.click('#suggest-button');
    await page.click('[data-action="open-app-feedback"]');
    const row = page.locator('tr', { hasText: message });
    await expect(row).toBeVisible();
    await expect(row).toContainText('customers');
  } finally {
    await admin.from('app_feedback').delete().eq('message', message);
    await admin.from('platform_admins').delete().eq('user_id', user.id);
  }
});

test('a TDS meter shows the built-in photo with its credit', async ({ page }) => {
  await signUpOwner(page);
  await goTo(page, 'catalog');
  await page.click('[data-action="new-product"]');
  await page.fill('#name', 'Digital TDS meter');
  await page.selectOption('#category', 'Accessories');
  await page.fill('#customer', '400');
  await page.fill('#technician', '350');
  await page.fill('#shop', '300');
  await page.click('#active-form [type="submit"]');
  const photo = page.locator('.product', { hasText: 'Digital TDS meter' }).locator('.product-art img');
  await expect(photo).toHaveAttribute('src', /type-photos\/meter\.jpg$/);
  await expect.poll(() => photo.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.photo-credits')).toContainText('Spotless property');
});
