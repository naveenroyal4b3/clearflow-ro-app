import { test, expect, signUpOwner, goTo } from './helpers.mjs';

test('a new owner can add sample data, see the first steps and remove it again', async ({ page }) => {
  await signUpOwner(page);
  const panel = page.locator('.getting-started');
  await expect(panel).toContainText('0 of 3 done');

  await panel.locator('[data-action="add-sample-data"]').click();
  await expect(page.locator('.toast')).toContainText('Sample data added');
  // Sample records don't count as the owner's own first steps.
  await expect(panel).toContainText('0 of 3 done');
  await goTo(page, 'customers');
  await expect(page.locator('main')).toContainText('Ravi Kumar (sample)');

  await goTo(page, 'overview');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-action="remove-sample-data"]').click();
  await expect(page.locator('.toast')).toContainText('Sample data removed');
  await goTo(page, 'customers');
  await expect(page.locator('main')).not.toContainText('Ravi Kumar (sample)');
});
