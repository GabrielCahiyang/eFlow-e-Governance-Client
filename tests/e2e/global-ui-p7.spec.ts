import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
import { globalUiP5aFixture } from './fixtures/globalUiP5a';
import { globalUiP5bFixture } from './fixtures/globalUiP5b';

test.skip(process.env.EFLOW_E2E !== '1', 'Opt-in synthetic local acceptance');
test.setTimeout(120_000);

for (const role of ['head', 'member', 'accounting_staff', 'admin'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`P7 ${role} ${theme}: one navigation context, readable header and responsive content`, async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (role === 'accounting_staff') {
        await globalUiP5bFixture(page, role, theme);
        await page.goto('/general-journal?page=General+Journal&fy=2026');
      } else if (role === 'admin') {
        await globalUiP5aFixture(page, role, theme);
        await page.goto('/users?page=All+Users');
      } else {
        await projectWorkspaceFixture(page, role, false, { landingOnly: true, leading: true, theme });
        await page.goto('/my-work');
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const main = page.getByRole('main', { name: 'Active workspace', exact: true });
      await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
      const mark = page.locator('.eflow-topbar__wordmark svg path').first();
      await expect(mark).toHaveAttribute('fill', theme === 'dark' ? '#ffffff' : '#01006B');

      for (const width of [1440, 768, 390, 320, 640]) {
        await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
        await expect(page.getByRole('button', { name: 'Open help', exact: true })).toBeVisible();
        const measureLayout = () => page.evaluate(() => {
          const leading = document.querySelector('.eflow-topbar__leading')!.getBoundingClientRect();
          const utilities = document.querySelector('.eflow-topbar__utilities')!.getBoundingClientRect();
          return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1,
            headerFits: leading.right <= utilities.left + 1 && utilities.right <= innerWidth + 1,
            leading: { left: leading.left, right: leading.right, width: leading.width },
            utilities: { left: utilities.left, right: utilities.right, width: utilities.width },
            wordmark: document.querySelector('.eflow-topbar__wordmark')!.getBoundingClientRect().toJSON(),
            font: getComputedStyle(document.querySelector('main')!).fontFamily };
        });
        const initialLayout = await measureLayout();
        await info.attach(`initial-layout-${width}`, { body: JSON.stringify(initialLayout), contentType: 'application/json' });
        await expect.poll(async () => (await measureLayout()).headerFits, { message: `Header must fit at ${width}px after responsive layout` }).toBe(true);
        const layout = await measureLayout();
        expect(layout.overflow).toBe(false); expect(layout.headerFits).toBe(true); expect(layout.font.toLowerCase()).toContain('figtree');
        const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        await info.attach(`layout-a11y-${width}`, { body: JSON.stringify({ layout, violations: findings.violations }), contentType: 'application/json' });
        expect(findings.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
        if (width >= 1024) {
          await expect(page.getByRole('navigation', { name: 'Global navigation', exact: true })).toBeVisible();
          await expect(page.getByRole('navigation', { name: /destinations$/ })).toHaveCount(1);
        } else {
          await expect(page.getByRole('navigation', { name: 'Mobile primary navigation', exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
          const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
          await expect(drawer).toBeVisible();
          await expect(drawer.getByRole('navigation', { name: /destinations$/ })).toHaveCount(1);
          await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
        }
        await page.screenshot({ path: info.outputPath(`accepted-${width}.png`), animations: 'disabled' });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      const collapse = page.getByRole('button', { name: /^Collapse .* sidebar$/ });
      await expect(collapse).toHaveCount(1); await collapse.click();
      await expect(page.locator('[data-context-rail]').getByRole('navigation', { name: /destinations$/ })).toHaveCount(0);
      const restore = page.getByRole('button', { name: /^Restore .* sidebar$/ });
      await expect(restore).toBeVisible();
      if (role === 'head' || role === 'member') {
        await expect(main.getByRole('navigation', { name: 'My Work destinations', exact: true })).toHaveCount(1);
      } else if (role === 'accounting_staff') {
        await expect(main.getByRole('combobox', { name: 'Accounting destination', exact: true })).toBeVisible();
      } else {
        await expect(main.getByRole('navigation', { name: /destinations$/ })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Guide for this page', exact: true })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
      await restore.click(); await expect(page.getByRole('navigation', { name: /destinations$/ })).toHaveCount(1);
    });
  }
}

test('P7 system appearance updates the existing header wordmark without a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const fixture = await projectWorkspaceFixture(page, 'member', false, { landingOnly: true });
  await page.route('**/rest/v1/user_preferences*', route => route.fulfill({ json: { user_id: fixture.id, theme: 'system' } }));
  await page.goto('/my-work'); await expect(page.locator('html')).toHaveClass(/dark/);
  const text = page.locator('.eflow-topbar__wordmark svg path').first(); await expect(text).toHaveAttribute('fill', '#ffffff');
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).not.toHaveClass(/dark/); await expect(text).toHaveAttribute('fill', '#01006B');
});
