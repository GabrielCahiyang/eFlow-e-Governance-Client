import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture as fixture } from './fixtures/projectWorkspace';

test('Head table keeps first-column task actions, task edits and inline subitems', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 }); await fixture(page, 'head');
  await page.screenshot({ path: info.outputPath('main-table.png') });
  await page.getByRole('button', { name: 'Edit task Prepare community assessment', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'task Prepare community assessment' }); await title.fill('Prepare updated assessment'); await title.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task Prepare updated assessment' })).toBeVisible();
  const row = page.locator('.pt-task-row').filter({ has: page.getByRole('button', { name: 'Edit task Prepare updated assessment', exact: true }) });
  const actions = row.locator('td').first().getByRole('button', { name: 'Actions for Prepare updated assessment', exact: true });
  await expect(actions).toBeVisible();
  await expect(page.getByRole('button', { name: /^Drag / })).toHaveCount(0);
  await actions.press('Enter');
  await page.getByRole('menuitem', { name: 'Add subitem', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit subitem Gather supporting evidence/ })).toBeVisible();
  const subitems = page.getByRole('region', { name: 'Subitems for Prepare updated assessment', exact: true });
  await expect(subitems.getByRole('columnheader', { name: 'Subitem', exact: true })).toBeVisible();
  const subitemName = subitems.getByRole('textbox', { name: 'Add subitem to Prepare updated assessment' });
  await expect(subitemName).toBeFocused();
  await actions.press('Enter');
  await page.getByRole('menuitem', { name: 'Add subitem', exact: true }).click();
  await expect(subitemName).toBeFocused();
  expect((await subitemName.boundingBox())!.width).toBeGreaterThan(300);
  expect(await page.locator('.eflow-project-command').evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(24);
  await expect(subitems.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  await subitemName.fill('Prepare evidence index');
  await subitems.getByRole('columnheader', { name: 'Subitem', exact: true }).click();
  await expect(subitems.getByRole('button', { name: 'Edit subitem Prepare evidence index' })).toBeVisible();
  await expect(subitemName).toBeEmpty();
  await subitemName.fill('Prepare follow-up evidence'); await subitemName.press('Shift+Enter');
  await expect(subitems.getByRole('button', { name: 'Edit subitem Prepare follow-up evidence' })).toBeVisible();
  await expect(subitemName).toBeEmpty(); await expect(subitemName).toBeFocused();
  await page.screenshot({ path: info.outputPath('expanded-subitems.png') });
  await page.getByRole('button', { name: 'Collapse To do' }).click(); await page.getByRole('button', { name: 'New task', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'New task', exact: true }); await add.getByRole('textbox', { name: 'Task name' }).fill('Prepare meeting agenda'); await add.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(add).not.toBeVisible(); await page.getByRole('button', { name: 'Expand To do' }).click(); await expect(page.getByRole('button', { name: 'Edit task Prepare meeting agenda' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search project tasks' }).fill('meeting'); await expect(page.locator('.pt-task-row')).toHaveCount(1); await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Column actions for Budget estimate' }).click(); await page.getByRole('menuitem', { name: 'Hide column' }).click(); await expect(page.getByRole('columnheader', { name: 'Budget estimate' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Projects and proposals', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Create project', exact: true })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: 'Create work plan', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('Member table protects structure and keeps detail access at 390px', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 }); await fixture(page, 'member'); await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('complementary', { name: 'Projects context' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Edit task Prepare community assessment' })).toBeDisabled(); await expect(page.getByRole('combobox', { name: 'Owner for Prepare community assessment' })).toBeDisabled();
  await page.getByRole('button', { name: 'Subitems for Prepare community assessment' }).click();
  await expect(page.getByRole('textbox', { name: 'Add subitem to Prepare community assessment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open subitem Gather supporting evidence' })).toBeVisible();
  const subitems = page.getByRole('region', { name: 'Subitems for Prepare community assessment', exact: true });
  await subitems.getByRole('textbox', { name: 'Add subitem to Prepare community assessment' }).fill('Prepare mobile evidence');
  await expect(subitems.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  const subitemInput = subitems.getByRole('textbox', { name: 'Add subitem to Prepare community assessment' });
  const geometry=await subitemInput.evaluate(el=>{const rows=[];for(let current:Element|null=el;current&&rows.length<8;current=current.parentElement){const r=current.getBoundingClientRect();rows.push({class:current.className,x:r.x,width:r.width,container:getComputedStyle(current).containerType});}return rows;});expect((await subitemInput.boundingBox())!.x + (await subitemInput.boundingBox())!.width,JSON.stringify(geometry)).toBeLessThanOrEqual(390);
  await subitems.getByRole('columnheader', { name: 'Subitem', exact: true }).click();
  await expect(subitems.getByRole('button', { name: 'Edit subitem Prepare mobile evidence' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Prepare community assessment', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('main-table-mobile.png'), fullPage: true });
});

test('Inline tasks save on blur, keep adding with Shift+Enter, and retain failed drafts', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await fixture(page, 'head');
  const table = page.getByRole('table', { name: 'To do tasks', exact: true });
  const input = page.getByRole('textbox', { name: 'Add task to To do', exact: true });
  const adds: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/rpc/phase3_create_task')) adds.push(request.postDataJSON().p_title); });
  await input.fill('Prepare inline agenda');
  await expect(table.getByText('Press Shift + Enter to add another task')).toBeVisible();
  await expect(page.locator('.pt-add-row').getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('inline-task-draft.png') });
  await table.getByRole('columnheader', { name: 'Task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit task Prepare inline agenda' })).toBeVisible();
  await expect(input).toBeEmpty();
  for (const title of ['Prepare next agenda', 'Prepare third agenda']) {
    await input.fill(title); await input.press('Shift+Enter');
    await expect(page.getByRole('button', { name: 'Edit task ' + title })).toBeVisible();
    await expect(input).toBeEmpty(); await expect(input).toBeFocused();
  }
  expect(adds).toEqual(['Prepare inline agenda', 'Prepare next agenda', 'Prepare third agenda']);
  expect(records.tasks).toHaveLength(6);

  await page.route('**/rest/v1/rpc/phase3_create_task', route => route.fulfill({ status: 403, json: { message: 'Task creation denied', code: '42501' } }));
  await input.fill('Keep this draft'); await input.press('Enter');
  await expect(page.locator('.pt-add-row').getByRole('alert')).toContainText('Task creation denied');
  await expect(input).toHaveValue('Keep this draft');
  expect(records.tasks).toHaveLength(6);
  await page.unroute('**/rest/v1/rpc/phase3_create_task');
  await input.click(); await table.getByRole('columnheader', { name: 'Task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit task Keep this draft' })).toBeVisible();
  await expect(input).toBeEmpty();
  expect(records.tasks).toHaveLength(7);
});
