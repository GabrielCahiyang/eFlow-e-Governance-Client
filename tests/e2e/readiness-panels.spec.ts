import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Setup, Completion and Settings can reopen readiness without subscribed-channel errors', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await projectWorkspaceFixture(page, 'head');
  for (const [button, title] of [
    ['Setup & activation', 'Project setup'],
    ['Completion requirements', 'Mark project complete'],
    ['Setup & activation', 'Project setup'],
    ['Completion requirements', 'Mark project complete'],
  ]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Project readiness reviews' })).toBeVisible();
    await dialog.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Project settings', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Project settings', exact: true });
  await expect(settings).toBeVisible();
  await expect(settings.getByText('Updates automatically')).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Refresh plan reviews', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Checks update over Realtime without refresh buttons and activation stays separated', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  const fixture = await projectWorkspaceFixture(page, 'head', false, { taskChanges: true });
  let confirmed = false, decisions = 0;
  const keys = ['structure','dates','budget','work','schedule','invitations','responsibilities','staffing','office_identity'];
  await page.route('**/rest/v1/rpc/get_project_completion_readiness', route => route.fulfill({ json: {
    projectId: fixture.project, title: 'Community outreach', status: 'planning', canComplete: false,
    blockers: [{ kind: 'task', id: fixture.tasks[0].id, taskId: fixture.tasks[0].id,
      title: 'Prepare community assessment', status: 'in_progress', detail: 'Finish and submit this task for approval.' },
      ...(!confirmed ? [{ kind: 'governance', id: fixture.project, title: 'Project dates confirmed',
        status: 'review_required', detail: 'Lead Head review is needed for this revision.' }] : [])],
  } }));
  await page.route('**/rest/v1/rpc/phase7_project_readiness', route => route.fulfill({ json: {
    projectId: fixture.project, stage: confirmed ? 'Ready' : 'Planning', ready: confirmed, canActivate: confirmed, governed: false,
    checks: keys.map(key => ({ key, label: key === 'dates' ? 'Project dates confirmed' : key,
      ok: key !== 'dates' || confirmed, detail: 'Current project review.' })),
  } }));
  await page.route('**/rest/v1/rpc/phase7_review_project', route => { decisions++; return route.fulfill({ json: null }); });
  await page.route('**/rest/v1/rpc/phase7_activate_project', route => { decisions++; return route.fulfill({ json: null }); });
  await page.getByRole('button', { name: 'Completion requirements', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mark project complete', exact: true });
  const panel = dialog.getByRole('region', { name: 'Project readiness reviews' });
  await expect(panel.getByText('Planning · 8 of 9 checks confirmed')).toBeVisible();
  await expect(dialog.locator('#project-completion-reason')).toContainText('2 completion requirement(s) remain.');
  await expect(panel.getByText('Updates automatically')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Refresh/ })).toHaveCount(0);
  const activate = panel.getByRole('button', { name: 'Activate project', exact: true });
  await activate.scrollIntoViewIfNeeded();
  const details = await panel.locator('details').boundingBox(), button = await activate.boundingBox();
  expect(details && button && button.y - details.y - details.height).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: info.outputPath('completion-automatic-1440.png') });
  confirmed = true; fixture.emitReadinessReview();
  await expect(panel.getByText('Ready · 9 of 9 checks confirmed')).toBeVisible({ timeout: 3000 });
  await expect(dialog.locator('#project-completion-reason')).toContainText('1 completion requirement(s) remain.');
  await expect(activate).toBeEnabled();
  expect(decisions).toBe(0);
  await page.screenshot({ path: info.outputPath('completion-ready-1440.png') });
});
