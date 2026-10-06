import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from '../tests/e2e/fixtures/projectWorkspace';
test.setTimeout(120_000);
test('diagnose filter input, commit, paint and automation costs', async ({ page }) => {
  const data = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  const seed = data.tasks[0];
  data.tasks.splice(0, data.tasks.length, ...Array.from({ length: 1000 }, (_, i) => ({ ...seed, id: `40000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`, title: `Benchmark task ${i}`, workspace_position: i, description: 'Representative project task with supporting details.' })));
  for (let run = 0; run < 3; run++) {
    await page.evaluate(key => localStorage.removeItem(key), `eflow_project_views_v1_${data.id}_${data.project}`);
    await page.goto(`/projects?page=Projects&project=${data.project}&view=tasks`);
    await expect(page.locator('.pt-task-row')).toHaveCount(1000);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Search project tasks"]');
      if (!input) throw new Error('Search control missing');
      (window as any).__filterTiming = new Promise(resolve => input.addEventListener('input', () => {
        const start = performance.now();
        const observer = new MutationObserver(() => {
          if (document.querySelectorAll('.pt-task-row').length !== 1) return;
          observer.disconnect();
          const commitMs = performance.now() - start;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve({commitMs, paintMs: performance.now() - start})));
        });
        observer.observe(document.querySelector('.pt-workspace')!, { childList: true, subtree: true });
      }, { once: true, capture: true }));
    });
    const start = performance.now();
    await page.getByRole('textbox', {name:'Search project tasks',exact:true}).fill('Benchmark task 999');
    const fillMs = performance.now() - start;
    await expect(page.locator('.pt-task-row')).toHaveCount(1);
    const assertMs = performance.now() - start - fillMs;
    const measured = await page.evaluate(() => (window as any).__filterTiming);
    console.log(JSON.stringify({stage:process.env.EFLOW_PERF_STAGE, run, fillMs, assertMs, ...measured}));
  }
});
