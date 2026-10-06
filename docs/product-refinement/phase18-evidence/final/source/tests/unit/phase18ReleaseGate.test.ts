import { describe, expect, it } from 'vitest';
import { assertReleaseReport, assertReleaseMatrix } from '../../scripts/run-web-release.mjs';

const passed = () => ({ stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 }, errors: [] });

describe('production release report acceptance', () => {
  it('accepts a completed passing report', () => {
    expect(() => assertReleaseReport(passed())).not.toThrow();
  });
  it.each(['skipped', 'unexpected', 'flaky'])('rejects %s critical cases', key => {
    const report = passed();
    report.stats[key] = 1;
    expect(() => assertReleaseReport(report)).toThrow('Release gate');
  });
  it('rejects empty or incomplete reports', () => {
    for (const report of [{}, { stats: { expected: 0, skipped: 0, unexpected: 0, flaky: 0 }, errors: [] }, { stats: { expected: 3 } }]) {
      expect(() => assertReleaseReport(report)).toThrow('Release gate');
    }
  });
  it('rejects runner errors even when case statistics pass', () => {
    expect(() => assertReleaseReport({ ...passed(), errors: [{ message: 'Preview stopped' }] })).toThrow('Release gate');
  });
  const matrix = () => ({
    ...passed(),
    suites: [{ specs: [{ file: 'critical.spec.ts', line: 1, column: 1, title: 'critical flow', tests: ['chromium', 'firefox', 'webkit'].map(projectName => ({ projectName, status: 'expected', results: [{ status: 'passed', retry: 0 }] })) }] }],
  });
  it('requires the same complete selection in all three browsers', () => {
    expect(() => assertReleaseMatrix(matrix(), 1)).not.toThrow();
    expect(() => assertReleaseMatrix(matrix())).toThrow('complete 115-case');
    const report = matrix();
    report.suites[0].specs[0].tests.pop();
    expect(() => assertReleaseMatrix(report, 1)).toThrow('complete');
  });
  it('rejects passing cases that hide a retry', () => {
    const report = matrix();
    report.suites[0].specs[0].tests[0].results[0].retry = 1;
    expect(() => assertReleaseMatrix(report, 1)).toThrow('without retries');
  });
  it('rejects differing case selections with the correct browser counts', () => {
    const report = matrix();
    const alternate = { ...report.suites[0].specs[0], title: 'different flow', tests: [report.suites[0].specs[0].tests.pop()!] };
    report.suites[0].specs.push(alternate);
    expect(() => assertReleaseMatrix(report, 1)).toThrow('complete');
  });
});
