import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Head can delete a task, then delete its now-empty group', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await projectWorkspaceFixture(page, 'head', false, { compactLayout: true });
  const groupId = '30000000-0000-4000-8000-000000000099';
  records.groups.push({ ...records.groups[0], id: groupId, title: 'Test New Group', is_default: false, position: 1 });
  Object.assign(records.tasks[0], { group_id: groupId, status: 'todo' });
  await page.reload();
  let deleted = 0, deletedGroups = 0;
  await page.route('**/rest/v1/rpc/soft_delete_task', route => {
    deleted++;
    const index = records.tasks.findIndex(t => t.id === route.request().postDataJSON().p_task_id);
    records.tasks.splice(index, 1);
    return route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/rpc/delete_empty_project_group', route => {
    deletedGroups++;
    expect(route.request().postDataJSON().p_group_id).toBe(groupId);
    records.groups.splice(records.groups.findIndex(g => g.id === groupId), 1);
    return route.fulfill({ json: null });
  });
  const group = page.getByRole('button', { name: 'Group actions for Test New Group', exact: true });
  await group.click();
  await expect(page.getByRole('menuitem', { name: 'Delete empty group', exact: true })).toBeDisabled();
  await expect(page.getByText('This group still has tasks. Move or delete them first. Archived tasks must be moved too.')).toBeVisible();
  await page.keyboard.press('Escape');
  const actions = page.getByRole('button', { name: 'Actions for Prepare community assessment', exact: true });
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete task', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete task?', exact: true });
  await expect(confirm).toContainText('Prepare community assessment');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(deleted).toBe(0);
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete task', exact: true }).click();
  await page.screenshot({ path: info.outputPath('delete-task-confirmation.png') });
  await confirm.getByRole('button', { name: 'Delete task', exact: true }).click();
  await expect(actions).toHaveCount(0);
  expect(deleted).toBe(1);
  await group.click();
  await page.getByRole('menuitem', { name: 'Delete empty group', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Delete Test New Group?', exact: true }).getByRole('button', { name: 'Delete group', exact: true }).click();
  await expect(group).toHaveCount(0);
  expect(deletedGroups).toBe(1);
  expect(records.tasks).toHaveLength(2);
});

test('member task menu does not expose Head deletion', async ({ page }) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page, 'member');
  await page.getByRole('button', { name: 'Actions for Prepare community assessment', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Delete task', exact: true })).toHaveCount(0);
});
