import { expect, test } from '@playwright/test';

const accounts = process.env.EFLOW_E2E_ACCOUNTS
  ? JSON.parse(process.env.EFLOW_E2E_ACCOUNTS) as { role: string; email: string; password: string }[]
  : [];
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const role of ['member', 'head', 'accounting_staff']) {
  test(`signed-in ${role} can open the existing Work I lead bookmark`, async ({ page }) => {
    const account = accounts.find(item => item.role === role);
    test.skip(!account, 'No configured test account for this role.');
    if (!account) return;
    test.setTimeout(90000);
    await page.goto('/');
    await page.locator('#login-email').fill(account.email);
    await page.locator('#login-password').fill(account.password);
    await page.locator('#login-submit').click();
    await expect(page.getByRole('main', { name: 'Active workspace' })).toBeVisible({ timeout: 35000 });
    await page.goto('/my-work?page=Leading');
    const destination = page.getByRole('navigation', { name: 'My Work destinations' }).first();
    await expect(destination.getByRole('button', { name: 'Work I lead', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Work I lead', exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('Leading');
  });
}
