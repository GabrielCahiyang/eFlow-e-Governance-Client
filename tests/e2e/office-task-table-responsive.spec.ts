import { expect, test } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

// Desktop zoom layout equivalents: physical desktop dimensions / page zoom,
// with matching DPR. This tests reflow, rather than a pinch-zoom screenshot.
const scenarios = [
  [1920, 1080, 1], [1920, 1080, 1.25], [1920, 1080, 1.5], [1920, 1080, 1.75], [1920, 1080, 2],
  [1440, 900, 1], [1440, 900, 1.25], [1440, 900, 1.5], [1440, 900, 2],
  [1366, 768, 1], [1366, 768, 1.25], [1280, 800, 1],
];
const title = 'QA Verify supplies and publish handover report to the Planning Office';

for (const [width, height, zoom] of scenarios) test.describe(`${width}px desktop at ${zoom * 100}% zoom equivalent`, () => {
  test.use({ viewport: { width: Math.floor(width / zoom), height: Math.floor(height / zoom) }, deviceScaleFactor: zoom, isMobile: false });
  test('completed tasks keep readable columns, full metadata and working menus', async ({ page }, info) => {
    test.setTimeout(60000);
    const fixture = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
    fixture.tasks.forEach((task, index) => Object.assign(task, {
      title: index === 0 ? title : index === 1 ? 'QA Publish final documentation and archive reference pack' : 'QA Complete materials review',
      status: index < 2 ? 'completed' : 'in_progress', percent_complete: index < 2 ? 100 : 50,
      assignee_name: 'Crisostomo Ibarra', team_name: 'Community outreach delivery team',
      team_member_names: ['Crisostomo Ibarra', 'Gabriel Cahiyang'],
      deadline: '2026-10-30', project_title: 'Community outreach',
      tags: ['Documentation', 'A-reference-without-spaces-that-must-not-push-the-table-outside-the-pane'],
    }));
    const writes: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET' && /\/rest\/v1\//.test(request.url())) writes.push(request.url()); });
    await page.goto(`/tasks?page=Office+tasks&workspace=${fixture.org}`);
    const list = page.locator('.eflow-task-list');
    await expect(list).toBeVisible();
    const context = page.getByRole('complementary', { name: 'Task board context', exact: true });
    await context.getByRole('button', { name: /Community outreach/ }).click();
    // Keep all empty status drop targets available, but collapse them for a
    // useful screenshot of the reported completed-group problem.
    for (const label of ['Pending', 'To Do', 'In Progress', 'Changes Requested', 'For Review', 'Cancelled']) {
      const group = list.getByRole('button', { name: new RegExp(`^${label} \\(`) });
      if (await group.count() && await group.getAttribute('aria-expanded') === 'true') await group.click();
    }
    const row = list.locator('.eflow-task-row').filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.locator('.eflow-task-row__title')).toHaveText(title);
    await expect(row.locator('.eflow-task-row__team')).toContainText('Crisostomo Ibarra');
    await expect(row.locator('.eflow-task-row__lead > span').first()).toHaveText('CI');
    await expect(row.locator('.eflow-task-row__priority')).toBeVisible();
    await expect(row.locator('.eflow-task-row__due')).toContainText('Oct 30, 2026');
    await expect(row.locator('.eflow-task-row__status')).toContainText('Completed');
    const geometry = await row.evaluate(element => {
      const cells = [...element.children].map(cell => { const r = cell.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: r.width }; });
      return { cells, titleWidth: element.querySelector('.eflow-task-row__title')!.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
        rowOverflow: element.scrollWidth > element.clientWidth + 1 };
    });
    expect(geometry.titleWidth).toBeGreaterThanOrEqual(190);
    expect(geometry.overflow).toBe(false);
    expect(geometry.rowOverflow).toBe(false);
    for (const cell of geometry.cells) { expect(cell.x).toBeGreaterThanOrEqual(-1); expect(cell.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1); }
    for (let a = 0; a < geometry.cells.length; a++) for (let b = a + 1; b < geometry.cells.length; b++) {
      const first = geometry.cells[a], second = geometry.cells[b];
      expect(first.right <= second.x + 1 || second.right <= first.x + 1 || first.bottom <= second.y + 1 || second.bottom <= first.y + 1).toBe(true);
    }
    const header = list.locator('.eflow-task-table-header');
    if (await header.isVisible()) for (const column of ['priority', 'due', 'status', 'actions']) {
      const heading = await header.locator(`[data-column="${column}"]`).boundingBox();
      const cell = await row.locator(`.eflow-task-row__${column}`).boundingBox();
      expect(heading && cell && Math.abs(heading.x - cell.x) < 1).toBe(true);
    }
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`office-tasks-${width}-${zoom * 100}.png`), fullPage: true });
    await row.getByRole('button', { name: `Open actions for ${title}`, exact: true }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Reopen task', exact: true })).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= page.viewportSize()!.width + 1).toBe(true);
    expect(menuBox && menuBox.y >= 0 && menuBox.y + menuBox.height <= page.viewportSize()!.height + 1).toBe(true);
    await page.keyboard.press('Escape');
    await expect(row.getByRole('button', { name: `Open actions for ${title}`, exact: true })).toBeFocused();
    const completed = list.getByRole('button', { name: /^Completed \(/ });
    await completed.click(); await expect(row).toHaveCount(0);
    await completed.click(); await expect(row).toBeVisible();
    // Opening the board can read context through a POST RPC; mutations must
    // still stay absent during responsive display/menu/disclosure checks.
    expect(writes.filter(url => /(?:update|delete|archive|reopen|assign|create)_/.test(url))).toEqual([]);
  });
});
