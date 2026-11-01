import { test, expect, signUpOwner, goTo, submitModal, addProduct, selectOptionContaining } from './helpers.mjs';

async function setUpBusiness(page) {
  await signUpOwner(page, { business: 'Sri Sai RO' });
  await goTo(page, 'accounts');
  await page.click('[data-action="business-details"]');
  await page.fill('#active-form input[name="gstin"]', '36ABCDE1234F1Z5');
  await page.fill('#active-form textarea[name="address"]', 'Kukatpally, Hyderabad');
  await page.selectOption('#active-form select[name="state"]', '36');
  await submitModal(page);
  await addProduct(page, 'Aqua Pro 8L', { customer: 10000, stock: 5 });
}

async function addCustomerInState(page, name, state, gstin = '') {
  await goTo(page, 'customers');
  await page.click('[data-action="new-customer"]');
  await page.fill('#active-form input[name="name"]', name);
  await page.fill('#active-form input[name="phone"]', '98480 22222');
  await page.fill('#active-form input[name="gstin"]', gstin);
  await page.selectOption('#active-form select[name="state"]', state);
  await submitModal(page);
}

async function invoiceAndPrint(page, customerName) {
  await goTo(page, 'sales');
  await page.locator('[data-action="new-sale"]').first().click();
  await page.selectOption('#active-form select[name="docType"]', 'Invoice');
  await selectOptionContaining(page, '#active-form select[name="customerId"]', customerName);
  await submitModal(page);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-print-doc]').first().click()]);
  await popup.waitForLoadState();
  return popup.locator('body');
}

test('invoice within the state shows CGST and SGST with seller and buyer details', async ({ page }) => {
  await setUpBusiness(page);
  await addCustomerInState(page, 'Local Customer', '36');
  const invoice = await invoiceAndPrint(page, 'Local Customer');
  await expect(invoice).toContainText('Tax Invoice');
  await expect(invoice).toContainText('Sri Sai RO');
  await expect(invoice).toContainText('GSTIN: 36ABCDE1234F1Z5');
  await expect(invoice).toContainText('Place of supply: 36 – Telangana');
  await expect(invoice).toContainText('CGST');
  await expect(invoice).toContainText('SGST');
  await expect(invoice).not.toContainText('IGST');
  await expect(invoice).toContainText('₹11,800');
});

test('invoice to another state shows IGST and keeps the details it was issued with', async ({ page }) => {
  await setUpBusiness(page);
  await addCustomerInState(page, 'Bengaluru Office', '29', '29ABCDE1234F1Z5');
  const invoice = await invoiceAndPrint(page, 'Bengaluru Office');
  await expect(invoice).toContainText('Place of supply: 29 – Karnataka');
  await expect(invoice).toContainText('IGST');
  await expect(invoice).not.toContainText('CGST');
  await expect(invoice).toContainText('GSTIN: 29ABCDE1234F1Z5');
  await invoice.page().close();

  // Renaming the business later must not change the issued invoice.
  await goTo(page, 'accounts');
  await page.click('[data-action="business-details"]');
  await page.fill('#active-form input[name="name"]', 'Renamed RO');
  await submitModal(page);
  await goTo(page, 'sales');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-print-doc]').first().click()]);
  await expect(popup.locator('body')).toContainText('Sri Sai RO');
});

test('owner marks an invoice paid, and cancelling it returns the stock', async ({ page }) => {
  await setUpBusiness(page);
  await addCustomerInState(page, 'Local Customer', '36');
  await goTo(page, 'sales');
  await page.locator('[data-action="new-sale"]').first().click();
  await page.selectOption('#active-form select[name="docType"]', 'Invoice');
  await selectOptionContaining(page, '#active-form select[name="customerId"]', 'Local Customer');
  await page.fill('#active-form .sale-qty', '2');
  await submitModal(page);
  await goTo(page, 'catalog');
  await expect(page.locator('#page')).toContainText('3 in stock');

  await goTo(page, 'sales');
  await page.locator('[data-doc-status]').first().selectOption('Paid');
  await page.reload();
  await goTo(page, 'sales');
  await expect(page.locator('[data-doc-status]').first()).toHaveValue('Paid');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-doc-status]').first().selectOption('Cancelled');
  await expect(page.locator('#page .status.cancelled')).toHaveText('Cancelled');
  await expect(page.locator('[data-doc-status]')).toHaveCount(0);
  await goTo(page, 'catalog');
  await expect(page.locator('#page')).toContainText('5 in stock');
});

test('owner sees changes in the activity log', async ({ page }) => {
  await setUpBusiness(page);
  await goTo(page, 'accounts');
  await expect(page.locator('#page')).toContainText('Activity log');
  await expect(page.locator('#page')).toContainText(/Product .* added/);
  await expect(page.locator('#page')).toContainText(/Business details .* changed/);
});
