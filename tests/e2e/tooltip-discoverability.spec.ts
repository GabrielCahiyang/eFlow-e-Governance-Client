import { expect, test } from '@playwright/test';
const fixture = '/tests/e2e/fixtures/tooltipCoverage.html';

for (const width of [1600, 1366, 768, 390]) test(`tooltip focus, hover and menu handoff at ${width}px`, async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fixture);
  // Vite may reload a dev fixture once while optimizing newly used packages.
  await page.waitForLoadState('networkidle');
  const controls = page.getByRole('region', { name: 'Tooltip controls' });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch theme' }).click();
    const notifications = controls.getByRole('button', { name: 'Open notifications' });
    await notifications.focus();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toHaveText('Notifications');
    const id = await tooltip.getAttribute('id');
    await expect(notifications).toHaveAttribute('aria-describedby', id!);
    const bounds = (await tooltip.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`tooltips-${theme}-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await expect(notifications).toBeFocused();
    const favorite = controls.getByRole('button', { name: 'Favorite Road repair' });
    await favorite.hover();
    await expect(tooltip).toHaveText('Add to favorites');
    const box = (await tooltip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tooltip).toBeVisible();
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    await favorite.hover();
    await expect(tooltip).toHaveText('Remove from favorites');
    await favorite.click();
    const menu = controls.getByRole('button', { name: 'Actions for Road repair' });
    await menu.focus();
    await expect(tooltip).toHaveText('Project actions');
    await menu.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Open project' })).toBeVisible();
    await expect(tooltip).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /Archive project/ })).toBeDisabled();
    await page.getByRole('menuitem', { name: 'Open project' }).click();
    await expect(menu).toBeFocused();
    await expect(page.getByLabel('Action count')).toHaveText(theme === 'light' ? '1' : '3');
    await notifications.click();
    await expect(page.getByLabel('Action count')).toHaveText(theme === 'light' ? '2' : '4');
  }
  const bold = page.getByRole('button', { name: 'Bold completion note text' });
  await bold.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Bold');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse workspace sidebar' }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Collapse sidebar');
  await page.getByRole('button', { name: 'Collapse workspace sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Restore workspace sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Open dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Task details' });
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Close dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('touch actions and menu details remain available without hovering', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); await page.goto((process.env.EFLOW_E2E_BASE_URL || 'http://127.0.0.1:5174') + fixture);
    await page.getByRole('button', { name: 'Actions for Road repair' }).tap();
    await expect(page.getByRole('menuitem', { name: 'Open project' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Open project' }).tap();
    await expect(page.getByLabel('Action count')).toHaveText('1');
    await page.getByRole('button', { name: 'Favorite Road repair' }).tap();
    await expect(page.getByRole('button', { name: 'Favorite Road repair' })).toHaveAttribute('aria-pressed', 'true');
  } finally { await context.close(); }
});
