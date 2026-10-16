# NW10.4 refreshed performance verification — 16 October 2026

Status: completed for local performance verification. Starting/ending frozen candidate **591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976**, main/HEAD fbc88d76a933b33a2c50d13d2430f27ad6fd72dc; no source/build/migration/gateway changes, staging, commit or push. Prerequisite [NW10.3](nw10-3-current-candidate-browser-verification-receipt-2026-10-16.md) passed 765/765 plus separate R1 18/18. [Isolation](../../.refinement/nw10-refresh-20261016/performance-isolation-attempt1.json), [provenance](../../.refinement/nw10-refresh-20261016/performance-provenance-attempt1.json), [final identity](../../.refinement/nw10-refresh-20261016/nested-ending-identity-attempt1.json).

Historical baseline all 34 accepted files and candidate all 53 served assets matched before/after. Measurements ran sequentially: accepted baseline at 5188, candidate at 5191, then candidate hierarchy workloads. Chromium/one worker/zero retries; no other tests/builds or owned development servers. Original benchmark SHA and hierarchy extraction/spec/config remain unchanged. Three samples per dataset/workload, no 5,000-task selection and no threshold change.

Exact original command, repeated sequentially with EFLOW_E2E=1, EFLOW_PERFORMANCE=1, verified EFLOW_E2E_BASE_URL and distinct absolute PLAYWRIGHT_JSON_OUTPUT_FILE:

npm.cmd run test:e2e -- tests/e2e/phase18-measurements.spec.ts --project=chromium --workers=1 --grep "production project (100|1000) tasks: three measured samples|production Accounting journal scoped request count" --reporter=json

Only distinct output trace directories were added. Baseline **3/3**, 40.91 seconds; candidate **3/3**, 39.68 seconds, zero skips/failures/flakes/retries. [Baseline report](../../.refinement/nw10-refresh-20261016/baseline-performance-report-attempt1.json), [candidate report](../../.refinement/nw10-refresh-20261016/candidate-performance-report-attempt1.json), [baseline samples](../../.refinement/nw10-refresh-20261016/baseline-performance-summary-attempt1.json), [candidate samples](../../.refinement/nw10-refresh-20261016/candidate-performance-summary-attempt1.json).

Exact comparison: node scripts/compare-refinement-performance.mjs .refinement/nw10-refresh-20261016/baseline-performance-report-attempt1.json .refinement/nw10-refresh-20261016/candidate-performance-report-attempt1.json .refinement/nw10-refresh-20261016/performance-comparison-attempt1.json. All **6/6** unchanged guards pass: 10% median timing regression limit, at most one candidate journal read. Units milliseconds except journalReads.

| Dataset / metric | Baseline median | Candidate median | Change | Gate |
| --- | ---: | ---: | ---: | --- |
| project-100 readyMs | 940.12 | 1022.23 | 8.73% | pass |
| project-100 filterMs | 135.12 | 142.12 | 5.18% | pass |
| project-1000 readyMs | 6338.16 | 5975.57 | -5.72% | pass |
| project-1000 filterMs | 828.50 | 834.79 | 0.76% | pass |
| accounting-journal readyMs | 760.19 | 833.66 | 9.67% | pass |
| accounting-journal journalReads | 2.00 | 1.00 | -50.00% | pass |

[Strict comparison](../../.refinement/nw10-refresh-20261016/performance-comparison-attempt1.json). Journal-ready regression is 9.67%, within the original 10% bound; no rerun was used to improve the result. Complete request counts/DOM/asset metrics remain in the linked sample records; additional per-root reads are visible and local timing is not a hosted latency promise.

Unchanged depth-eight and wide-200-sibling instrumentation: npm.cmd run test:e2e -- --config=.refinement/nw10-20261014/nested-benchmark.config.ts --project=chromium --workers=1 --reporter=json --output=.refinement/nw10-refresh-20261016/nested-performance-attempt1. **2/2**, 33.05 seconds, zero skips/flakes/retries. Four root tasks; 8 nested nodes/depth eight, or 201 nodes/one parent plus 200 depth-two siblings. Three samples each, all functional/canonical-ID/path/focus/expansion/native-slider/save/history/authoritative-refresh assertions unchanged. Exactly one save per sample and at least one tree refresh. [Full report](../../.refinement/nw10-refresh-20261016/nested-report-attempt1.json), [audited samples](../../.refinement/nw10-refresh-20261016/nested-summary-attempt1.json).

| Operation | Depth-eight median ms | 200-sibling median ms | REST reads deep/wide |
| --- | ---: | ---: | ---: |
| render | 648.51 | 660.21 | 62/62 |
| expansion | 126.46 | 377.88 | 0/0 |
| branchExpansion | 192.92 | 637.39 | 0/0 |
| inspector | 255.56 | 1018.24 | 6/6 |
| saveRefresh | 190.40 | 687.35 | 4/4 |
| feedRender | 365.63 | 594.13 | 33/33 |
| pathSearch | 53.83 | 253.82 | 0/0 |

Previously explicitly agreed cap: **1,500ms median per operation**. All **14/14** pass; slowest median **1018.24ms**. [Separate timing acceptance](../../.refinement/nw10-refresh-20261016/nested-timing-acceptance-attempt1.json). Unchanged raw instrumentation records null/unagreed acceptance fields; the separate receipt applies the user's existing criterion without rewriting raw samples or inventing a new threshold.

Limitations: immutable local production frontend with intercepted synthetic backend, serial disposable SQL, no real hosted/JWT/RLS/Storage/session or network latency proof. Configured WebKit/simulated zoom do not close native Safari/assistive technology/actual browser zoom. Matching running gateway/runtime, protected full DB/Auth/private/Storage backup and fresh native PG17 restore, current isolated migration selection and inherited security disposition remain NW11 gates. No deployment readiness claim, hosted write, private export or recovery operation.

Next eligible work: permitted NW11.1 current-history isolated package/dry-run/recovery preparation and review. Preserve both installed finance versions; do not reinstall them, force older timestamps with include-all, repair history, deploy or recover automatically. Native PG17 and protected-data/runtime/security approvals remain unresolved.
