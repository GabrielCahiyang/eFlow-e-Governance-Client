import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

async function openView(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.count()) { await tab.click(); return; }
  await page.getByRole('button', { name: 'Add view', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^'+name+'\\b') }).last().click();
}

test('Phase 4 shares filters and edits across Board, Gantt, Calendar, Dashboard and Offices', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await projectWorkspaceFixture(page, 'head', true);
  const transitions: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/rpc/transition_task_status')) transitions.push(request.postDataJSON().p_to_status); });
  await page.getByRole('textbox', { name: 'Search project tasks' }).fill('briefing');
  await expect(page.locator('.pt-task-row')).toHaveCount(1);
  await openView(page, 'Gantt');
  await expect(page.getByRole('button', { name: 'Gantt task Coordinate Office briefing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gantt task Prepare community assessment', exact: true })).toHaveCount(0);
  await openView(page, 'Board');
  await expect(page.locator('.pv-board-card')).toHaveCount(1);
  const card = page.getByLabel('Board card Coordinate Office briefing', { exact: true });
  const moveCard = async (lane: string) => {
    const target = page.getByRole('region', { name: lane, exact: true });
    if (info.project.name === 'webkit' && process.platform === 'win32') {
      // Windows Playwright WebKit's native drag transport discards custom MIME
      // data. Exercise the same DOM handlers with an explicit transfer object;
      // Chromium and Firefox still exercise the native pointer drag.
      const transfer = await page.evaluateHandle(() => new DataTransfer());
      await card.dispatchEvent('dragstart', { dataTransfer: transfer });
      await target.dispatchEvent('dragover', { dataTransfer: transfer });
      await target.dispatchEvent('drop', { dataTransfer: transfer });
      await card.dispatchEvent('dragend', { dataTransfer: transfer });
      await transfer.dispose();
    } else {
      const bounds = (await card.boundingBox())!;
      await card.dragTo(target, { sourcePosition: { x: bounds.width - 4, y: bounds.height - 4 } });
    }
  };
  await moveCard('FOR REVIEW lane');
  await expect(page.getByRole('alert')).toContainText('required evidence');
  expect(transitions).toEqual([]);
  await moveCard('IN PROGRESS lane');
  await expect(page.getByRole('region', { name: 'IN PROGRESS lane', exact: true }).getByLabel('Board card Coordinate Office briefing', { exact: true })).toBeVisible();
  expect(transitions).toEqual(['in_progress']);
  await openView(page, 'Main table');
  await expect(page.getByRole('combobox', { name: 'Status for Coordinate Office briefing' })).toHaveValue('in_progress');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await openView(page, 'Gantt');
  const bar = page.getByRole('button', { name: 'Gantt task Prepare community assessment', exact: true });
  await bar.scrollIntoViewIfNeeded();
  const barBounds = (await bar.boundingBox())!;
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(barBounds.x + barBounds.width / 2 + 24, barBounds.y + barBounds.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply schedule', exact: true }).click();
  await expect.poll(() => records.tasks[0].start_date).toBe('2026-10-04');
  await expect.poll(() => records.tasks[0].deadline).toBe('2026-10-10');
  await page.getByRole('button', { name: 'Resize end of Prepare community assessment', exact: true }).press('ArrowRight');
  await page.getByRole('button', { name: 'Apply schedule', exact: true }).click();
  await expect.poll(() => records.tasks[0].deadline).toBe('2026-10-11');
  await expect(page.locator('.pv-dependencies path[marker-end]')).toHaveCount(1);
  await expect(page.getByRole('alertdialog', { includeHidden: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('gantt.png'), fullPage: true, animations: 'disabled' });
  await page.route('**/rest/v1/rpc/phase3_patch_task', route => route.fulfill({ status: 403, json: { message: 'Schedule change denied', code: '42501' } }));
  await page.getByRole('button', { name: 'Edit dates for Prepare community assessment', exact: true }).click();
  const dates = page.getByRole('dialog', { name: 'Task dates' });
  await dates.getByLabel('Due date', { exact: true }).fill('2026-10-15');
  await dates.getByRole('button', { name: 'Save dates' }).click();
  await page.getByRole('button', { name: 'Apply schedule', exact: true }).click();
  await expect(dates.getByRole('alert')).toContainText('Schedule change denied');
  expect(records.tasks[0].deadline).toBe('2026-10-11');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.unroute('**/rest/v1/rpc/phase3_patch_task');
  await openView(page, 'Calendar');
  await page.locator('.pv-calendar-dates summary').click();
  await page.getByRole('button', { name: 'Calendar dates for Prepare community assessment' }).click();
  await dates.getByLabel('Due date', { exact: true }).fill('2026-10-14');
  await dates.getByRole('button', { name: 'Save dates' }).click();
  await page.getByRole('button', { name: 'Apply schedule', exact: true }).click();
  await expect(dates).not.toBeVisible();
  await expect.poll(() => records.tasks[0].deadline).toBe('2026-10-14');
  const calendarEvent = page.locator('.fc-daygrid-event').filter({ hasText: 'Prepare community assessment' }).first();
  await calendarEvent.scrollIntoViewIfNeeded();
  const eventBounds = (await calendarEvent.boundingBox())!;
  const targetBounds = (await page.locator('.fc-daygrid-day[data-date="2026-10-15"]').boundingBox())!;
  await page.mouse.move(eventBounds.x + eventBounds.width / 2, eventBounds.y + eventBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBounds.x + targetBounds.width / 2, eventBounds.y + eventBounds.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply schedule', exact: true }).click();
  await expect.poll(() => records.tasks[0].deadline).toBe('2026-10-15');
  await expect(page.getByRole('alertdialog', { includeHidden: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true, animations: 'disabled' });
  await openView(page, 'Main table');
  await expect(page.getByRole('button', { name: 'Edit dates for Prepare community assessment' })).toContainText('Oct 15');
  await openView(page, 'Board');
  await expect(page.getByRole('region', { name: 'CANCELLED lane', exact: true })).toContainText('Cancelled duplicate');
  await expect(page.getByRole('region', { name: 'COMPLETED lane', exact: true })).not.toContainText('Cancelled duplicate');
  await page.screenshot({ path: info.outputPath('board.png'), fullPage: true });
  await openView(page, 'Project Dashboard');
  await expect(page.getByRole('region', { name: 'Project dashboard' })).toBeVisible();
  await expect(page.locator('.pv-stat-strip')).toContainText('All tasks4');
  await expect(page.getByRole('progressbar', { name: 'Overall task completion' })).toHaveAttribute('max', '3');
  await page.screenshot({ path: info.outputPath('dashboard.png'), fullPage: true });
  await openView(page, 'Offices');
  await expect(page.getByRole('region', { name: 'Project Offices', exact: true })).toContainText('Planning Office');
  await page.screenshot({ path: info.outputPath('offices.png'), fullPage: true });
  await page.getByRole('button', { name: 'View tasks', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter Office', exact: true })).toHaveValue(records.org);
  await expect(page.getByRole('region', { name: 'Project main table' })).toBeVisible();
});

test('Member can inspect views at 390px without structural date controls', async ({ page }, info) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page, 'member', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await openView(page, 'Gantt');
  await expect(page.getByRole('button', { name: 'Edit dates for Prepare community assessment' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resize end of Prepare community assessment' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('gantt-mobile.png'), fullPage: true });
  await openView(page, 'Calendar');
  await page.locator('.pv-calendar-dates summary').click();
  await expect(page.getByRole('button', { name: 'Calendar dates for Prepare community assessment' })).toBeDisabled();
  await openView(page, 'Board');
  await expect(page.getByRole('button', { name: 'Start Coordinate Office briefing', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
