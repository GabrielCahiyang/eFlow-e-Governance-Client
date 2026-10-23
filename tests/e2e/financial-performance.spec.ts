import { expect, test } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
import { writeFile } from 'node:fs/promises';

test.skip(process.env.EFLOW_PERFORMANCE !== '1', 'Explicit local comparison build required');
test('measures identical cold fixture and warm project navigation under both chunk strategies', async ({ browser }, info) => {
  test.setTimeout(180000);
  const measurements = [];
  // 5175 belongs to the separately running AI console; keep QA previews isolated.
  for (const [strategy, baseURL] of [['legacy', process.env.EFLOW_LEGACY_PREVIEW_URL || 'http://127.0.0.1:5195'], ['split', process.env.EFLOW_E2E_BASE_URL || 'http://127.0.0.1:5174']]) {
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
      try {
        const page = await context.newPage();
        const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
        const begin = Date.now();
        await projectWorkspaceFixture(page, 'head');
        const coldFixtureMs = Date.now() - begin;
        const assets = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/assets\/.*\.js/.test(entry.name)).map(entry => {
          const resource = entry as PerformanceResourceTiming;
          return { path: new URL(resource.name).pathname, encodedBytes: resource.encodedBodySize, durationMs: resource.duration };
        }));
        await page.getByRole('button', { name: 'All projects', exact: true }).first().click();
        const portfolio = page.getByRole('region', { name: 'All projects', exact: true });
        await expect(portfolio).toBeVisible();
        const warmBegin = Date.now();
        await portfolio.getByRole('button', { name: 'Community outreach', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Project main table', exact: true })).toBeVisible();
        measurements.push({ strategy, sample, coldFixtureMs, warmClientRouteMs: Date.now() - warmBegin, assets, errors });
        expect(errors).toEqual([]);
      } finally { await context.close(); }
    }
  }
  const result = JSON.stringify({ measurements, note: 'Identical synthetic network fixtures. Cold fixture includes login animation and tour wait. Warm measures an already-loaded client route; HTTP routing disables the browser cache.' }, null, 2);
  await writeFile('docs/financial-qa-remediation-2026-10-21/performance/runtime-measurements.json', result);
  await info.attach('performance-measurements.json', { body: Buffer.from(result), contentType: 'application/json' });
});
