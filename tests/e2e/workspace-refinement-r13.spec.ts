import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { personalWorkspaceFixture } from './fixtures/personalWorkspace';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test.setTimeout(180_000);

async function auditRefinement(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const findings = result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, detail: node.failureSummary })) }));
  await info.attach(`${name}-a11y`, { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
  expect(findings.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}

for (const surface of ['personal project', 'Admin settings'] as const) {
  test(`R13 ${surface} accessibility in five widths and both themes`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let theme = 'light';
    let destination: string;
    let ready: () => Promise<void>;
    if (surface === 'personal project') {
      const fixture = await personalWorkspaceFixture(page, { seed: true });
      fixture.personalTasks.push({ id: '72000000-0000-4000-8000-000000000001', project_id: fixture.projectId, title: 'R13 scoped personal task', lead_id: fixture.id, status: 'todo', progress: 0, revision: 1 });
      destination = `/projects?workspace=${fixture.personalId}&project=${fixture.projectId}`;
      ready = () => expect(page.getByRole('region', { name: 'Selected personal project' })).toContainText('R13 scoped personal task');
    } else {
      await projectWorkspaceFixture(page, 'admin', false, { landingOnly: true });
      destination = '/users?page=System%20Settings';
      ready = () => expect(page.getByRole('heading', { name: 'System Settings', exact: true })).toBeVisible();
    }
    await page.route('**/rest/v1/user_preferences?**', route => route.fulfill({ json: { theme } }));
    for (theme of ['light', 'dark']) {
      await page.goto(destination);
      await ready();
      await expect.poll(() => page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(theme === 'dark');
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await auditRefinement(page, info, `r13-${surface.replaceAll(' ', '-')}-${theme}-${width}`);
      }
    }
  });
}
