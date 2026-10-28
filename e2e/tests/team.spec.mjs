import { test, expect, signUpOwner, signIn, signOut, goTo, invite, addCustomer, addProduct, selectOptionContaining, uniqueEmail, emailLink, acceptEmailLink, deleteMyAccount, password } from './helpers.mjs';

test('invited technician sets a password and gets technician access', async ({ page }) => {
  await signUpOwner(page);
  const technicianEmail = uniqueEmail('tech');
  await invite(page, { name: 'Ravi Teja', email: technicianEmail, role: 'Technician' });
  await expect(page.locator('#page')).toContainText(technicianEmail);
  await signOut(page);

  await acceptEmailLink(page, await emailLink(technicianEmail, /invit/i));
  await expect(page.locator('#user-role')).toHaveText(/technician/i);
  await expect(page.locator('.nav-item[data-view="accounts"]')).toBeHidden();
  await expect(page.locator('#role-control')).toBeHidden();

  await signOut(page);
  await signIn(page, technicianEmail);
});

test('invited customer sees only their own records', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Linked Customer');
  await addCustomer(page, 'Other Customer');
  const customerEmail = uniqueEmail('customer');
  await goTo(page, 'accounts');
  await page.click('[data-action="new-account"]');
  await page.fill('#active-form input[name="name"]', 'Linked Customer');
  await page.fill('#active-form input[name="username"]', customerEmail);
  await page.selectOption('#active-form select[name="role"]', 'Customer');
  await selectOptionContaining(page, '#active-form select[name="linked"]', 'Linked Customer');
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('#active-form')).toHaveCount(0);
  await signOut(page);

  await acceptEmailLink(page, await emailLink(customerEmail, /invit/i));
  await expect(page.locator('#user-role')).toHaveText(/customer/i);
  await expect(page.locator('.nav-item[data-view="accounts"]')).toBeHidden();
  await expect(page.locator('#page')).not.toContainText('Other Customer');
});

test('invited shop sees the catalogue at shop prices', async ({ page }) => {
  await signUpOwner(page);
  await addProduct(page, 'Wholesale Filter', { customer: 500, technician: 400, shop: 350 });
  const shopEmail = uniqueEmail('shop');
  await invite(page, { name: 'City Water Shop', email: shopEmail, role: 'Shop' });
  await signOut(page);

  await acceptEmailLink(page, await emailLink(shopEmail, /invit/i));
  await expect(page.locator('#user-role')).toHaveText(/shop/i);
  await goTo(page, 'catalog');
  await expect(page.locator('#page')).toContainText('₹350');
  await expect(page.locator('#page')).not.toContainText('₹500');
});

test('technician can still read jobs offline but cannot save changes', async ({ page }) => {
  await signUpOwner(page);
  await addCustomer(page, 'Basement Customer');
  const technicianEmail = uniqueEmail('tech');
  await invite(page, { name: 'Field Tech', email: technicianEmail, role: 'Technician' });
  await goTo(page, 'jobs');
  await page.click('[data-action="new-job"]');
  await page.fill('#active-form input[name="technician"]', 'Field Tech');
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('#active-form')).toHaveCount(0);
  await signOut(page);

  await acceptEmailLink(page, await emailLink(technicianEmail, /invit/i));
  await goTo(page, 'jobs');
  await expect(page.locator('#page')).toContainText('Basement Customer');

  // The Android app loads its screens from the device, so "offline" means only the backend is unreachable.
  await page.route(/127\.0\.0\.1:54321/, route => route.abort());
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }));
  await page.reload();
  await expect(page.locator('.offline-notice')).toBeVisible();
  await goTo(page, 'jobs');
  await expect(page.locator('#page')).toContainText('Basement Customer');
  await page.locator('[data-edit-job]').first().click();
  await page.click('#active-form [type="submit"]');
  await expect(page.locator('#toast-root')).toContainText('You are offline');
});

test('technician can delete their own account and the business keeps running', async ({ page }) => {
  const owner = await signUpOwner(page);
  await addCustomer(page, 'Kept Customer');
  const technicianEmail = uniqueEmail('tech');
  await invite(page, { name: 'Leaving Tech', email: technicianEmail, role: 'Technician' });
  await signOut(page);

  await acceptEmailLink(page, await emailLink(technicianEmail, /invit/i));
  await deleteMyAccount(page);

  await signIn(page, owner.email);
  await goTo(page, 'customers');
  await expect(page.locator('#page')).toContainText('Kept Customer');
  await goTo(page, 'accounts');
  await expect(page.locator('#page')).not.toContainText(technicianEmail);
});

test('last owner deleting their account removes the workspace and team logins', async ({ page }) => {
  const owner = await signUpOwner(page);
  const technicianEmail = uniqueEmail('tech');
  await invite(page, { name: 'Team Tech', email: technicianEmail, role: 'Technician' });
  const technicianLink = await emailLink(technicianEmail, /invit/i);

  await deleteMyAccount(page);

  for (const email of [owner.email, technicianEmail]) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('#auth-form [type="submit"]');
    await expect(page.locator('.auth-message')).toContainText(/invalid/i);
  }

  // The deleted technician's unused invite link must not open the app either.
  await page.goto(technicianLink);
  await expect(page.locator('#password-form')).toHaveCount(0);
});
