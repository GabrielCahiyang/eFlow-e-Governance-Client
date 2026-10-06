import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertReleaseReport(report) {
  const stats = report?.stats;
  if (!stats || !Number.isInteger(stats.expected) || stats.expected < 1 ||
      [stats.skipped, stats.unexpected, stats.flaky].some(count => count !== 0) ||
      !Array.isArray(report.errors) || report.errors.length > 0) {
    throw new Error('Release gate requires passed cases and rejects skipped, failed, flaky or incomplete reports.');
  }
}

export function assertReleaseMatrix(report, casesPerBrowser = 115) {
  assertReleaseReport(report);
  const cases = [];
  const visit = suite => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        cases.push({ key: `${spec.file}:${spec.line}:${spec.column}:${spec.title}`, ...test });
      }
    }
    for (const child of suite.suites || []) visit(child);
  };
  for (const suite of report.suites || []) visit(suite);
  const browsers = ['chromium', 'firefox', 'webkit'];
  const selections = browsers.map(browser => cases.filter(test => test.projectName === browser));
  const keys = selection => selection.map(test => test.key).sort();
  if (report.stats.expected !== casesPerBrowser * browsers.length ||
      cases.length !== report.stats.expected ||
      selections.some(selection => selection.length !== casesPerBrowser || new Set(keys(selection)).size !== casesPerBrowser) ||
      selections.some(selection => JSON.stringify(keys(selection)) !== JSON.stringify(keys(selections[0]))) ||
      cases.some(test => test.status !== 'expected' || test.results?.length !== 1 || test.results[0].status !== 'passed' || test.results[0].retry !== 0)) {
    throw new Error(`Release gate requires the complete ${casesPerBrowser}-case selection in Chromium, Firefox and WebKit, without retries.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = '.phase18/release-report.json';
  // A terminated run must not leave an earlier successful report as acceptance.
  rmSync(reportPath, { force: true });
  const command = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js', 'test',
    '--config=playwright.release.config.ts', ...process.argv.slice(2),
  ], {
    stdio: 'inherit',
    env: { ...process.env, EFLOW_E2E: '1', EFLOW_RELEASE_BASELINE: '0' },
  });
  command.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  command.on('exit', code => {
    if (code !== 0) { process.exitCode = code || 1; return; }
    try {
      assertReleaseMatrix(JSON.parse(readFileSync(reportPath, 'utf8')));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  });
}
