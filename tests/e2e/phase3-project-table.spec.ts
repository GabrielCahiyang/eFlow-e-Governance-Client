import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture as fixture } from './fixtures/projectWorkspace';

test('Head table edits work, keeps subitems and creates a project with a usable group', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 }); await fixture(page, 'head');
  await page.screenshot({ path: info.outputPath('main-table.png') });
  await page.getByRole('button', { name: 'Edit task Prepare community assessment', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'task Prepare community assessment' }); await title.fill('Prepare updated assessment'); await title.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task Prepare updated assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Subitems for Prepare updated assessment' }).click();
  await expect(page.getByRole('button', { name: /Edit subitem Gather supporting evidence/ })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse To do' }).click(); await page.getByRole('button', { name: 'New task', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'New task', exact: true }); await add.getByRole('textbox', { name: 'Task name' }).fill('Prepare meeting agenda'); await add.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(add).not.toBeVisible(); await page.getByRole('button', { name: 'Expand To do' }).click(); await expect(page.getByRole('button', { name: 'Edit task Prepare meeting agenda' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search project tasks' }).fill('meeting'); await expect(page.locator('.pt-task-row')).toHaveCount(1); await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Column actions for Budget estimate' }).click(); await page.getByRole('menuitem', { name: 'Hide column' }).click(); await expect(page.getByRole('columnheader', { name: 'Budget estimate' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Let’s start working together' }); await dialog.getByRole('textbox', { name: 'Project name' }).fill('New Office project'); await page.screenshot({ path: info.outputPath('quick-create.png') });
  await dialog.getByRole('button', { name: /Create project/ }).click(); await expect(dialog).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Edit project name', exact: true })).toHaveText('New Office project'); await expect(page.getByRole('textbox', { name: 'Add task to To do' })).toBeVisible();
});

test('Member table protects structure and keeps detail access at 390px', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 }); await fixture(page, 'member'); await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Edit task Prepare community assessment' })).toBeDisabled(); await expect(page.getByRole('combobox', { name: 'Owner for Prepare community assessment' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open Prepare community assessment', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('main-table-mobile.png'), fullPage: true });
});
