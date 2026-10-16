# NW2.2 newline portability correction receipt — 15 October 2026

Started 15 October; handoff completed 16 October 2026 (Asia/Singapore). The evidence-directory and receipt filename retain the starting date.

**Status: local source correction implemented and SQL-verified. The initially blocked Firefox smoke gate was resolved on 16 October; all three engines now pass. No hosted migration or deployment occurred.** The [Firefox follow-up receipt](firefox-launch-fix-receipt-2026-10-16.md) records the cause, unchanged browser bytes, launcher correction and refreshed full unit/build checks. Original failures below remain historical evidence. This bounded request does not execute NW11.2 or claim a new NW10 release candidate.

## Source and history decision

Starting/ending branch `main`, HEAD `fbc88d76a933b33a2c50d13d2430f27ad6fd72dc`; pre-existing dirty/untracked work preserved, no staging/commit/push. [Starting state and hashes](../../.refinement/nw22-fix-20261015/starting-state.json) inventories 4,614 pre-existing Git-visible files, and the original migration and safety registry copies are preserved in the same evidence directory. [Final audit](../../.refinement/nw22-fix-20261015/final-audit.json) records exact source changes, archives, outputs and open verification gates.

Fresh authorized PostgreSQL inspection used the existing designated-target connection in a read-only transaction, without exposing credentials or reading private business records. [Actual history](../../.refinement/nw22-fix-20261015/live-history.json) confirms **29 installed versions**, including both finance migrations `20261015125031` and `20261015142837`; the accepted nine NW corrections are absent. [Actual anchor inspection](../../.refinement/nw22-fix-20261015/live-anchor-verification.json) verifies each of the seven target functions exists and contains exactly one normalized expected anchor, with owner/arguments/ACL/search-path/definer metadata retained. Its initial collector's final assertion matched `nested_work` too broadly and also matched the historical R7 baseline name; the [exact reviewed version-set audit](../../.refinement/nw22-fix-20261015/live-anchor-verification-audit.json) passes without changing or requerying the saved evidence.

NW2.2 is genuinely pending on the sole authorized current target. Its local canonical filename/version is retained, and its reviewed pending source receives the two-line portability correction. No installed timestamp/source/history is changed. The finance installers must not be rerun. Future live release packaging still needs an actual new monotonic NW consolidation version after the installed finance history, fresh exact selection/dry run and approval; do not push the old dated correction folder, use include-all or repair history. No registered deployment version is invented here.

## Change and hashes

In [20261010105440_nested_work_own_lead_execution.sql](../../supabase/migrations/20261010105440_nested_work_own_lead_execution.sql), the replacement loop now removes carriage returns from **before_text and after_text**, as it already did for the effective definition. This makes raw CRLF source match the same reviewed LF anchors. Prerequisite existence, exact-one-match rejection and the enclosing transaction are unchanged. No authority/evidence/review/membership/financial conditions are widened.

| Artifact | SHA-256 |
| --- | --- |
| Preserved original canonical migration | `cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092` |
| Corrected pending canonical migration | `7f36fea512aa28ce00e322e21ef4d226095dff87d3d074172b802300eb2fe3c9` |
| New nine-source review-only SQL artifact | `05abce9ad4ac44e03b8147aeabf2a63e880b065adc1006fb1d038bf766c155f8` |

The new [review artifact and provenance](../../.refinement/nw22-fix-20261015/portability-attempt1/verification.json) retain the other eight source checksums, one outer transaction, no registered version and deploymentApproved=false. The old accepted candidate/artifact/checksums remain intact as historical evidence; the original prepared artifact is not overwritten.

New [verify-nw22-line-endings.mjs](../../scripts/verify-nw22-line-endings.mjs) is an offline disposable PostgreSQL regression runner using the existing financial baseline helper. It does not load credentials, contact hosted databases or apply/register a migration. Its evidence/package output is confined to local test-output directories and refuses overwriting prior files.

## Verification

Evidence prefix: `.refinement/nw22-fix-20261015/`. All tests use local fixtures; synthetic Auth/Storage metadata do not establish hosted JWT/RLS/provider-byte behavior.

| Command | Result / evidence |
| --- | --- |
| `node scripts/verify-nw22-line-endings.mjs --output .refinement/nw22-fix-20261015/portability-attempt1` | **32 assertions / 11 cases pass**; portability-attempt1.log/.exit and output verification.json. |
| `npm.cmd run verify:nw-correction` | **5,212 assertions pass**, 39 distinct migrations / 45 applications / 512 effective definitions; verify-nw-correction-attempt1.log/.exit. |
| `npm.cmd run verify:r7-hierarchy` | **102 assertions pass**; verify-r7-hierarchy-attempt1.log/.exit. |
| `npm.cmd run verify:r9-compatibility` | **102 assertions pass**; verify-r9-compatibility-attempt1.log/.exit. |
| `npm.cmd run verify:merge-integrated` | **86 assertions pass**; verify-merge-integrated-attempt1.log/.exit. |
| `node scripts/verify-financial-compatibility.mjs --with-integrity` | **484 assertions pass**, all nine corrections installed with both actual finance patches; finance-compatibility-attempt1.log/.exit. |
| `node scripts/verify-financial-integrity.mjs` | **89 assertions pass**, including both NW/financial installation orders; finance-integrity-attempt1.log/.exit. |
| `npm.cmd run check` | TypeScript pass; typescript-attempt1.log/.exit. |
| `npm.cmd test -- --maxWorkers=2 --reporter=dot` | Full suite **301 files / 1,823 tests pass**, 580.53 seconds; full-unit-attempt1.log/.exit. No test/assertion/timeout changes. |
| `npm.cmd run build` | Production build pass, 31.27 seconds; existing chunk-size warnings retained; build-attempt1.log/.exit. |
| `npm.cmd run safety:check` | Six scanner assertions, 3,240 candidates / 53 groups / zero new triage pass. Existing registry remains unchanged by this fix. |
| `npm.cmd run verify:client-secrets` | Pass; client-secrets-attempt1.log/.exit. Does not close separate repository security findings. |
| `npm.cmd run graph:update` | Pass; 9,754 nodes / 31,084 final edges / 411 communities; same four partial-AST warnings retained. |

The 11 portability cases reproduce the old raw-CRLF failure with LF and CRLF effective bodies; run corrected **raw LF and raw CRLF source** against both body formats without a pre-normalizing SQL loader; compare all seven body hashes with original successful LF execution; preserve signatures/defaults/owners/ACLs/search paths/definer flags; reject missing/duplicate anchors with rollback of earlier loop replacements; reject a missing prerequisite; run the full nine-file chain with raw CRLF NW2.2 after both finance patches; and execute the exact new review artifact. The three real financial writers retain their NW root-impact locks and ACL contracts.

Before the existing NW runner wrote fresh outputs, its prior test-results evidence was copied to `pre-existing-nw-correction-evidence/`. The new and previous `effective-definitions.json` objects, containing 512 function definitions and their view, are byte-for-byte identical. The input migration hash changes; the intended resulting database behavior does not.

## Focused browser smoke and retained failures

The production build was served through an owned loopback preview at 5191; it was stopped after verification. This was a focused compatibility check, not the complete frozen NW10 release matrix.

Attempt 1 selected zero cases because the CLI title expression began with `^`, while Playwright matches the full project/file/title string. Original error log/report/exit are retained; no browser assertions ran. Attempt 2 corrected only that CLI selector and ran the same existing Lead-only depth-eight scenario on **all three engines**, one worker, zero retries:

- Chromium passed, 6.573s.
- WebKit passed, 13.709s.
- Firefox failed **before any test assertion**, 4ms, with `browserType.launch: spawn UNKNOWN` for the existing pinned firefox-1490 executable.

Actual [browser report](../../.refinement/nw22-fix-20261015/browser-report-attempt2.json): 2 passed / 1 failed, zero skips/flakes/retries, total 27.32s. Firefox's executable exists; signature inspection reports NotSigned, but no matching Code Integrity event established the cause. Do not label this as a proven policy block or work around system security. No browser binary/config/test assertion/security policy was altered and the failed run was not hidden by a narrower rerun.

Exact attempt 2 setup/command:

```powershell
$env:EFLOW_E2E = '1'
$env:EFLOW_E2E_BASE_URL = 'http://127.0.0.1:5191'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = [System.IO.Path]::GetFullPath('.refinement/nw22-fix-20261015/browser-report-attempt2.json')
npx.cmd playwright test --config=playwright.refinement.config.ts tests/e2e/workspace-refinement-r10.spec.ts --grep 'NW9[.]2 Lead-only depth-eight Office work' --workers=1 --retries=0 --reporter=json --output=.refinement/nw22-fix-20261015/browser-attempt2
```

## Remaining gates and exact next action

1. **Closed 16 October:** native Windows resolution of the selected Firefox path fixes its side-by-side loading error. The full affected three-engine smoke rerun passes with zero retries/skips/flakes; original failed run remains retained. No runtime binary or security setting changed. See the [follow-up evidence](firefox-launch-fix-receipt-2026-10-16.md).
2. The next roadmap work is refreshed **NW10 integration/candidate verification**. The historical full NW helper still uses the old finance baseline; its passing behavior is supplemented here by both real-finance/new-NW-chain tests, not represented as complete current-baseline NW10 acceptance. A distinct full current-baseline NW scenario path, remaining required repository/gateway/SQL gates, new frozen candidate, complete release browser matrix and original performance/deep-wide measurements remain to be finished. Reuse successful same-source checks only where their inputs/required scope match.
3. Refresh **NW11.1** manifests/workspace against actual installed history, incorporating the corrected NW2.2 hash and excluding both installed finance versions. Finalize exact monotonic NW package/dry run, protected full DB/Auth/private and seven-bucket backup/restore, PG17 environment and current/previous compatible runtime artifacts. Resolve the separately recorded security findings before production readiness.
4. Present actual complete release artifacts and gates for explicit deployment approval. Do not execute NW11.2 or operational NW11.3, reapply finance, change accounts/grants/records or repair migration history under this fix request.

Changed tracked/untracked deliverables are the two-line pending SQL correction, new regression runner and these receipt/status updates. The rebuilt local dist and new ignored test/evidence outputs are separate from old immutable archives. No frontend/gateway feature code, historical finance migration, historical helper, test assertion or release selection was changed by this task.
