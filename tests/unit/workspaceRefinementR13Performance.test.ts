import { expect, it } from 'vitest';
import { comparePerformance } from '../../scripts/compare-refinement-performance.mjs';
function report(filterMs = 100) {
  return { stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 }, errors: [], suites: [{ specs: [{ tests: [{ projectName: 'chromium', results: [{ status: 'passed', retry: 0, attachments: ['project-100', 'project-1000', 'accounting-journal'].map(name => ({ name, body: Buffer.from(JSON.stringify({ browser: 'chromium', timingModel: 'paint-ready-v2', samples: [0,1,2].map(run => ({run, readyMs: 100, filterMs, journalReads: 1})) })).toString('base64') })) }] }] }] }] };
}
it('preserves the ten-percent budget and rejects missing or failed measurement evidence', () => {
  expect(comparePerformance(report(), report(110)).passed).toBe(true);
  expect(comparePerformance(report(), report(111)).failedGates).toEqual(['project-100:filterMs','project-1000:filterMs']);
  const incomplete=report(); incomplete.suites[0].specs[0].tests[0].results[0].attachments.pop();
  expect(() => comparePerformance(report(), incomplete)).toThrow('Incomplete');
  const failed=report(); failed.stats.unexpected=1;
  expect(() => comparePerformance(report(), failed)).toThrow('rejects');
});
