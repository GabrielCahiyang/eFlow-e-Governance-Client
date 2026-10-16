# NW10–NW11 morning report — 15 October 2026

**NW10.1–NW10.4 are verified locally. NW11.1 has a complete reviewable preparation package, but remains blocked on missing hosted finance prerequisites and fresh recovery evidence. NW11.2/NW11.3 were not executed.**

| Checkpoint | Outcome | Evidence |
| --- | --- | --- |
| NW10.1 | 5,212 assertions, 39 distinct migrations / 45 applications, 512 effective definitions; compatibility, evidence and native completion/removal/impact races passed | [SQL receipt](nw10-1-sql-verification-receipt-2026-10-14.md) |
| NW10.2 | Required TS/unit/build/security/SQL/gateway gates passed; final source-gate reruns after NW10.3 repairs: 300 files / 1,809 tests, production build 15.21s, TS/secrets/safety passed; 85 gateway tests on unchanged gateway | [Repository receipt](nw10-2-repository-verification-receipt-2026-10-14.md), [final browser/source receipt](nw10-3-browser-verification-receipt-2026-10-14.md) |
| NW10.3 | Full 759/759: 253 each Chromium/Firefox/WebKit; 60.59min; zero failures/skips/flakes/retries; extra R1 18/18 and affected Phase1/2 27/27 | [Browser receipt](nw10-3-browser-verification-receipt-2026-10-14.md) |
| NW10.4 | All six original guards passed; two new hierarchy journeys, three samples each; approved 1.5s median caps 14/14 passed | [Performance receipt](nw10-4-performance-verification-receipt-2026-10-15.md) |
| NW11.1 | Exact target inspected; 27 live entries, 95/95 baseline bodies match; 27+9 isolated workspace; native dry run passes exact selection; required hosted finance dependencies absent; fresh recovery open | [Preparation receipt](nw11-1-rollout-preparation-receipt-2026-10-15.md), [rollout package](nested-work-correction-rollout.md) |

Frozen candidate: **34f4900b421f83eb7000bcd9cdf4a28048aad48c08a543d3abe0c32667d56d06**. Actual immutable frontend/gateway source archive and current inputs/served frontend reverified after preparation. Hosted target only **ixnfphgjyelhckjwjkdv**, PostgreSQL 17.6.1.155. This identifies locally verified source/artifacts; no matching running gateway or served production release is claimed.

Performance medians (ms), same unchanged original benchmark, Chromium/one worker/three samples:

| Original measure | Accepted baseline | Candidate | Change/result |
| --- | ---: | ---: | --- |
| 100-task readiness | 942.7822 | 998.2738 | +5.8859%, pass |
| 100-task filter | 132.1129 | 130.9795 | -0.8579%, pass |
| 1,000-task readiness | 7,228.2009 | 6,040.9306 | -16.4255%, pass |
| 1,000-task filter | 817.2069 | 830.2613 | +1.5974%, pass |
| Accounting journal readiness | 767.2098 | 820.3289 | +6.9237%, pass |
| Journal scoped reads | 2 | 1 each sample | original maximum one, pass |

| New operation median (ms) | Depth eight | Parent + 200 siblings |
| --- | ---: | ---: |
| Render | 656.7461 | 678.3725 |
| Expand | 111.2653 | 387.4024 |
| Branch expansion | 208.3234 | 648.1321 |
| Inspector | 224.1700 | 1,029.1013 |
| Save/refresh | 180.1250 | 679.1653 |
| Feed render | 345.0428 | 585.4649 |
| Path search | 54.1238 | 256.4346 |

User-approved cap: 1,500ms median per measured operation, all 14 pass. Source renders/request counts, three raw samples, original thresholds/provenance and all failed attempts remain visible in the performance receipt; local synthetic measurements do not promise hosted latency.

Source changes: correction SQL runner/final evidence suites; Inspector and hierarchy-menu/focus timing; Office receipt refresh recovery; notification-intent ownership; mobile table spacing; relevant regression/canonical-staffing/network-fixture compatibility; reviewed safety registry and release manifest; verification/receipt/preparation documentation. See exact reviewed file inventory [nw111-ending-preservation-attempt2.log](../../.refinement/nw10-20261014/nw111-ending-preservation-attempt2.log). No migration or gateway source changed. All original failed SQL/unit/browser/performance/preparation logs remain distinct from passing reruns; no required scenario was removed and original timeouts/limits/retries were retained.

Rollout readiness: successful dry-run selection is insufficient. Checked confirmation requires missing `petty_cash_request_lines`, `petty_cash_receipt_items` and three budget writer functions. The 25,866-byte existing voucher/items finance migration was exercised in local harnesses but is absent from the live ledger; its live inclusion requires separate review. The zero-byte ledger placeholder is not a remedy. Historical protected backup hashes/list/decompression pass, but fresh Auth/private/Storage backup and successful fresh restore are unresolved. Previous matching hosted artifacts/runtime and real JWT/RLS/Storage/multi-session acceptance remain open, as do inherited native Safari/AT/200% zoom gates. [Full gate list and exact pending checksums](nested-work-correction-rollout.md).

Git: **main**, HEAD **545245e353ad04ac47e24f95a71e06cf736ca0f8**, local modified/untracked source preserved, nothing staged, no commit/push. **4,520 original files unchanged; 31 reviewed pre-existing-file changes.** Ending inventory [nw111-ending-source.json](../../.refinement/nw10-20261014/nw111-ending-source.json) records source identity and dirty paths. Final Git status is saved separately as `nw111-final-git-state.json` after handoff documents are written.

The [final evidence audit](../../.refinement/nw10-20261014/nw111-final-completion-audit.json) passes receipt/source/artifact continuity checks and explicitly leaves goal completion unproven because NW11.1 gates remain open. [Final Git state](../../.refinement/nw10-20261014/nw111-final-git-state.json) has 187 modified/untracked status lines and nothing staged. Owned local candidate/baseline previews were stopped after served-byte verification; no listeners remain at 5187/5188.

**Exact next action:** review the finance prerequisite reconciliation and approve a documented fresh backup/isolated restore mechanism. Resolve NW11.1 gates, generate a new exact isolated selection with separately retained dry-run/rehearsal receipts, then request explicit approval tied to actual target/artifacts before NW11.2. Do not apply the current nine-file package, push the historical migration folder, repair history or execute operational recovery. Resume from [durable status](nw10-nw11-overnight-status.md); keep NW10 successes and original failures intact. Any code change requires a new candidate and relevant full verification.
