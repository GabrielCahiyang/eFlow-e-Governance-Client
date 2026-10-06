import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

async function expectVisibleViewPicker(page: Page) {
  await page.getByRole('button', { name: 'Add view', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add project view' });
  await expect(picker).toBeVisible();
  // A DOM-visible menu can still be clipped by an ancestor. Check actual hit testing.
  await expect.poll(() => picker.evaluate(element => {
    const button = element.querySelector('button')!, rect = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  const rect = (await picker.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  return picker;
}

test('Project actions open visible menus and dialogs, and the board returns to the filtered table', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await projectWorkspaceFixture(page, 'head', true);
  const picker = await expectVisibleViewPicker(page);
  await page.screenshot({ path: info.outputPath('add-view-desktop.png'), fullPage: true });
  await picker.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Back to main table', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Project main table' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Search project tasks' }).fill('briefing');
  await page.getByRole('button', { name: 'Open task board', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Main table', exact: true })).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.pv-board-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to main table', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search project tasks' })).toHaveValue('briefing');
  await expect(page.locator('.pt-task-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();

  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Budget estimate', exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: /^Budget estimate/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Budget estimate', exact: true }).check();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'New task options', exact: true }).press('Enter');
  await page.getByRole('menuitem', { name: 'New group', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New group', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New task', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const context = page.getByRole('complementary', { name: 'Projects context' });
  await context.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Let’s start working together', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(context.getByRole('button', { name: 'Create work plan', exact: true })).toHaveCount(0);

  for (const name of ['New task', 'Columns', 'Open task board', 'Create project']) {
    const style = await page.getByRole('button', { name, exact: true }).evaluate(element => {
      const css = getComputedStyle(element);
      return { height: element.getBoundingClientRect().height, padding: parseFloat(css.paddingLeft), background: css.backgroundColor };
    });
    expect(style.height).toBeGreaterThanOrEqual(40);
    expect(style.padding).toBeGreaterThanOrEqual(12);
    expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
  }
  await page.screenshot({ path: info.outputPath('project-controls-desktop.png'), fullPage: true });
});

test('View picker, board return and first-column task actions remain reachable at 390px', async ({ page }, info) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page, 'head');
  await page.setViewportSize({ width: 390, height: 844 });
  const picker = await expectVisibleViewPicker(page);
  await page.screenshot({ path: info.outputPath('add-view-mobile.png'), fullPage: false });
  await picker.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Back to main table', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Project main table' })).toBeVisible();
  await page.getByRole('navigation', {name:'Mobile primary navigation'}).getByRole('button', {name:'More',exact:true}).click();
  const context = page.getByRole('complementary', { name: 'Projects context' });
  const createProject = context.getByRole('button', { name: 'Create project', exact: true });
  await expect(createProject).toBeVisible();
  await createProject.click();
  await expect(page.getByRole('dialog', { name: 'Let’s start working together', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(context.getByRole('button', { name: 'Create work plan', exact: true })).toHaveCount(0);
  const tableScroll = page.locator('.pt-table-scroll').first();
  await tableScroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const actions = page.locator('.pt-task-row').first().locator('td').first().getByRole('button', { name: 'Actions for Prepare community assessment', exact: true });
  await expect(actions).toBeVisible();
  const bounds = (await actions.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await actions.click();
  await expect(page.getByRole('menuitem', { name: 'Task details, evidence & review', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('project-controls-mobile.png'), fullPage: true });
});

test('Overflow views stay selectable and closable outside the mobile tab scroller', async ({ page }) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page, 'head', true);
  for (const name of ['Overview', 'Timeline', 'Reports', 'Activity', 'Reviews', 'Workload & Team']) {
    await page.getByRole('button', { name: 'Add view', exact: true }).click();
    await page.getByRole('dialog', { name: 'Add project view' }).getByRole('button', { name, exact: true }).click();
  }
  await expect(page.getByRole('tab', { name: 'Workload & Team', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'More (2)', exact: true }).click();
  const menu = page.getByRole('menu', { name: /^More \(\d+\)$/ });
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.getByRole('menuitem', { name: 'Activity', exact: true }).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  await menu.getByRole('menuitem', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'More (2)', exact: true }).press('Enter');
  await menu.getByRole('menuitem', { name: 'Close Reviews', exact: true }).click();
  await expect(page.getByRole('button', { name: 'More (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Activity', exact: true }).press('Enter');
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
});
