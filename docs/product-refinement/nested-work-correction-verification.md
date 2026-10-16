# Nested-work correction verification — current candidate

Status: **NW10.1–NW10.4 verified locally; deployment readiness remains blocked**. Updated 16 October 2026. Target ixnfphgjyelhckjwjkdv. No hosted migration, frontend/gateway deployment, private export, live grant/account change, commit or push occurred in this refresh.

Frozen candidate **591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976**, main/HEAD fbc88d76a933b33a2c50d13d2430f27ad6fd72dc, dirty working tree preserved/no staging. [Exact manifest](../../.refinement/nw10-refresh-20261016/candidate-attempt1.json): 1766 source inputs, 53 frontend assets, 52 gateway source files, 127 migration references. All source/archive/served hashes match before/after full release and performance. Gateway source copy is not a running/deployed runtime identity. [Preservation audit](../../.refinement/nw10-refresh-20261016/source-preservation-audit.json).

| Checkpoint | Verified result | Receipt |
| --- | --- | --- |
| NW10.1 | Current-finance source-equivalent baseline 5,243 assertions/528 definitions; historical 5,212/512; all required compatibility suites pass. Finance 484 compatibility/89 integrity/61 preservation, NW2.2 raw line endings 32 assertions/11 cases. | [SQL receipt](nw10-1-current-finance-verification-receipt-2026-10-16.md) |
| NW10.2 | TypeScript, full 302 files/1,831 unit tests, build, client-secret/safety checks, all eleven applicable SQL suites and 85 gateway tests pass. | [Repository receipt](nw10-2-current-candidate-verification-receipt-2026-10-16.md) |
| NW10.3 | Full 765/765, 255 per engine, zero failures/skips/flakes/retries; separate original R1 harness 18/18. All 253 original journeys retained, two financial journeys added per engine. | [Browser receipt](nw10-3-current-candidate-browser-verification-receipt-2026-10-16.md) |
| NW10.4 | Original six performance guards pass; deep/wide 2/2 functional workloads, three samples each; all 14 operation medians below accepted 1,500ms cap, slowest 1018.24ms. | [Performance receipt](nw10-4-current-candidate-performance-receipt-2026-10-16.md) |
| Read-only financial baseline supplement | Actual 29-version ledger unchanged, both finance versions installed/no NW correction installed; 47 complete financial definitions match source. Six legacy ACLs unchanged, two source-prescribed trigger restrictions. Additional actual-grant/nine-correction disposable probe 482 assertions passes. | [Reconciliation and limitations](nw11-current-financial-baseline-reconciliation-2026-10-16.md) |

Current refresh changes only verification harness/fixture/evidence plumbing, additive release selection and a two-label financial test navigation correction, plus documentation. No application/gateway/financial migration source changed during this refresh. Earlier NW2.2 and Firefox repairs and unrelated local UI work are preserved. Default historical SQL helper is unchanged. A trusted historical fixture seed was corrected for generated-always identity; actual financial guards and every allow/deny assertion remain. The frozen browser/config/test inputs were unchanged throughout acceptance.

All original failed logs remain: first current-finance seed attempt SQLSTATE 428C9; new financial smoke initially 3 failed/3 passed due stale navigation locator, then exact two-label repair and separate 6/6 pass; UTF-16 receipt parser reproduction/correction; exact synthetic/live financial-grant parity and all-legacy-ACL assumptions failed, with separate explicit source/metadata reconciliation and 482 strict actual-ACL assertions. These are not hidden through retries or deleted tests. Historical candidates/receipts are preserved in the [byte-identical pre-refresh verification document](nested-work-correction-verification-before-current-refresh-2026-10-16.md) and existing dated receipts.

Performance retains the unchanged benchmark and 10%/one-read limits:

| Dataset / metric | Baseline median | Candidate median | Change | Gate |
| --- | ---: | ---: | ---: | --- |
| project-100 readyMs | 940.12 | 1022.23 | 8.73% | pass |
| project-100 filterMs | 135.12 | 142.12 | 5.18% | pass |
| project-1000 readyMs | 6338.16 | 5975.57 | -5.72% | pass |
| project-1000 filterMs | 828.50 | 834.79 | 0.76% | pass |
| accounting-journal readyMs | 760.19 | 833.66 | 9.67% | pass |
| accounting-journal journalReads | 2.00 | 1.00 | -50.00% | pass |

| New operation | Depth-eight median ms | 200-sibling median ms | REST reads deep/wide |
| --- | ---: | ---: | ---: |
| render | 648.51 | 660.21 | 62/62 |
| expansion | 126.46 | 377.88 | 0/0 |
| branchExpansion | 192.92 | 637.39 | 0/0 |
| inspector | 255.56 | 1018.24 | 6/6 |
| saveRefresh | 190.40 | 687.35 | 4/4 |
| feedRender | 365.63 | 594.13 | 33/33 |
| pathSearch | 53.83 | 253.82 | 0/0 |

All timing is local synthetic production-frontend measurement. Existing additional per-root request counts are recorded; no hosted response-time promise is made. Journal-ready +9.67% remains within the original bound without a repeat run or adjusted limit.

Open NW11 gates: fresh actual-history isolated pending artifact/dry-run package; full protected database/Auth/private-schema/role archive and seven-bucket object bytes/configuration backup; fresh successful real isolated PG17 restore (dated Windows 4551 remains unresolved); exact currently serving/previous compatible frontend/gateway/runtime/config artifacts; inherited repository security findings and genuine independent-session JWT expiry/revocation/RLS/evidence/Storage/financial acceptance. Native Safari/assistive technology/actual zoom remain separately unverified. Default synthetic fixture financial ACL omissions are explicitly reconciled against actual metadata but are not a substitute for a real protected restore.

Exact next action: prepare the permitted NW11.1 review package from current 29-version history, with both finance migrations already installed and one reviewed later native-CLI-generated nine-source consolidation, no include-all/history repair/apply. Record unavailable backup/private-data/runtime/security approvals as open gates. NW11.2 and operational NW11.3 remain unauthorized. [Durable progress and resume](nw10-nw11-overnight-status.md).
