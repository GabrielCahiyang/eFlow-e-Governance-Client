import { expect, test, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
test.setTimeout(90_000);
const filterButton = (page: Page) => page.getByRole('button', { name: /^Filters/ });
async function openFilters(page: Page) { await filterButton(page).click(); await expect(page.getByRole('region', { name: 'Work filters', exact: true })).toBeVisible(); }

test('P2 filters stay visible as chips and retain URL, reload, history and old bookmarks', async ({ page }) => {
  const fixture = await projectWorkspaceFixture(page, 'member', false, { landingOnly: true, leading: true });
  await page.goto('/my-work?page=Due+today');
  await expect(page.getByRole('button', { name: 'Remove Today filter', exact: true })).toBeVisible();
  await openFilters(page);
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Workspace scope', { exact: true }).selectOption(fixture.org);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(filterButton(page)).toHaveAccessibleName('Filters, 2 active');
  expect(new URL(page.url()).searchParams.get('workScope')).toBe(fixture.org);
  await page.reload(); await expect(filterButton(page)).toHaveAccessibleName('Filters, 2 active');
  await page.getByRole('button', { name: 'Remove Today filter', exact: true }).click();
  await expect(filterButton(page)).toHaveAccessibleName('Filters, 1 active');
  await page.goBack(); await expect(filterButton(page)).toHaveAccessibleName('Filters, 2 active');
  await page.goForward(); await expect(filterButton(page)).toHaveAccessibleName('Filters, 1 active');
  await page.getByRole('searchbox', { name: 'Search personal work' }).fill('No record matches this text');
  await expect(page.getByText('No matching work', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue(''); await expect(filterButton(page)).toHaveAccessibleName('Filters');
  await expect(page.locator('[data-work-key]')).not.toHaveCount(0);
  await page.goto('/my-work?page=Recently+completed');
  await expect(page.getByRole('button', { name: 'Remove Recently completed filter', exact: true })).toBeVisible();
  await openFilters(page); await expect(page.getByRole('checkbox', { name: /Recently completed/ })).toBeChecked();
  await page.keyboard.press('Escape'); await expect(filterButton(page)).toBeFocused();
  await page.getByRole('navigation', { name: 'My Work destinations' }).getByRole('button', { name: 'Assigned work', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Recently completed filter', exact: true })).toHaveCount(0);
  await openFilters(page); await expect(page.getByRole('checkbox', { name: /Recently completed/ })).toHaveCount(0);
});

test('P2 has one destination host and contextual tools across expanded, collapsed and mobile layouts', async ({ page }) => {
  await projectWorkspaceFixture(page, 'member', false, { landingOnly: true, leading: true });
  await page.goto('/my-work');
  await expect(page.locator('.r10-destination-host')).toBeHidden();
  const rail = page.getByRole('navigation', { name: 'My Work destinations' });
  await expect(rail.getByRole('button')).toHaveCount(4);
  await rail.getByText('More work tools', { exact: true }).click();
  for (const name of ['Task workspace', 'Deadline calendar', 'Performance', 'Work Report']) await expect(rail.getByRole('button', { name, exact: true })).toBeVisible();
  for (const name of ['Open Inbox', 'Office task board', 'Task history details', 'Subtask workflow', 'Lead workspace']) await expect(rail.getByRole('button', { name, exact: true })).toHaveCount(0);
  await rail.getByRole('button', { name: 'Subtasks', exact: true }).click();
  await expect(rail.getByRole('button', { name: 'Subtask workflow', exact: true })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Task workspace', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse my work sidebar', exact: true }).click();
  await expect(page.locator('.r10-destination-host')).toBeVisible();
  await page.getByRole('navigation', { name: 'My Work destinations' }).getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('.r10-destination-host')).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.locator('.r10-destination-host')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name: 'History', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('.r10-destination-host')).toBeVisible();
});

test('P2 narrow History filters keep their footer inside the viewport', async ({ page }) => {
  await projectWorkspaceFixture(page, 'head', false, { landingOnly: true, theme: 'dark' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/my-work?page=History'); await openFilters(page);
  await page.getByRole('checkbox', { name: /Recently completed/ }).check();
  const popup = page.locator('.r10-filter-popover');
  await popup.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  const box = (await popup.boundingBox())!, done = page.getByRole('button', { name: 'Done', exact: true }), footer = (await done.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(900);
  expect(footer.y + footer.height).toBeLessThanOrEqual(900); expect(footer.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('button', { name: 'Today', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('region', { name: 'Work filters', exact: true }).getByRole('button', { name: 'Clear filters', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await done.click();
  await expect(filterButton(page)).toBeFocused();
});

for (const role of ['head', 'member', 'accounting_staff'] as const) for (const theme of ['light', 'dark'] as const)
test(`P2 visual ${role} ${theme} long work, empty state, filters and responsive hosts`, async ({ page }, info) => {
  const fixture = await projectWorkspaceFixture(page, role, false, { landingOnly: true, leading: true, theme });
  fixture.tasks[0].title = 'Coordinate municipal community assessment and supporting project evidence with a long distinguishing work title';
  await page.goto('/my-work');
  const row = page.locator('[data-personal-task]').filter({ hasText: 'Coordinate municipal' });
  await expect(row).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(row).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByRole('main', { name: 'Active workspace' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`my-work-${role}-${theme}-${width}.png`), animations: 'disabled' });
    await openFilters(page); const panel = page.getByRole('region', { name: 'Work filters', exact: true });
    const box = await panel.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`filters-${role}-${theme}-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
  }
  const details = page.locator('li').filter({ has: row }).getByText('Details', { exact: true });
  await details.click(); await expect(page.locator('li').filter({has:row}).getByLabel('Work path', { exact: true })).toContainText('Coordinate municipal');
  await page.screenshot({ path: info.outputPath(`work-context-${role}-${theme}-320.png`), animations: 'disabled' });
  await page.getByRole('searchbox', { name: 'Search personal work' }).fill('Empty filtered result');
  await expect(page.getByText('No matching work', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`empty-${role}-${theme}-320.png`), animations: 'disabled' });
});
