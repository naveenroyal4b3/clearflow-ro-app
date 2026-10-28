import { test, expect, signUpOwner, signIn, signOut, goTo, invite, addCustomer, uniqueEmail, emailLink, acceptEmailLink, deleteMyAccount, password } from './helpers.mjs';

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
