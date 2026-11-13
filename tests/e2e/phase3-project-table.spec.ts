import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture as fixture } from './fixtures/projectWorkspace';
import { nestedWorkStaffingFixture } from './fixtures/nestedWorkStaffing';

test('Project Lead allocates parent funding during Planning and edits subtask planning columns', async ({ page }) => {
  test.setTimeout(90_000);
  const records = await fixture(page, 'head', false, { landingOnly: true });
  const root = records.tasks[0], first = records.subtasks[0];
  const taskLead = '00000000-0000-4000-8000-000000000099';
  root.assigned_to = taskLead;
  const sibling = { ...first, id: '50000000-0000-4000-8000-000000000002', title: 'Prepare materials' };
  records.subtasks.push(sibling);
  const { snapshot } = await nestedWorkStaffingFixture(page, records);
  let priority: 'medium' | 'high' = 'medium';
  let prerequisites: string[] = [];
  let allocated = 0;
  const tree = () => ({
    ...snapshot(),
    supportsSubtaskDependencies: true,
    nodes: snapshot().nodes.map(node => ({
      ...node, priority: node.id === first.id ? priority : 'medium', can_edit_dependencies: true,
      dependency_ids: node.id === first.id ? prerequisites : [],
    })),
  });
  await page.route('**/rest/v1/rpc/r7_work_tree', route => route.request().postDataJSON().p_root === root.id
    ? route.fulfill({ json: tree() }) : route.fallback());
  await page.route('**/rest/v1/rpc/r7_work_command', route => {
    const { p_command, p_payload } = route.request().postDataJSON();
    expect(p_command).toBe('edit');
    expect(p_payload.id).toBe(first.id);
    if (p_payload.priority) priority = p_payload.priority;
    if (p_payload.dependency_ids) prerequisites = p_payload.dependency_ids;
    return route.fulfill({ json: tree() });
  });
  await page.route('**/rest/v1/rpc/get_task_funding_context', route => route.fulfill({ json: {
    funded: true, taskId: root.id, taskLeaderId: taskLead, taskBudget: 500,
    lines: [{ id: 'task-line', particular: 'Supplies', amount: 500, available: 500 - allocated }],
    cap: allocated ? { id: 'cap', amount: allocated, available: allocated, allocationLineId: 'task-line', reason: 'Supplies purchase' } : null,
  } }));
  await page.route('**/rest/v1/rpc/m7_work_allocation_context', route => {
    expect(route.request().postDataJSON()).toEqual({ p_task: root.id, p_node: first.id });
    return route.fulfill({ json: { canAllocate: true, lines: [{ id: 'task-line', name: 'Supplies', available: 500 }] } });
  });
  await page.route('**/rest/v1/rpc/set_subtask_budget_cap', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      p_task_id: root.id, p_subtask_id: first.id, p_parent_allocation_line_id: 'task-line', p_amount: 250,
    });
    allocated = 250;
    return route.fulfill({ json: 'cap' });
  });
  await page.goto(`/projects?page=Projects&workspace=${records.org}&project=${records.project}&view=tasks`);
  await page.getByRole('button', { name: `Subtasks for ${root.title}`, exact: true }).click();
  const table = page.getByRole('table', { name: 'Subtask hierarchy' });
  await expect(table.getByRole('columnheader', { name: 'Progress' })).toHaveCount(0);
  await table.getByLabel(`Priority for ${first.title}`).selectOption('high');
  await expect.poll(() => priority).toBe('high');
  await table.getByRole('button', { name: `Edit dependencies for ${first.title}` }).click();
  await page.getByRole('checkbox', { name: /^Prepare materials/ }).check();
  await page.getByRole('button', { name: 'Save dependencies' }).click();
  await expect(table.getByRole('button', { name: `Edit dependencies for ${first.title}` })).toHaveText('Waiting for 1 subtask');
  await page.keyboard.press('Escape');
  await table.getByRole('button', { name: 'Add column', exact: true }).click();
  await page.getByRole('region', { name: 'Supported subtask columns' }).getByRole('button', { name: 'Budget', exact: true }).click();
  const budget = table.getByRole('button', { name: `Budget for ${first.title}` });
  await budget.click();
  const dialog = page.getByRole('dialog', { name: `Subtask budget · ${first.title}` });
  await dialog.getByLabel('Subtask budget amount').fill('250');
  await dialog.getByLabel('Subtask allocation reason').fill('Supplies purchase');
  await dialog.getByRole('button', { name: 'Allocate subtask budget' }).click();
  await expect(dialog.getByText('Allocated: ₱250.00')).toBeVisible();
});

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
  await page.getByRole('menuitem', { name: 'Add subtask', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit subtask Gather supporting evidence/ })).toBeVisible();
  const subitems = page.getByRole('region', { name: 'Subtasks for Prepare updated assessment', exact: true });
  await expect(subitems.getByRole('columnheader', { name: 'Subtask', exact: true })).toBeVisible();
  const subitemName = subitems.getByRole('textbox', { name: 'Add subtask to Prepare updated assessment' });
  const subtaskDueDate = subitems.getByLabel('Due date for new subtask to Prepare updated assessment');
  await expect(subitemName).toBeFocused();
  await actions.press('Enter');
  await page.getByRole('menuitem', { name: 'Add subtask', exact: true }).click();
  await expect(subitemName).toBeFocused();
  expect((await subitemName.boundingBox())!.width).toBeGreaterThan(300);
  expect(await page.locator('.eflow-project-command').evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(24);
  await subitemName.fill('Prepare evidence index');
  await subtaskDueDate.fill('');
  await subitems.getByRole('button', { name: 'Add subtask', exact: true }).click();
  await expect(subitems.getByRole('button', { name: 'Edit subtask Prepare evidence index' })).toBeVisible();
  await expect(subitemName).toBeEmpty();
  await subitemName.fill('Prepare follow-up evidence'); await subitemName.press('Shift+Enter');
  await expect(subitems.getByRole('button', { name: 'Edit subtask Prepare follow-up evidence' })).toBeVisible();
  await expect(subitemName).toBeEmpty(); await expect(subitemName).toBeFocused();
  await page.screenshot({ path: info.outputPath('expanded-subitems.png') });
  await page.getByRole('button', { name: 'Collapse To do' }).click(); await page.getByRole('button', { name: 'New task', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'New task', exact: true }); await add.getByRole('textbox', { name: 'Task name' }).fill('Prepare meeting agenda'); await add.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(add).not.toBeVisible(); await page.getByRole('button', { name: 'Expand To do' }).click(); await expect(page.getByRole('button', { name: 'Edit task Prepare meeting agenda' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search project tasks' }).fill('meeting'); await expect(page.locator('.pt-task-row')).toHaveCount(1); await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Column actions for Budget' }).click(); await page.getByRole('menuitem', { name: 'Hide column' }).click(); await expect(page.getByRole('columnheader', { name: 'Budget' })).toHaveCount(0);
  await page.getByRole('button', { name: '← All projects', exact: true }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  const createProject = page.getByRole('dialog', { name: 'Create project' });
  await expect(createProject).toBeVisible();
  expect((await createProject.boundingBox())!.width).toBeLessThanOrEqual(800);
  await expect(createProject.getByRole('complementary',{name:'Project setup guidance'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(createProject.getByRole('complementary',{name:'Project setup guidance'})).toBeHidden();
  await expect(createProject.getByRole('button',{name:'Next'})).toBeVisible();
  await page.keyboard.press('Escape');
});

test('Member table protects structure and keeps detail access at 390px', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 }); await fixture(page, 'member'); await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('complementary', { name: 'Projects context' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Edit task Prepare community assessment' })).toBeDisabled(); await expect(page.getByRole('combobox', { name: 'Owner for Prepare community assessment' })).toBeDisabled();
  await page.getByRole('button', { name: 'Subtasks for Prepare community assessment' }).click();
  await expect(page.getByRole('textbox', { name: 'Add subtask to Prepare community assessment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open subtask Gather supporting evidence' })).toBeVisible();
  const subitems = page.getByRole('region', { name: 'Subtasks for Prepare community assessment', exact: true });
  await subitems.getByRole('textbox', { name: 'Add subtask to Prepare community assessment' }).fill('Prepare mobile evidence');
  const subitemInput = subitems.getByRole('textbox', { name: 'Add subtask to Prepare community assessment' });
  await subitems.getByLabel('Due date for new subtask to Prepare community assessment').fill('');
  const geometry=await subitemInput.evaluate(el=>{const rows=[];for(let current:Element|null=el;current&&rows.length<8;current=current.parentElement){const r=current.getBoundingClientRect();rows.push({class:current.className,x:r.x,width:r.width,container:getComputedStyle(current).containerType});}return rows;});expect((await subitemInput.boundingBox())!.x + (await subitemInput.boundingBox())!.width,JSON.stringify(geometry)).toBeLessThanOrEqual(390);
  await subitems.getByRole('button', { name: 'Add subtask', exact: true }).click();
  await expect(subitems.getByRole('button', { name: 'Edit subtask Prepare mobile evidence' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Prepare community assessment', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('main-table-mobile.png'), fullPage: true });
});

test('Inline tasks save on leave and recover an uncertain creation without duplicates', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await fixture(page, 'head');
  const table = page.getByRole('table', { name: 'To do tasks', exact: true });
  const input = page.getByRole('textbox', { name: 'Add task to To do', exact: true });
  const rpc = '**/rest/v1/rpc/create_inline_project_task';
  const attempts: { p_title: string; p_verify_only: boolean; p_request: string }[] = [];
  page.on('request', request => { if (request.url().endsWith('/rpc/create_inline_project_task')) attempts.push(request.postDataJSON()); });
  await page.getByRole('button', { name: 'Collapse To do' }).click();
  await page.getByRole('button', { name: 'New task options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add task', exact: true }).click();
  await expect(input).toBeFocused();
  await input.fill('Prepare inline agenda');
  await expect(table.getByText('Click outside or press Enter to add.', { exact: false })).toBeVisible();
  await table.getByRole('columnheader', { name: 'Task', exact: true }).click();
  const added = table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Edit task Prepare inline agenda' }) });
  await expect(added).toContainText('Needs a lead');
  await expect(input).toBeEmpty();
  for (const title of ['Prepare next agenda', 'Prepare third agenda']) {
    await input.fill(title); await input.press('Shift+Enter');
    await expect(page.getByRole('button', { name: 'Edit task ' + title })).toBeVisible();
    await expect(input).toBeEmpty(); await expect(input).toBeFocused();
  }
  expect(attempts.map(attempt => attempt.p_title)).toEqual(['Prepare inline agenda', 'Prepare next agenda', 'Prepare third agenda']);
  expect(records.tasks).toHaveLength(6);

  await page.route(rpc, route => route.fulfill({ status: 403, json: { message: 'Task creation denied', code: '42501' } }));
  await input.fill('Keep this draft'); await input.press('Enter');
  await expect(page.locator('.pt-add-row').getByRole('alert')).toContainText('Task creation denied');
  await expect(input).toHaveValue('Keep this draft');
  expect(records.tasks).toHaveLength(6);
  await page.unroute(rpc);
  await page.getByRole('button', { name: 'Retry task creation' }).click();
  await expect(page.getByRole('button', { name: 'Edit task Keep this draft' })).toBeVisible();
  await expect(input).toBeEmpty();
  expect(records.tasks).toHaveLength(7);

  // Simulate the database committing while the original HTTP response is lost.
  await page.route(rpc, async route => {
    const payload = route.request().postDataJSON();
    const taskId = crypto.randomUUID();
    records.tasks.push({ ...records.tasks.at(-1), id: taskId, title: payload.p_title });
    await page.unroute(rpc);
    await page.route(rpc, verify => verify.request().postDataJSON().p_verify_only ? verify.fulfill({ json: taskId }) : verify.fallback());
    await route.fulfill({ status: 503, json: { message: 'Response lost' } });
  });
  await input.fill('Committed before disconnect');
  await input.press('Enter');
  await expect(table.getByRole('alert')).toContainText('Response lost');
  await expect(input).toHaveValue('Committed before disconnect');
  await page.getByRole('button', { name: 'Retry task creation' }).click();
  await expect(table.getByRole('button', { name: 'Edit task Committed before disconnect' })).toBeVisible();
  await expect(input).toBeEmpty();
  expect(attempts.slice(-2)).toEqual([
    expect.objectContaining({ p_verify_only: false }),
    expect.objectContaining({ p_verify_only: true, p_request: attempts.at(-2)!.p_request }),
  ]);
  expect(records.tasks).toHaveLength(8);

  await page.unroute(rpc);
  await page.route(rpc, route => route.fulfill({ status: 503, json: { message: 'Connection interrupted' } }));
  await input.fill('Retry after no commit');
  await input.press('Enter');
  await expect(table.getByRole('alert')).toContainText('Connection interrupted');
  await page.unroute(rpc);
  await page.getByRole('button', { name: 'Retry task creation' }).click();
  await expect(table.getByRole('button', { name: 'Edit task Retry after no commit' })).toBeVisible();
  const [original, verification, retry] = attempts.slice(-3);
  expect([original.p_verify_only, verification.p_verify_only, retry.p_verify_only]).toEqual([false, true, false]);
  expect([verification.p_request, retry.p_request]).toEqual([original.p_request, original.p_request]);
  expect(records.tasks).toHaveLength(9);
});
