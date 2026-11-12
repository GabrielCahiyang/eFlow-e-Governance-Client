import { expect, test } from '@playwright/test';
import { nestedWorkStaffingFixture } from './fixtures/nestedWorkStaffing';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('project subtask schedule shows the current dates and constrains the editor', async ({ page }) => {
  test.setTimeout(90_000);
  const records = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  const fixture = await nestedWorkStaffingFixture(page, records);
  await page.route(/\/rest\/v1\/rpc\/r7_work_tree$/, async route => {
    const tree = fixture.snapshot();
    tree.root.scheduleBounds = {
      projectStart: '2026-11-15', projectDue: '2026-11-30',
      taskStart: '2026-11-18', taskDue: '2026-11-24',
    };
    tree.root.due = '2026-11-24';
    tree.nodes[0].start_date = '2026-11-19';
    tree.nodes[0].due_date = '2026-11-22';
    await route.fulfill({ json: tree });
  });

  await page.getByRole('navigation', { name: 'Global navigation' }).getByRole('button', { name: 'My Work', exact: true }).click();
  await page.getByRole('navigation', { name: 'My Work destinations' }).getByRole('button', { name: 'Leading', exact: true }).click();
  await page.locator('[data-personal-task]').filter({ hasText: 'Prepare community assessment' }).click();
  const task = page.getByRole('region', { name: 'Task details: Prepare community assessment' });
  await task.getByRole('button', { name: 'Gather supporting evidence', exact: true }).click();
  const subtask = page.getByRole('region', { name: 'Subtask: Gather supporting evidence' });
  await subtask.getByText('Schedule', { exact: true }).click();
  await expect(subtask.getByText('19 Nov 2026', { exact: true })).toBeVisible();
  await subtask.getByRole('button', { name: 'Edit schedule' }).click();

  const dialog = page.getByRole('dialog', { name: 'Edit subtask' });
  const start = dialog.getByLabel('Subtask start date');
  const due = dialog.getByLabel('Subtask due date');
  await expect(start).toHaveValue('2026-11-19');
  await expect(start).toHaveAttribute('min', '2026-11-18');
  await expect(due).toHaveValue('2026-11-22');
  await expect(due).toHaveAttribute('max', '2026-11-24');
  await due.fill('2026-11-25');
  expect(await due.evaluate(element => (element as HTMLInputElement).validity.rangeOverflow)).toBe(true);
});
