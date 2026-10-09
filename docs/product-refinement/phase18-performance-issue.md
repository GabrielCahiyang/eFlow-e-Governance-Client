# Phase 18 filtering release issue

Status: unresolved local performance gate. The 10% regression budget is unchanged. The release owner must approve a specific exception or a subsequent change must pass the same paired benchmark before full Phase 18 acceptance.

The frozen prior production artifact and current production artifact were measured on the same machine with the locked Chromium build and intercepted synthetic backend traffic. Three samples per dataset are retained in [the comparison](phase18-evidence/final/performance-comparison.json), including outliers. Other automated builds/tests were stopped during measurement.

| Dataset | Baseline route ready | Current route ready | Baseline filter | Current filter | Filter change |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 tasks | 975.7 ms | 887.2 ms | 135.6 ms | 183.2 ms | +35.1% |
| 1,000 tasks | 6,793.6 ms | 4,365.6 ms | 927.6 ms | 1,814.8 ms | +95.6% |

Accounting's median scoped journal reads fall from two to one. Its local route-ready median is 851.9 ms versus 780.1 ms, within the 10% budget. Project REST reads remain 57 at the median. These improvements do not waive the filtering failure.

The benchmark's `paint-ready-v2` method waits for the expected rows, document fonts and two initial animation frames before starting filtering. Filter time includes Playwright locating/filling the accessible search control, the row-count assertion and two animation frames. Earlier DOM-ready measurements remain diagnostic; neither timing model's failing runs are discarded from the evidence history.

An independent diagnostic separates input handling, DOM commit and paint from automation. For 1,000 tasks, the baseline input-to-paint samples were 173.4/163.2/164.4 ms; current samples were 215.3/198.8/154.5 ms. The medians are 164.4 and 198.8 ms (+20.9%). Automation accounts for much of the end-to-end time and its variability, but this diagnostic also fails the 10% guard. It does not replace the acceptance benchmark. [Baseline diagnostic](phase18-evidence/diagnostics/filter-timing-baseline.log) and [current diagnostic](phase18-evidence/diagnostics/filter-timing-final.log) retain the step timings and driver provenance.

Chromium CPU profiles are retained under `phase18-evidence/diagnostics/`. They include native browser work, DOM removal, garbage collection and Playwright selector work; they do not establish a single application selector as the cause. The next investigation should trace style/layout and DOM-removal work around the filter commit, while retaining open-editor, dirty-guard, keyboard, role and realtime behavior. Virtualization remains conditional on a supported scale and compatibility proof.

The current 5,000-task stress fixture completes three samples, but its median route-ready time is 43.8 seconds and its median filter time is 7.5 seconds, with 295,613 DOM nodes. Completion does not approve this scale for production. Its baseline timed out, so no improvement percentage or comparable baseline median is claimed. Synthetic fixtures and approximate Chromium heap observations do not establish peak memory, WAN latency, real workload distribution or a supported production task count.

## R13 continuation measurement

The [R13 paired comparison](r13-release-evidence/performance-final-comparison.json) preserves this historical issue and the same 10% guard. Its final candidate still fails 1,000-task filtering: 824.7 ms baseline versus 1,720.4 ms candidate (+108.6%). The 100-task filter and both project route timings pass; journal route readiness passes with one scoped read. All three samples and artifact/browser/machine provenance remain in the [R13 receipt](r13-release-delivery.md). Neither this remeasurement nor the cumulative correctness matrix approves 5,000 tasks or closes genuine workload, WAN and peak-memory acceptance.
