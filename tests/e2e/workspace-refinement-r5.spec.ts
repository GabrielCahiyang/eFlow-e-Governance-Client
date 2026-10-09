import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture as fixture } from './fixtures/projectWorkspace';

const title = 'Prepare community assessment';
test.beforeEach(async ({ page }) => { test.setTimeout(120_000); await page.setViewportSize({ width: 1440, height: 1000 }); });

test('new layouts are compact; the searchable catalogue shares visibility across groups and reloads', async ({ page }, info) => {
  const records = await fixture(page, 'head', false, { compactLayout: true });
  records.groups.push({ ...records.groups[0], id: '30000000-0000-4000-8000-000000000002', title: 'Follow-up', is_default: false, position: 1 });
  await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 });
  const table = page.getByRole('table', { name: 'To do tasks', exact: true });
  const other = page.getByRole('table', { name: 'Follow-up tasks', exact: true });
  await expect(page.locator('.pt-group').filter({ has: other }).locator('header')).toContainText('0 tasks · 0 subitems');
  await expect(table.getByRole('columnheader')).toHaveText(['', 'Task', 'Owner', 'Status', 'Due date', 'Priority', '']);
  const add = table.getByRole('button', { name: 'Add column', exact: true });
  const addBounds = (await add.boundingBox())!, scrollBounds = (await page.locator('.pt-table-scroll').first().boundingBox())!;
  expect(addBounds.x + addBounds.width).toBeLessThanOrEqual(scrollBounds.x + scrollBounds.width);
  await add.hover(); await expect(page.getByRole('tooltip')).toContainText('Add column');
  await add.press('Enter');
  const search = page.getByRole('textbox', { name: 'Search columns' });
  await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: 'Owner — already visible', exact: true })).toBeDisabled();
  await search.fill('formula'); await expect(page.getByRole('region', { name: 'Supported columns' }).getByRole('status')).toContainText('No supported columns');
  await search.fill('estimated'); await search.press('Tab');
  await expect(page.getByRole('button', { name: 'Estimated hours', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(search).toHaveCount(0); await expect(add).toBeFocused();
  await expect(table.getByRole('columnheader', { name: 'Estimated hours', exact: true })).toBeVisible();
  await expect(other.getByRole('columnheader', { name: 'Estimated hours', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 }); await expect(table.getByRole('spinbutton', { name: 'Estimated hours for ' + title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to compact defaults', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(table.getByRole('columnheader', { name: 'Estimated hours', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-slot=popover-content]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('r5-compact-desktop.png'), fullPage: true, animations: 'disabled' });
  // A deliberately short layout stays at its configured width instead of filling the workspace.
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  for (const field of ['Owner', 'Status', 'Due date', 'Priority']) await page.getByRole('checkbox', { name: field, exact: true }).uncheck();
  await page.keyboard.press('Escape');
  expect((await table.boundingBox())!.width).toBeLessThan(420);
  await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 }); await expect(table.getByRole('columnheader')).toHaveCount(3);
});

test('explicit all-visible layouts and widths survive; catalogue explains all-visible state', async ({ page }, info) => {
  await fixture(page, 'head');
  const table = page.getByRole('table', { name: 'To do tasks', exact: true });
  await expect(table.getByRole('columnheader')).toHaveCount(12);
  const resize = table.getByRole('separator', { name: 'Resize Task column' });
  await resize.focus(); await resize.press('Shift+ArrowRight');
  await table.getByRole('button', { name: 'Add column', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Supported columns' }).getByRole('status')).toContainText('All supported columns are visible');
  await expect(page.locator('.pt-column-options button')).toHaveCount(9);
  for (const button of await page.locator('.pt-column-options button').all()) await expect(button).toBeDisabled();
  await page.screenshot({ path: info.outputPath('r5-all-visible-catalogue.png') });
  await page.keyboard.press('Escape'); await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(resize).toHaveAttribute('aria-valuenow', '352'); await expect(table.getByRole('columnheader')).toHaveCount(12);
});

test('dates retain network failures and pending drafts, submit once, close on persisted success and restore focus', async ({ page }, info) => {
  const records = await fixture(page, 'head', true, { compactLayout: true });
  records.tasks[0].deadline = '2026-10-09T17:45:00+08:00'; await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 });
  let attempts = 0, finish!: () => void;
  const patches: unknown[] = [];
  await page.route('**/rest/v1/rpc/phase3_patch_task', async route => {
    attempts++; patches.push(route.request().postDataJSON().p_patch);
    if (attempts === 1) return route.abort('failed');
    await new Promise<void>(resolve => { finish = resolve; }); await route.fallback();
  });
  const cell = page.getByRole('button', { name: 'Edit dates for ' + title, exact: true });
  await cell.click(); const editor = page.locator('.pt-planning-editor');
  await editor.getByLabel('Due date', { exact: true }).fill('2026-10-15');
  await editor.getByRole('button', { name: 'Save dates', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible(); await expect(editor.getByLabel('Due date', { exact: true })).toHaveValue('2026-10-15');
  await editor.getByRole('button', { name: 'Save dates', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Save dates', exact: true })).toBeDisabled();
  await expect.poll(() => attempts).toBe(2);
  await editor.locator('form').dispatchEvent('submit'); await page.keyboard.press('Escape');
  await expect(editor).toBeVisible(); expect(attempts).toBe(2);
  await page.screenshot({ path: info.outputPath('r5-date-pending.png') });
  finish(); await expect(editor).toHaveCount(0); await expect(cell).toBeFocused();
  expect(patches).toEqual([{ start_date: '2026-10-03', deadline: '2026-10-15T17:45:00+08:00' }, { start_date: '2026-10-03', deadline: '2026-10-15T17:45:00+08:00' }]);
  await expect(cell).toContainText('Oct 15'); await page.reload(); await expect(page.getByRole('table', { name: 'To do tasks', exact: true })).toBeVisible({ timeout: 30_000 }); await expect(cell).toContainText('Oct 15');
  await cell.click(); await expect(editor.getByLabel('Due date', { exact: true })).toHaveValue('2026-10-15');
  const search = page.getByRole('textbox', { name: 'Search project tasks', exact: true });
  await search.click(); await expect(editor).toHaveCount(0); await expect(search).toBeFocused();
});

test('group counts, naming, color and inline creation retain their operations', async ({ page }, info) => {
  const records = await fixture(page, 'head', false, { compactLayout: true });
  const group = page.locator('.pt-group').first();
  await expect(group.locator('header')).toContainText('3 tasks · 1 subitem');
  await page.route('**/rest/v1/project_groups?**', route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    Object.assign(records.groups[0], route.request().postDataJSON()); return route.fulfill({ json: [{ id: records.groups[0].id }] });
  });
  await page.getByRole('button', { name: 'Edit group To do', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'group To do', exact: true });
  await name.fill('Delivery'); await name.press('Enter');
  await expect(page.getByRole('table', { name: 'Delivery tasks', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Color for Delivery', exact: true }).click();
  await page.getByRole('button', { name: 'Set group color #579bfc', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(group).toHaveCSS('--group-color', '#579bfc');
  await page.getByRole('button', { name: 'Collapse Delivery', exact: true }).click();
  await expect(group).toContainText('estimated hours'); await expect(group.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand Delivery', exact: true }).click();
  const add = page.getByRole('textbox', { name: 'Add task to Delivery', exact: true });
  await add.fill('Compact inline task'); await add.press('Shift+Enter'); await expect(add).toBeEmpty(); await expect(add).toBeFocused();
  await expect(group.locator('header')).toContainText('4 tasks · 1 subitem');
  await page.getByRole('button', { name: 'Subitems for ' + title, exact: true }).click();
  const subitem = page.getByRole('textbox', { name: 'Add subitem to ' + title, exact: true });
  await subitem.fill('Compact inline subitem'); await subitem.press('Shift+Enter'); await expect(subitem).toBeEmpty(); await expect(subitem).toBeFocused();
  await expect(group.locator('header')).toContainText('4 tasks · 2 subitems');
  await page.screenshot({ path: info.outputPath('r5-group-subitems.png'), fullPage: true });
});

test('catalogue and sticky task actions stay inside 320 and 390px light/dark workspaces', async ({ page }, info) => {
  await fixture(page, 'member', false, { compactLayout: true });
  const table = page.getByRole('table', { name: 'To do tasks', exact: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), width === 390);
    const scroll = page.locator('.pt-table-scroll').first(); await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    const add = table.getByRole('button', { name: 'Add column', exact: true });
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44); await add.click();
    const catalogue = page.getByRole('region', { name: 'Supported columns', exact: true });
    const bounds = (await catalogue.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath('r5-catalogue-' + width + '.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    const actions = table.getByRole('button', { name: 'Actions for ' + title, exact: true });
    const actionBounds = (await actions.boundingBox())!; expect(actionBounds.x).toBeGreaterThanOrEqual(0); expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(width);
    await actions.click(); await expect(page.getByRole('menuitem', { name: 'Add subitem', exact: true })).toBeEnabled(); await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
