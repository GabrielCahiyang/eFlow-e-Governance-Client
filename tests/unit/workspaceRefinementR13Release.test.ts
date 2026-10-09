import { expect, it } from 'vitest';
import { assertRefinementMatrix } from '../../scripts/run-refinement-release.mjs';
const selection = [{ file: 'workspace-refinement-r13.spec.ts', title: 'integrated flow' }];
function report() {
  return { stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 }, errors: [], suites: [{ specs: [{ ...selection[0], line: 1, column: 1, tests: ['chromium', 'firefox', 'webkit'].map(projectName => ({ projectName, status: 'expected', results: [{ status: 'passed', retry: 0 }] })) }] }] };
}
it('requires the frozen flows in every browser, with no retries or incomplete results', () => {
  expect(() => assertRefinementMatrix(report(), selection)).not.toThrow();
  const changed = report(); changed.suites[0].specs[0].title = 'replacement';
  expect(() => assertRefinementMatrix(changed, selection)).toThrow('every frozen flow');
  const retried = report(); retried.suites[0].specs[0].tests[0].results[0].retry = 1;
  expect(() => assertRefinementMatrix(retried, selection)).toThrow('without retries');
  const incomplete = report(); incomplete.stats.skipped = 1;
  expect(() => assertRefinementMatrix(incomplete, selection)).toThrow('rejects');
  expect(() => assertRefinementMatrix(report(), [])).toThrow('missing');
});
