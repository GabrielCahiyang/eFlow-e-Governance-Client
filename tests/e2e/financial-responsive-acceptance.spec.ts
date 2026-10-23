import { expect, test } from '@playwright/test';
import { phase16FinancialFixture, phase16FinancialState } from './fixtures/phase16Financial';
import { nestedWorkStaffingFixture } from './fixtures/nestedWorkStaffing';
import { openCompletionRequirements } from './fixtures/projectActions';

for (const width of [390, 768]) test(`Funded work, cash request and itemized receipts fit ${width}px`, async ({ page }, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
  const state = phase16FinancialState();
  const { fixture } = await phase16FinancialFixture(page, 'accounting_staff', state);
  const work = fixture.tasks[0], allocation = '76000000-0000-4000-8000-000000000001', line = '77000000-0000-4000-8000-000000000001';
  fixture.projects[0].status = 'active'; work.deadline = '2026-10-31';
  await nestedWorkStaffingFixture(page, fixture);
  Object.assign(state.requests[0], { status: 'released', requester_id: fixture.id, cash_recipient_id: fixture.id, task_leader_id: fixture.id, task_id: work.id, requested_amount: 500, approved_amount: 500, released_amount: 500, allocation_id: allocation, allocation_line_id: line, funding_lines_payload: { lines: [{ allocationLineId: line, amount: 500 }] } });
  Object.assign(state.releases[0], { status: 'released', amount: 500, recipient_id: fixture.id, acknowledged_by: fixture.id, acknowledged_at: new Date().toISOString() });
  await page.route('**/rest/v1/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'petty_cash_liquidations' || name === 'petty_cash_receipts') return route.fulfill({ json: [] });
    if (name === 'budget_commitments') return route.fulfill({ json: [{ id: 'commitment-1', fiscal_budget_id: state.budget, title: 'QA funding', amount: 2000, status: 'active', funding_kind: 'direct_work', created_by: fixture.id }] });
    if (name === 'petty_cash_request_lines') return route.fulfill({ json: [{ request_id: state.requests[0].id, allocation_line_id: line, amount: 500 }] });
    if (name === 'get_task_funding_context') return route.fulfill({ json: { funded: true, supportsItemizedCash: true, fiscalYear: 2026, fundingOrgId: fixture.org, taskId: work.id, taskAllocationId: allocation, taskLeaderId: fixture.id, taskBudget: 2000, available: 1500, lines: [{ id: line, expenseClass: 'Operating expenses', category: 'Supplies', particular: 'Registration materials', fundSource: 'Office Budget', amount: 2000, available: 1500 }] } });
    if (name === 'work_budget_allocations') return route.fulfill({ json: [{ id: allocation, task_id: work.id, commitment_id: 'commitment-1', status: 'approved', amount: 2000 }] });
    if (name === 'work_budget_allocation_lines') return route.fulfill({ json: [{ id: line, allocation_id: allocation, amount: 2000, category: 'Supplies', particular: 'Registration materials' }] });
    return route.fallback();
  });
  await page.goto(`/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
  await expect(page.getByRole('region', { name: 'Project main table', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`funded-table-${width}.jpg`), fullPage: true });
  await page.getByRole('button', { name: `Actions for ${work.title}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Task details, evidence & review', exact: true }).click();
  const task = page.getByRole('region', { name: `Task details: ${work.title}`, exact: true });
  await expect(task).toBeVisible();
  await task.getByRole('tab', { name: 'Overview', exact: true }).click();
  await task.getByRole('button', { name: 'Request cash', exact: true }).click();
  await task.getByLabel('Amount', { exact: true }).fill('1600');
  await expect(task.getByRole('alert').filter({ hasText: 'exceeds the available funding' })).toBeVisible();
  await task.getByLabel('Amount', { exact: true }).fill('400');
  await task.getByLabel('Purchase and purpose', { exact: true }).fill('QA purchase of registration materials');
  await task.getByRole('button', { name: 'Request cash', exact: true }).scrollIntoViewIfNeeded();
  await expect(task.getByRole('button', { name: 'Request cash', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`cash-request-${width}.jpg`), fullPage: true });
  await task.getByRole('button', { name: 'Cancel', exact: true }).click();
  await task.getByRole('button', { name: 'Upload receipts', exact: true }).click();
  const liquidation = page.getByRole('dialog', { name: 'Upload receipts and return balance', exact: true });
  await expect(liquidation).toBeVisible();
  await liquidation.getByRole('button', { name: 'Add purchased item', exact: true }).click();
  await liquidation.getByLabel('Particulars', { exact: true }).fill('Registration supplies');
  await liquidation.getByLabel('Line amount', { exact: true }).fill('400');
  await liquidation.getByLabel('Official refund receipt number', { exact: true }).fill('QA-RETURN-100');
  await liquidation.getByLabel('Liquidation note', { exact: true }).fill('QA receipt with one hundred pesos returned.');
  const box = await liquidation.boundingBox();
  expect(box && box.x >= -1 && box.x + box.width <= width + 1).toBe(true);
  await liquidation.getByRole('button', { name: 'Cancel', exact: true }).scrollIntoViewIfNeeded();
  await expect(liquidation.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`itemized-liquidation-${width}.jpg`), fullPage: true });
  expect(state.writes).toHaveLength(0);
});

for (const width of [390, 768]) test(`Office Budget, approvals, completion and archived work fit ${width}px`, async ({ page }, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
  const { fixture, state } = await phase16FinancialFixture(page, 'head');
  const budget = page.locator('.eflow-budget-workspace');
  for (const view of ['overview', 'approvals']) {
    await page.goto(`/office-budget?page=Office+Budget&workspace=${fixture.org}&fy=2026&view=${view}`);
    await expect(budget.getByLabel('Budget fiscal scope and view filters')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`office-budget-${view}-${width}.jpg`), fullPage: true });
  }
  fixture.projects[0].status = 'active';
  await page.route('**/rest/v1/rpc/get_project_completion_readiness', route => route.fulfill({ json: {
    projectId: fixture.project, title: 'Community outreach', status: 'active', canComplete: false,
    blockers: [{ kind: 'cash', id: state.requests[0].id, title: 'Open cash settlement', status: 'pending_department_settlement', amount: 10000, detail: 'Accounting verification required' }],
  } }));
  await page.route('**/rest/v1/rpc/phase7_project_readiness', route => route.fulfill({ json: {
    projectId: fixture.project, stage: 'Active', governed: false, ready: true, canActivate: false,
    checks: [{ key: 'budget', label: 'Budget reviewed', detail: 'Current revision confirmed', ok: true }],
  } }));
  const url = `/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`;
  await page.goto(url);
  await expect(page.getByRole('region', { name: 'Project main table', exact: true })).toBeVisible();
  await openCompletionRequirements(page);
  const dialog = page.getByRole('dialog', { name: 'Mark project complete', exact: true });
  await expect(dialog.getByRole('region', { name: 'Finance', exact: true })).toContainText('Financial Officer');
  await expect(dialog.getByRole('button', { name: 'Confirm completion', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Project active', exact: true })).toHaveCount(0);
  const footer = await dialog.getByRole('button', { name: 'Cancel', exact: true }).boundingBox();
  expect(footer && footer.x >= 0 && footer.y + footer.height <= (page.viewportSize()!.height + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`completion-blocked-${width}.jpg`), fullPage: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  fixture.projects[0].status = 'archived';
  await page.goto(url);
  await expect(page.getByRole('region', { name: 'Project main table', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`archived-readonly-${width}.jpg`), fullPage: true });
  expect(state.writes).toHaveLength(0);
});
