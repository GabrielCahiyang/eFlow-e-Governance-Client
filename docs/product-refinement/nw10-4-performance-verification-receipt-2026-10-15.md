# NW10.4 performance measurement receipt

Status: **completed for local verification and performance gates**, 15 October 2026. **New hierarchy timing acceptance passed**: the user subsequently agreed to a **1.5-second median cap for each measured operation**, and all **14/14** operation medians meet it. [Separate criterion/acceptance receipt](../../.refinement/nw10-20261014/nw104-hierarchy-timing-acceptance.json) preserves the original raw records, which correctly captured unagreed acceptance at measurement time. Next eligible activity is authorized safe NW11.1 package preparation; deployment readiness remains gated by documented product/hosted/recovery acceptance. Prerequisite [NW10.3](nw10-3-browser-verification-receipt-2026-10-14.md) passed all 759 selected cases.

Starting/ending frozen source is **`34f4900b421f83eb7000bcd9cdf4a28048aad48c08a543d3abe0c32667d56d06`**, branch `main`, HEAD `545245e353ad04ac47e24f95a71e06cf736ca0f8`. [Ending source](../../.refinement/nw10-20261014/nw104-ending-source.json). Application, gateway, migrations, original benchmark and frozen assets did not change. Changed deliverables: this receipt, [verification document](nested-work-correction-verification.md), [durable status](nw10-nw11-overnight-status.md), and ignored local measurement instrumentation/provenance with every failed attempt preserved. No commit, push or hosted operation.

Historical baseline inventory and served 34 files match the accepted R13 provenance. Candidate source/archive/all served assets matched before and after measurement. [Final provenance](../../.refinement/nw10-20261014/nw104-performance-provenance-final.json), [isolation evidence](../../.refinement/nw10-20261014/nw104-isolation-attempt1.json), [baseline ending hashes](../../.refinement/nw10-20261014/nw104-final-baseline-identity.log), [candidate ending hashes](../../.refinement/nw10-20261014/nw104-nested-ending-identity-attempt3.log). All other owned tests/builds/development servers were stopped; measurements ran sequentially on immutable production previews at 5188 (baseline) and 5187 (candidate), Chromium/one worker/zero retries/three samples per dataset.

Original exact packet command, repeated sequentially with distinct absolute `PLAYWRIGHT_JSON_OUTPUT_FILE`, `EFLOW_E2E=1`, `EFLOW_PERFORMANCE=1` and verified `EFLOW_E2E_BASE_URL`:

`npm.cmd run test:e2e -- tests/e2e/phase18-measurements.spec.ts --project=chromium --workers=1 --grep "production project (100|1000) tasks: three measured samples|production Accounting journal scoped request count" --reporter=json`

Output-only trace directories were added; the separate 5,000-task case was not selected. Baseline **3/3**, 41.81s; candidate **3/3**, 39.83s, no skips/flakes/retries. [Full baseline report](../../.refinement/nw10-20261014/nw104-baseline-report-attempt1.json), [full candidate report](../../.refinement/nw10-20261014/nw104-candidate-report-attempt1.json). Both full reports validate the original paint-ready-v2 model and three distinct samples.

Exact comparison: `node scripts/compare-refinement-performance.mjs .refinement/nw10-20261014/nw104-baseline-report-attempt1.json .refinement/nw10-20261014/nw104-candidate-report-attempt1.json .refinement/nw10-20261014/nw104-comparison-attempt1.json`, exit **0**, all six gates passed. Original **10% median route/filter/journal-ready regression bound and maximum one journal read** are unchanged. Timing units are milliseconds; journalReads is a request count.

| Dataset/metric | Baseline median | Candidate median | Change | Original gate |
| --- | ---: | ---: | ---: | --- |
| project-100 readyMs | 942.78 | 998.27 | 5.89% | passed |
| project-100 filterMs | 132.11 | 130.98 | -0.86% | passed |
| project-1000 readyMs | 7228.20 | 6040.93 | -16.43% | passed |
| project-1000 filterMs | 817.21 | 830.26 | 1.60% | passed |
| accounting-journal readyMs | 767.21 | 820.33 | 6.92% | passed |
| accounting-journal journalReads | 2.00 | 1.00 | -50.00% | passed |

[Strict comparison](../../.refinement/nw10-20261014/nw104-comparison-attempt1.json). Candidate project request counts are **159/1,159** per 100/1,000-task sample, versus baseline 52/52; these additional reads remain visible even though existing timing gates passed. Candidate journal made exactly one read in each sample. [Complete samples/read/DOM/asset records](../../.refinement/nw10-20261014/nw104-candidate-summary-attempt1.json). Historical R13 1,000-task filter +108.6224% failure remains preserved; this fresh candidate's measured +1.5974% passes the same bound and does not rewrite the historical receipt.

New correction workloads: four existing root tasks; one eight-node chain reaching depth eight, and one 201-node tree with a parent and 200 depth-two siblings. Three samples each exercise real production table render, full expansion, parent collapse/re-expansion, focused canonical Inspector, native slider/note save and refreshed tree/history/progress, Leading feed and nonmatching/ancestor-path search with selected row path disclosure. Every sample asserts exactly one save and at least one authoritative tree refresh. Scope is production frontend with intercepted synthetic backend, not real network/hosted authorization.

Exact command: `npm.cmd run test:e2e -- --config=.refinement/nw10-20261014/nested-benchmark.config.ts --project=chromium --workers=1 --reporter=json --output=.refinement/nw10-20261014/nw104-nested-attempt3`. Functional measurement journeys **2/2**, 32.95s, zero skips/flakes/retries; all six complete samples validated. [Full report](../../.refinement/nw10-20261014/nw104-nested-report-attempt3.json), [audited samples](../../.refinement/nw10-20261014/nw104-nested-summary-attempt3.json). Raw records originally captured latency limit null/unagreed/false. The subsequent explicit user criterion is **1,500ms median per operation**, separately verified **14/14 passed**; no raw measurement, original benchmark or threshold was changed. This applies only to the recorded local synthetic workloads.

| Operation | Depth-eight median ms | 200-sibling median ms | Median REST reads (deep/wide) |
| --- | ---: | ---: | ---: |
| render | 656.75 | 678.37 | 62/62 |
| expansion | 111.27 | 387.40 | 0/0 |
| branchExpansion | 208.32 | 648.13 | 0/0 |
| inspector | 224.17 | 1029.10 | 6/6 |
| saveRefresh | 180.13 | 679.17 | 4/4 |
| feedRender | 345.04 | 585.46 | 33/33 |
| pathSearch | 54.12 | 256.43 | 0/0 |

Original failed new-instrumentation attempts are retained: attempt 1 expected an invented three roots instead of the actual four; attempt 2 looked for Lead-only nodes in Assigned work instead of existing Leading. Exact before-source copies, both full logs/reports/traces and separately reviewed fixes remain under `nw104-nested-*-attempt1/2` and [workload review](../../.refinement/nw10-20261014/nw104-nested-instrumentation-review-attempt2.json)/[navigation review](../../.refinement/nw10-20261014/nw104-nested-instrumentation-review-attempt3.json). Only this new ignored instrumentation changed; original benchmarks, accepted limits, frozen application and all release tests remain untouched.

Configured browser evidence covers mobile widths/themes, native keyboard/focus, forced colors and simulated zoom reflow in the complete 759-case matrix plus R1 supplemental 18/18. Actual native Safari/VoiceOver/NVDA/browser 200% zoom is unverified on this Windows environment. Inherited fresh-backup restore, real JWT expiry, independent cross-Office/Storage/evidence-byte and deployed gateway acceptance remain open. No local benchmark closes those gates.

Resume: keep candidate hashes unchanged, retain all evidence, retain the agreed 1.5-second median criterion and separate 14/14 acceptance receipt; prepare NW11.1 read-only metadata comparison/isolated pending workspace and backup/dry-run/recovery package within authorized scope, recording unavailable credentials or consequential operations as open gates. Never apply hosted migrations, deploy, restore production, repair live history, commit or push.
