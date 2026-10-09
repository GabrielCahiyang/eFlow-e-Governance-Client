import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseReport } from './run-web-release.mjs';

export function performanceRecords(report) {
  assertReleaseReport(report);
  const records = new Map();
  const visit = suite => {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      if (test.projectName !== 'chromium' || test.results?.length !== 1 || test.results[0].status !== 'passed' || test.results[0].retry !== 0) throw new Error('Performance requires one passing Chromium attempt.');
      for (const item of test.results[0].attachments || []) {
        if (!/^project-(100|1000)$|^accounting-journal$/.test(item.name)) continue;
        if (records.has(item.name)) throw new Error('Duplicate performance dataset.');
        records.set(item.name, JSON.parse(Buffer.from(item.body, 'base64').toString('utf8')));
      }
    }
    for (const child of suite.suites || []) visit(child);
  };
  for (const suite of report.suites || []) visit(suite);
  for (const name of ['project-100', 'project-1000', 'accounting-journal']) {
    const value = records.get(name);
    if (!value || value.browser !== 'chromium' || value.samples?.length !== 3 || new Set(value.samples.map(sample => sample.run)).size !== 3 ||
        (name.startsWith('project') && value.timingModel !== 'paint-ready-v2')) throw new Error('Incomplete or incomparable three-sample performance record.');
    for (const field of name.startsWith('project') ? ['readyMs', 'filterMs'] : ['readyMs', 'journalReads'])
      if (value.samples.some(sample => !Number.isFinite(sample[field]) || sample[field] < 0)) throw new Error('Invalid performance measurement.');
  }
  return records;
}
export function comparePerformance(baseline, candidate) {
  const before = performanceRecords(baseline), after = performanceRecords(candidate);
  const median = (value, field) => value.samples.map(sample => sample[field]).sort((a,b) => a-b)[1];
  const measurements = [], failedGates = [];
  for (const name of ['project-100', 'project-1000', 'accounting-journal']) {
    for (const field of name.startsWith('project') ? ['readyMs', 'filterMs'] : ['readyMs', 'journalReads']) {
      const baselineMedian = median(before.get(name), field), candidateMedian = median(after.get(name), field);
      const passed = field === 'journalReads' ? candidateMedian <= 1 : baselineMedian > 0 && candidateMedian <= baselineMedian * 1.1;
      measurements.push({ dataset: name, field, baselineMedian, candidateMedian, changePercent: baselineMedian ? (candidateMedian/baselineMedian-1)*100 : null, passed });
      if (!passed) failedGates.push(`${name}:${field}`);
    }
  }
  return { timingModel: 'paint-ready-v2', budgetPercent: 10, measurements, passed: failedGates.length === 0, failedGates };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baseline, candidate, output] = process.argv.slice(2);
  if (!baseline || !candidate || !output) throw new Error('Provide baseline report, candidate report and comparison output.');
  const parse = path => JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/, ''));
  const comparison = comparePerformance(parse(baseline),parse(candidate));
  writeFileSync(output, JSON.stringify(comparison,null,2)+'\n');
  console.log(JSON.stringify(comparison));
  if (!comparison.passed) process.exitCode = 1;
}
