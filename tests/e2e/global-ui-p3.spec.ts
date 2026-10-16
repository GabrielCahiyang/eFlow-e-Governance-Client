import { test, expect } from '@playwright/test';
import { globalUiP3Fixture } from './fixtures/globalUiP3';
test.skip(process.env.EFLOW_E2E !== '1', 'Opt-in synthetic browser suite');

test('P3 uses one Inbox destination host with rail, collapsed and mobile navigation', async ({ page }) => {
  await globalUiP3Fixture(page); await page.goto('/inbox');
  const fallback = page.getByRole('group', { name: 'Inbox categories' });
  await expect(fallback).toBeHidden();
  await expect(page.locator('.inbox-workflow-fallback')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Invitation workflow handoffs' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Inbox destinations' }).getByRole('button', { name: 'Updates', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Recent updates' })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse inbox sidebar', exact: true }).click();
  await expect(fallback).toBeVisible();
  await fallback.getByRole('button', { name: 'Needs action' }).click();
  await expect(fallback.getByRole('button', { name: 'Needs action' })).toHaveAttribute('aria-current', 'page');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(fallback).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'More', exact: true }).click();
  await expect(fallback).toBeHidden();
  await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name: 'Updates', exact: true }).click();
  await expect(fallback).toBeVisible(); await expect(page.getByRole('region', { name: 'Recent updates' })).toBeVisible();
  await page.goBack(); await expect(page.locator('[data-action-key]')).toHaveCount(1);
});

test('P3 Head membership stays local, restores route history and retains approval then dispatch', async ({ page }) => {
  const fixture = await globalUiP3Fixture(page); await page.goto('/reviews?view=tasks');
  await expect(page.getByRole('tab', { name: 'Membership approvals', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Head invitation approval Inbox' })).toHaveCount(0);
  expect(fixture.state.queueReads).toBe(0);
  await page.getByRole('tab', { name: 'Membership approvals', exact: true }).click();
  const queue = page.getByRole('region', { name: 'Head invitation approval Inbox' });
  await expect(queue.locator('summary')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('membership');
  await queue.locator('summary').click();
  await queue.getByRole('button', { name: 'Approve request', exact: true }).click();
  expect(fixture.state.decisions[0]).toEqual({ p_id: 'invitation-pending', p_revision: 1, p_action: 'approved' });
  await queue.getByRole('button', { name: 'Create invitation and send email', exact: true }).click();
  await expect(queue).toContainText('Email accepted by provider · receipt unconfirmed');
  await expect(queue).toContainText('Pending acceptance'); expect(fixture.state.mail[0]).toEqual({ revision: 2, resend: false });
  await page.getByRole('tab', { name: 'Budget', exact: true }).click();
  await expect(queue).toHaveCount(0); await page.goBack(); await expect(queue).toBeVisible();
  await page.reload(); await expect(page.getByRole('tab', { name: 'Membership approvals', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('P3 membership update opens its canonical project and unavailable reads are retryable', async ({ page }) => {
  const fixture = await globalUiP3Fixture(page); await page.goto('/inbox?page=Updates');
  await page.getByRole('region', { name: 'Recent updates' }).getByRole('button', { name: 'Open update', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Membership approvals', exact: true })).toHaveAttribute('aria-selected', 'true');
  const queue = page.getByRole('region', { name: 'Head invitation approval Inbox' });
  await expect(queue.getByRole('button', { name: 'Approve request', exact: true })).toBeVisible();
  fixture.state.queueError = 'Unavailable test function';
  await queue.getByRole('button', { name: 'Refresh membership approvals' }).click();
  await expect(queue.getByRole('alert')).toContainText('Membership approvals are unavailable');
  await expect(queue.getByText('No membership approvals pending', { exact: true })).toHaveCount(0);
  fixture.state.queueError = ''; await queue.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(queue.locator('summary')).toBeVisible();
});

test('P3 empty authorized sources show clear Inbox and membership states', async ({ page }) => {
  await globalUiP3Fixture(page, 'head', 'light', true); await page.goto('/inbox');
  await expect(page.getByText('No personal task or subtask reviews pending', { exact: true })).toBeVisible();
  await expect(page.locator('[data-action-key]')).toHaveCount(0);
  await page.goto('/reviews?view=membership');
  await expect(page.getByText('No membership approvals pending', { exact: true })).toBeVisible();
});

for (const role of ['member', 'accounting_staff'] as const) test(`P3 ${role} preserves local Lead reviews without membership scope`, async ({ page }) => {
  const fixture = await globalUiP3Fixture(page, role); await page.goto('/reviews?view=membership');
  await expect(page.getByRole('tab', { name: 'Subtasks', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).searchParams.get('view')).toBe('subtasks');
  await expect(page.getByRole('tab', { name: 'Membership approvals', exact: true })).toHaveCount(0);
  expect(fixture.state.queueReads).toBe(0);
  await page.getByRole('tab', { name: 'Budget', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Budget', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('P3 keeps dirty task review feedback until an accepted local workflow switch', async ({ page }) => {
  await globalUiP3Fixture(page); await page.goto('/reviews?view=tasks');
  await page.getByRole('button', { name: 'Request changes', exact: true }).click();
  const note = page.getByPlaceholder('Required: explain what needs to change…'); await note.fill('Keep this review feedback');
  await page.getByRole('tab', { name: 'Membership approvals', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(note).toHaveValue('Keep this review feedback'); expect(new URL(page.url()).searchParams.get('view')).toBe('tasks');
  await page.getByRole('tab', { name: 'Membership approvals', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Head invitation approval Inbox' })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) test(`P3 ${theme} compact review selector and task search retain workflow state`, async ({ page }) => {
  await globalUiP3Fixture(page, 'head', theme); await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/reviews?view=membership');
  const selector = page.getByRole('combobox', { name: 'Review type', exact: true });
  await selector.click(); await page.getByRole('option', { name: 'Project Tasks (1)', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Search review submissions', exact: true });
  expect((await page.locator('.eflow-review-search').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await search.fill('No submission matches this search');
  await expect(page.getByText('0 matching submissions', { exact: true })).toBeVisible();
  await expect(page.getByText(/No matches for/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(search).toHaveValue('');
  await selector.click(); await page.getByRole('option', { name: 'Membership approvals', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Head invitation approval Inbox' })).toBeVisible();
  await page.goBack(); await expect(selector).toContainText('Project Tasks');
});

for (const theme of ['light', 'dark'] as const) test(`P3 ${theme} long labels, all existing review types and empty membership across viewports`, async ({ page }, info) => {
  const fixture = await globalUiP3Fixture(page, 'head', theme);
  for (const view of ['tasks', 'workplans', 'governance', 'subtasks', 'budget', 'membership']) {
    await page.goto('/reviews?view=' + view); await expect(page.locator('#review-kind-' + view)).toHaveAttribute('aria-selected', 'true');
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    if (width < 1024) {
      const selector = page.getByRole('combobox', { name: 'Review type' });
      await expect(selector).toContainText('Membership approvals');
      await expect(page.getByRole('tablist')).toBeHidden();
      expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('region', { name: 'Head invitation approval Inbox' }).locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByRole('main', { name: 'Active workspace' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width < 1024) expect((await page.getByRole('button', { name: 'Approve request', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`membership-${theme}-${width}.png`), animations: 'disabled' });
    await page.getByRole('region', { name: 'Head invitation approval Inbox' }).locator('summary').click();
  }
  fixture.requests.length = 0; await page.getByRole('button', { name: 'Refresh membership approvals' }).click();
  await expect(page.getByText('No membership approvals pending', { exact: true })).toBeVisible();
});
