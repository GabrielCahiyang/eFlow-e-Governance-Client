import { expect, test } from '@playwright/test';
import type { StatusDefinition } from '../../src/app/features/work-status/statusDefinitions';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test.describe.configure({ timeout: 90_000 });

test('Admin can rename built-in statuses and maintain custom labels', async ({ page }) => {
  const definitions: StatusDefinition[] = [];
  await projectWorkspaceFixture(page, 'admin', false, { landingOnly: true });
  await page.route(/\/rest\/v1\/work_status_definitions(?:\?|$)/, async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: definitions });
    const definition = route.request().postDataJSON() as StatusDefinition;
    const index = definitions.findIndex(item => item.id === definition.id);
    if (index < 0) definitions.push(definition);
    else definitions[index] = definition;
    await route.fulfill({ status: 201 });
  });
  await page.goto('/users?page=Status+Maintenance');
  await expect(page.getByRole('heading', { name: 'Status Maintenance' })).toBeVisible({ timeout: 45_000 });
  for (const [oldLabel, newLabel] of [['To Do', 'To-do'], ['Completed', 'Finished'], ['Archived', 'Filed']]) {
    await page.getByRole('button', { name: `Edit ${oldLabel}`, exact: true }).click();
    await page.getByLabel('Status name').fill(newLabel);
    await page.getByRole('button', { name: 'Save status', exact: true }).click();
    await expect(page.getByRole('button', { name: `Edit ${newLabel}`, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Add status', exact: true }).click();
  await page.getByLabel('Status name').fill('Waiting for supplier');
  await page.getByLabel('Applies to').selectOption('subtask');
  await page.getByRole('button', { name: 'Save status', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Waiting for supplier' }).click();
  await page.getByLabel('Retire from new selections').check();
  await page.getByRole('button', { name: 'Save status', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Waiting for supplier' })).toContainText('Retired');
  expect(definitions.find(item => item.id === 'todo')?.label).toBe('To-do');
});

test('Project Main table and Analytics use the maintained status labels', async ({ page }) => {
  const fixture = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  await page.route(/\/rest\/v1\/work_status_definitions(?:\?|$)/, route => route.fulfill({ json: [
    { id: 'todo', label: 'To-do', scope: 'builtin', position: 20, retired: false, color: null },
    { id: 'completed', label: 'Finished', scope: 'builtin', position: 70, retired: false, color: null },
  ] }));
  await page.goto(`/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
  await expect(page.getByRole('button', { name: 'Update work status: To-do', exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Update work status: Finished', exact: true })).toBeVisible();
  await page.getByLabel('Filter status', { exact: true }).selectOption({ label: 'To-do' });
  await expect(page.getByRole('button', { name: 'Update work status: Finished', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse project views' }).click();
  await page.getByRole('dialog', { name: 'Browse project views' }).getByRole('button', { name: 'Analytics', exact: true }).click();
  const records = page.getByRole('table', { name: 'Task records' });
  await expect(records.getByText('Finished', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show filters and funding' }).click();
  const filters = page.getByRole('group', { name: 'Analytics filters' });
  await filters.getByRole('combobox', { name: 'Status', exact: true }).selectOption({ label: 'Finished' });
});
