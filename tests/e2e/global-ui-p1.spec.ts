import { expect, test, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
const primary = (page: Page) => page.getByRole('navigation', { name: 'Global navigation' });
test.setTimeout(90_000);

test('Reviews kind survives reload, history and returning to Inbox without rail leaves', async ({ page }) => {
  await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  await page.goto('/reviews?page=For+Review&view=subtasks');
  await expect(page.locator('#review-kind-subtasks')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#review-kind-workplans').click();
  expect(new URL(page.url()).searchParams.get('view')).toBe('workplans');
  await primary(page).getByRole('button', { name: 'My Work', exact: true }).click();
  await primary(page).getByRole('button', { name: 'Inbox', exact: true }).click();
  await expect(page.locator('#review-kind-workplans')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.locator('#review-kind-workplans')).toHaveAttribute('aria-selected', 'true');
  await page.goBack(); await page.goBack(); await page.goBack();
  await expect(page.locator('#review-kind-subtasks')).toHaveAttribute('aria-selected', 'true');
  const rail = page.getByRole('navigation', { name: 'Inbox destinations' });
  await expect(rail.getByRole('button', { name: 'Reviews', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(rail.getByRole('button', { name: 'Work Plans', exact: true })).toHaveCount(0);
});

for (const role of ['head', 'accounting_staff'] as const) test(`${role} Budget FY and local view survive context return and history`, async ({ page }) => {
  await projectWorkspaceFixture(page, role, false, { landingOnly: true });
  const path = role === 'head' ? '/office-budget?page=Office+Budget' : '/office-budget-ledgers?page=Office+Budget+Ledgers';
  await page.goto(path + '&view=journal&fy=2025');
  await expect(page.getByRole('combobox', { name: 'Budget view', exact: true })).toContainText('General Journal');
  await page.getByRole('combobox', { name: 'Budget view', exact: true }).click(); await page.getByRole('option', { name: 'Annual Budget', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('view')).toBe('annual');
  expect(new URL(page.url()).pathname).toBe(role === 'head' ? '/office-budget' : '/office-budget-ledgers');
  await page.goBack(); await expect(page.getByRole('combobox', { name: 'Budget view', exact: true })).toContainText('General Journal');
  await page.goForward(); await expect(page.getByRole('combobox', { name: 'Budget view', exact: true })).toContainText('Annual Budget');
  await primary(page).getByRole('button', { name: 'My Work', exact: true }).click();
  expect(new URL(page.url()).searchParams.has('fy')).toBe(false);
  await primary(page).getByRole('button', { name: role === 'head' ? 'Workspaces' : 'Accounting', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('fy')).toBe('2025');
  await expect(page.getByRole('combobox', { name: 'Budget view', exact: true })).toContainText('Annual Budget');
  await page.reload(); await expect(page.getByRole('combobox', { name: 'Budget view', exact: true })).toContainText('Annual Budget');
});

test('account access handoff agrees with route and rail and retains directory filters on return', async ({ page }) => {
  const fixture = await projectWorkspaceFixture(page, 'admin', false, { landingOnly: true });
  fixture.profiles.push({ ...fixture.profiles[0], id: '00000000-0000-4000-8000-000000000004', full_name: 'Ari another authorized account', email: 'ari@example.test', role: 'member' });
  fixture.profiles.push({ ...fixture.profiles[0], id: '00000000-0000-4000-8000-000000000003', full_name: 'Mara long account label for municipal project coordination', email: 'mara@example.test', role: 'member' });
  await page.reload();
  const search = page.getByRole('searchbox', { name: 'Search by name, email, role, or organization…' });
  await search.fill('Mara');
  const row = page.getByRole('row').filter({ hasText: 'Mara long account label' });
  const access = row.getByRole('button', { name: 'Access', exact: true });
  await access.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('User Access');
  await expect(page.getByRole('navigation', { name: 'Admin Center destinations' }).getByRole('button', { name: 'User Access', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Mara long account label for municipal project coordination', exact: true, level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Back to accounts', exact: true }).click();
  await expect(search).toHaveValue('Mara');
  await expect(access).toBeFocused();
  expect(new URL(page.url()).searchParams.get('page')).toBe('All Users');
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('eflow:context:')).some(([, value]) => value.includes('mara@example.test')))).toBe(false);
});

for (const role of ['head', 'member', 'admin', 'accounting_staff'] as const) for (const theme of ['light', 'dark'] as const)
test(`P1 visual evidence ${role} ${theme}`, async ({ page }, info) => {
  const fixture = await projectWorkspaceFixture(page, role, false, { landingOnly: true, leading: role !== 'head', theme, empty: role === 'member' });
  if (role === 'member') await page.goto('/deadlines?page=Deadlines');
  if (role === 'head') await page.goto('/reviews?page=For+Review&view=subtasks');
  if (role === 'accounting_staff') await page.goto('/office-budget-ledgers?page=Office+Budget+Ledgers&view=journal&fy=2025');
  await expect(page.locator('.eflow-app-shell')).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    if (width < 1024) {
      const mobile = page.getByRole('navigation', { name: 'Mobile primary navigation' });
      if (role !== 'admin') await expect(mobile.getByRole('button', { name: 'Workspaces', exact: true })).toBeVisible();
      await mobile.getByRole('button', { name: 'More', exact: true }).click();
    }
    await page.screenshot({ path: info.outputPath(`${role}-${theme}-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (role === 'head' || role === 'accounting_staff') expect(await page.locator('#eflow-active-workspace').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (width < 1024) { await page.keyboard.press('Escape'); await page.screenshot({ path: info.outputPath(`${role}-${theme}-${width}-closed.png`) }); }
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  const collapse = page.getByRole('button', { name: /Collapse .* sidebar/ });
  await collapse.click();
  await page.screenshot({ path: info.outputPath(`${role}-${theme}-collapsed.png`) });
  await expect(page.getByRole('button', { name: /Restore .* sidebar/ })).toBeVisible();
  expect(fixture.org).toBeTruthy();
});
