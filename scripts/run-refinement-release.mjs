import { spawn } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseMatrix } from './run-web-release.mjs';
import { snapshotCandidate, verifyFrozenCandidate, verifyServedFrontend } from './refinement-artifact.mjs';

export function assertRefinementMatrix(report, selection) {
  if (!Array.isArray(selection) || selection.length < 1)
    throw new Error('Refinement release selection is missing.');
  assertReleaseMatrix(report, selection.length);
  const key = item => `${item.file.replaceAll('\\', '/')}:${item.title}`;
  const expected = selection.map(key).sort();
  const actual = [];
  const visit = suite => {
    for (const spec of suite.specs || [])
      if (spec.tests?.some(test => test.projectName === 'chromium')) actual.push(key(spec));
    for (const child of suite.suites || []) visit(child);
  };
  for (const suite of report.suites || []) visit(suite);
  if (new Set(expected).size !== expected.length || JSON.stringify(actual.sort()) !== JSON.stringify(expected))
    throw new Error('Refinement release requires every frozen flow; a same-sized replacement selection is insufficient.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.EFLOW_E2E_BASE_URL) throw new Error('Serve the frozen frontend and provide EFLOW_E2E_BASE_URL; do not rebuild during acceptance.');
  const reportPath = '.refinement/release-report.json';
  rmSync(reportPath, { force: true });
  rmSync('.refinement/acceptance.json', { force: true });
  const selection = JSON.parse(readFileSync('tests/e2e/refinement-release-selection.json', 'utf8'));
  const candidate = JSON.parse(readFileSync('.refinement/candidate.json', 'utf8'));
  if ((await snapshotCandidate(process.cwd())).id !== candidate.id) throw new Error('Candidate changed; rebuild and freeze it before release verification.');
  await verifyFrozenCandidate(process.cwd(), candidate);
  await verifyServedFrontend(process.env.EFLOW_E2E_BASE_URL, candidate);
  const child = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js', 'test',
    '--config=playwright.refinement.config.ts', ...process.argv.slice(2),
  ], { stdio: 'inherit', env: { ...process.env, EFLOW_E2E: '1', EFLOW_RELEASE_BASELINE: '0' } });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', async code => {
    if (code !== 0) { process.exitCode = code || 1; return; }
    try {
      assertRefinementMatrix(JSON.parse(readFileSync(reportPath, 'utf8')), selection);
      if ((await snapshotCandidate(process.cwd())).id !== candidate.id) throw new Error('Candidate changed during release verification.');
      await verifyFrozenCandidate(process.cwd(), candidate);
      await verifyServedFrontend(process.env.EFLOW_E2E_BASE_URL, candidate);
      writeFileSync('.refinement/acceptance.json', JSON.stringify({ candidate: candidate.id, completedAt: new Date().toISOString(), browsers: ['chromium', 'firefox', 'webkit'], casesPerBrowser: selection.length, result: 'passed', scope: 'Synthetic local production browser matrix; hosted acceptance remains separate.' }, null, 2)+'\n');
    }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  });
}
