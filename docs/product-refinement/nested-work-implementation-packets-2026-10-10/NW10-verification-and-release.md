# NW10 — Correction verification, frozen release and performance evidence

**Prerequisite:** NW1–NW9 complete with task receipts, including NW3's impact-confirmation integration and NW8's final Activity integration in NW9.6; no live deployment in this phase.


Repository: `C:/Users/james/projects/eflow-e-Governance-Project`. This is a task brief for a later implementation request. The current request creates planning documents only.

## Rules carried into this brief

- Implement only the task ID the user selects. Finish its checks and handoff; do not start another task automatically. Read repository `AGENTS.md` and preserve pre-existing uncommitted work.
- Keep contextual Task/Subitem Leads, recursive children through depth 8, canonical IDs, `lead_id`, `parent_subtask_id`, sibling order, tree revision, evidence and audit history.
- Authority is current, branch-scoped and Office-scoped. Contributors cannot staff/structure. Leads cannot replace themselves. Admin/Viewer access grants no operational power.
- Confirmed Office subitem review: own eligible Lead first, then eligible parent/ancestor Leads, Task Lead and responsible Head; skip the submitter. Keep official root Head review and existing personal independent review.
- New assignments use selected eligible project people and existing approved guest contracts. Preserve financial/evidence/readiness/access-expiry rules. Keep `supportsNestedWork` exclusions and legacy API contracts.
- All full paths below are relative to the repository. Feature shorthand expands under `src/app/features/`; folder-relative names apply to the feature explicitly named in that read/change set. The Existing source locator gives full paths for named existing files. Files marked **NEW** are proposed creations. Locate symbols by search rather than trusting old line numbers.
- Backend corrections go in new CLI-generated migrations. Never edit installed historical migrations, repair live history or push the historical migration folder. No live writes/deployment in NW1–NW10.

## Working and handoff contract

Read only the selected task's source set plus dependencies needed to understand it. First report the requested task, changed-file scope and prerequisite receipts. If prerequisites are missing, inspect their actual outputs; do not pretend they passed or rebuild the entire application.

For each independently completed source slice run `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build` and the specified affected smoke test when configured. Refresh `npm.cmd run graph:update` after structural edits and inspect warnings. Documentation-only tasks need document/link checks, not a redundant application test run.

A focused unit command is diagnostic; it does not replace the full required suite. For local Playwright, set `EFLOW_E2E=1`; the default configuration starts the frontend on 5174 when no `EFLOW_E2E_BASE_URL` is supplied. Missing browser/configuration or skipped cases are open gates. Do not switch local fixtures to hosted data to make them pass.

Conclude with task ID/status, changed files/symbols, behavior preserved/changed, exact commands/results, remaining failures and the next eligible task. Preserve failed receipts. Do not commit, deploy, dispatch invitations or modify accounts unless separately authorized.


## NW10.1 — Prove the correction migrations run in the SQL harness

**Read/change:** the **NEW** correction runner `scripts/verify-nested-work-correction-sql.mjs` from NW2, its explicit migration list and fixtures; `tests/sql/helpers/phase65Database.mjs`.
**Read, preserve historical suites:** `scripts/verify-r7-hierarchy-sql.mjs`, `verify-r9-access-sql.mjs`, `verify-r9-compatibility-sql.mjs`.

1. Print/record the exact ordered migrations applied, their checksums, effective corrected function definitions and scenario counts.
2. Apply all relevant accepted corrections in the disposable fixture, including NW2, NW4 and NW5. A green historical R7 run alone is insufficient: it asserts historical reviewer routing.
3. Preserve existing historical runners as baseline evidence. The R9 compatibility runner currently rewrites historical runner source strings; do not use it as proof that a new migration was applied.
4. Test RPC and direct-table denial parity, selected membership, own Lead execution, branch management, reviewer candidate chain, concurrency/retries, untouched-history guards, last-moment eligibility loss, guests and personal/financial/evidence contracts.
5. Keep the helper's synthetic Auth/JWT/storage limitations explicit. Its historical live-history mode expects an older 18-migration boundary; it does not reproduce today's 27-migration hosted database or prove real JWT/storage behavior.

**Run after NW2 adds the new package command:** `npm.cmd run verify:nw-correction`, `verify:r7-hierarchy`, `verify:r9-access`, `verify:r9-compatibility`, `verify:merge-integrated`, `verify:r13-integrated`. Prefix each listed script with `npm.cmd run`; retain actual output and failures.

**Done when:** a receipt proves the new definitions were installed in the fixture and every intended allow/deny scenario passed. Missing scenarios remain open.

## NW10.2 — Complete repository and compatibility gates

**Read:** `package.json`, repository test configuration, the safety registry and affected suites recorded by NW1–NW9.

1. Run `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify:client-secrets`, `npm.cmd run safety:check`.
2. Run applicable existing SQL suites for Phase 1 authority, Phase 6.5 identity, R3 workspaces, R6 files, R8 invitations, R11 activity and R12 settings. Determine applicability from actual changed callers/security dependencies; record explicit reasons for omitted suites.
3. For the release candidate run the full configured gateway suite even if Python was untouched, as required by R13. Verify its configured local interpreter and run `server/.venv/Scripts/python.exe -m unittest discover -s server/tests` when that environment exists. Include the existing Phase 7 staffing tests. If unavailable, record the open gate; do not install tools globally or assert passing.
4. Update the safety registry only for reviewed legitimate source changes, then rerun its checks. Do not bless an accidental secret, permission regression or missing guard.
5. Every failure gets a task ID, reproduction, repair and rerun. Do not delete/skip tests or relax expected rights to reach green.

**Done when:** all required checks passed on the same candidate source, with any environment limitation explicitly blocking its corresponding acceptance claim.

## NW10.3 — Run the complete frozen browser release matrix

**Read/change as needed:** `scripts/refinement-artifact.mjs:snapshotCandidate/freezeCandidate/verifyFrozenCandidate/verifyServedFrontend`; `scripts/run-refinement-release.mjs:assertRefinementMatrix`; `playwright.refinement.config.ts`; `tests/e2e/refinement-release-selection.json`.
**NEW if existing specs cannot cover the journey:** `tests/e2e/nested-work-correction.spec.ts`.

1. Add correction journeys to the applicable R7/R10/R11 specs or the proposed dedicated spec. Preserve all existing release journeys.
2. If a dedicated spec is created, explicitly include it in both release configuration and selection manifest/validation. The existing filename selection covers R1–R13 and specified historical suites; a new filename is not automatically selected.
3. Cover selected-project staffing, Lead/contributors fields, forbidden self-replacement, contributor execution, own Lead first review, ancestor fallback, deep creation/move/order restrictions, dirty draft refresh/recovery, stale impact confirmation, revoked access and all entrances/exports.
4. After source checks, freeze the candidate using `npm.cmd run release:freeze-refinement`. Serve those exact frozen assets using the repository's documented local method; set `EFLOW_E2E_BASE_URL` to that server.
5. Run `npm.cmd run test:e2e:refinement` with the documented fixture setup. Do not use a title/file filter, a single-browser substitute, retries that hide flakes or unrecorded skipped cases.
6. Record selected case count from the actual current manifest; do not copy an old count. Verify hashes and served assets before/after the run.
7. The frozen artifact copies gateway source. Record whether the tested gateway/runtime is actually running the matching version; source copy alone is not a deployed container receipt.
8. Keep local fixtures local. Hosted independent-session acceptance belongs to NW11.

**Done when:** the complete selected matrix passes on one frozen candidate, with browser/environment limitations and unresolved historical release gates separately recorded.

## NW10.4 — Measure deep/wide hierarchy and preserve performance limits

**Read:** `tests/e2e/phase18-measurements.spec.ts`, `scripts/compare-refinement-performance.mjs`, and the current accepted performance receipts.

1. Compare historical frozen baseline and candidate sequentially using the existing 100/1,000-task and journal scenarios. Use `EFLOW_PERFORMANCE=1`, Chromium and one worker as required by the existing measurement setup.
2. Collect three samples per scenario from the same environment. Set `EFLOW_E2E=1`, `EFLOW_PERFORMANCE=1`, `EFLOW_E2E_BASE_URL` to the verified frozen server URL, and `PLAYWRIGHT_JSON_OUTPUT_FILE` to an absolute receipt path. Run `npm.cmd run test:e2e -- tests/e2e/phase18-measurements.spec.ts --project=chromium --workers=1 --grep "production project (100|1000) tasks: three measured samples|production Accounting journal scoped request count" --reporter=json`. Repeat sequentially for baseline and candidate servers with distinct receipt paths; use the existing comparison script with those actual paths. Do not accidentally include the separate 5,000-task scenario or overwrite baseline receipts.
3. Preserve the accepted 10% median route/filter regression guard and one-journal-read requirement. Do not raise thresholds to accept a regression.
4. Add depth-8 and wide-sibling correction scenarios with clear workload size: main-table render, expansion, focused Inspector, save/refresh and path search. Record read counts and timing; agree any new acceptance limit before claiming it passed.
5. Verify mobile layout, keyboard/focus, zoom and screen-reader behavior using available configured environments. Playwright WebKit does not substitute for an actual native Safari receipt where one is required.
6. Keep inherited Phase 6.5/R13 gaps visible. A new local correction suite does not close fresh-backup restoration, real JWT expiry or stable cross-Office browser acceptance.

**Output:** **NEW** `docs/product-refinement/nested-work-correction-verification.md` linking candidate identity, SQL/browser/performance receipts and each remaining release gate.

**Stop:** incomplete corrections in fixtures, a selected skipped/failing release case, performance guard failure or an unverified asset/runtime match prevents “ready for deployment.”


## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `package.json`
- `playwright.config.ts`
- `playwright.refinement.config.ts`
- `scripts/compare-refinement-performance.mjs`
- `scripts/phase17-safety-registry.mjs`
- `scripts/refinement-artifact.mjs`
- `scripts/run-refinement-release.mjs`
- `scripts/verify-r7-hierarchy-sql.mjs`
- `scripts/verify-r9-access-sql.mjs`
- `scripts/verify-r9-compatibility-sql.mjs`
- `server/tests/test_phase7.py`
- `tests/e2e/phase18-measurements.spec.ts`
- `tests/e2e/refinement-release-selection.json`
- `tests/sql/helpers/phase65Database.mjs`

