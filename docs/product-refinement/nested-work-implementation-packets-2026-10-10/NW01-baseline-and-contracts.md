# NW1 — Effective baseline and implementation contracts

**Prerequisite:** none. **Output:** documentation and fixture specifications only.


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


## NW1.1 — Record the effective source/database baseline

**Read:** original report `C:/Users/james/Downloads/eFlow_Task_Subitem_Leadership_Nested_Work_Correction_Report.md` as reference requirements, not implementation authorization; `docs/product-refinement/r0-scope-contracts/decisions-and-authority.md`; `r7-members-hierarchy-contract.md`; `r7-members-hierarchy-delivery.md`; `r0-r13-database-rollout-2026-10-09.md`; `sql-editor/2026-10-09/hosted-installation-verification.json` (the latter five under `docs/product-refinement/`); `docs/phase65-live-deployment-2026-10-07.md`. Read R7/R8/R9 and the two 9 October compatibility migrations.

**Create:** **NEW** `docs/product-refinement/nested-work-correction-contracts.md`.

1. Record current Git commit/status and pre-existing modifications. Do not reset them.
2. Record the dated planning baseline: 27 migrations on `ixnfphgjyelhckjwjkdv`; R7 installed as `20261008035748`; normalized source comparison MD5 `7968b5506f701a33d68cee4a8caa99df`. Refresh metadata read-only when available; never label the dated receipt a fresh live query.
3. Inventory effective signatures/defaults/search paths/grants and overrides for `eflow_r7.root/member/chain/manage/node_work/reviewer/pending_reviewer/snapshot/command/guard_root/guard_node/guard_completion`, public wrappers and private evidence guards. R8 guest and R9 access/removal overrides must be retained.
4. Record original/current/target behavior separately. No schema, account, identity, membership or assignment writes.
5. If live metadata access is unavailable, mark fresh inspection deferred. Continue source documentation; block live deployment until verified.

**Done when:** the document clearly says already installed, identifies current overrides and preserves historical receipts.

## NW1.2 — Freeze field/operation and transfer rules

**Read:** current `WorkTreeEditor`, `WorkTree`, `WorkRootOwner`, `WorkPeoplePicker`; `supportsNestedWork` in `src/app/features/nested-work/selectors/tree.ts`; R7 `command/manage/guard_node`; R9 `clear_staff/remove_person`; `TaskTeamEditorDialog` and `useStaffingReview`.

**Edit:** the NEW contract document only.

1. Produce a row for create, edit-title, edit-due, edit-mode, contributors, Lead transfer, move, order, delete, progress, submit and review.
2. For each specify current server operation, permitted actor/scope, affected items, lifecycle/history blockers, confirmation category and mandatory denial cases.
3. Preserve current compatibility behavior for old Lead during transfer: changing the appointed Lead does not silently remove the previous Lead from worker arrays. Explicit contributor removal is separate. Disclose retained contribution and cleared descendant appointments; historical events retain before/after.
4. Preserve safe existing audited metadata/staff amendments. Structural move/order/mode/delete requires authoritative untouched/history checks. Do not create an unrestricted post-start restructuring option.
5. Define material date impact by consequences for descendants, already-started/reviewed schedules or recorded commitments. Routine safe leaf-date edits get normal validation; no blanket date confirmation.
6. Freeze initially unappointed planning work under existing rules: no invented fake Lead or implicit Head assignment. Eligibility/execution remains server-defined.
7. Note special scopes: personal owner, approved guests, proposed Office, governed collaboration, unprojected task and missing-installation fallback.

**Done when:** later models can decide each command without inventing product policy. If an exact transfer/date exception conflicts with a supplied rule, ask before its dependent task.

## NW1.3 — Specify the correction test baseline

**Read:** `tests/sql/helpers/phase65Database.mjs`; `scripts/verify-r7-hierarchy-sql.mjs`; `verify-r9-access-sql.mjs`; `verify-r9-compatibility-sql.mjs`; `package.json`.

1. Record that old `liveHistoryDirectory` mode expects 18 entries ending `20261008004900`; it is not a current 27-entry replay.
2. Specify a NEW correction runner `scripts/verify-nested-work-correction-sql.mjs`, to be created in NW2, using disposable `phase65Database({repositoryContinuation:true})`, synthetic identities and real private evidence fixture setup.
3. Preserve the actual existing integration dependency order: Phase 6.5/continuation bootstrap; project-creation compatibility at its current prerequisite position; evidence/R3/R6/R7/R8/R9; Office-removal compatibility; applicable R11/R12; then only the new correction migrations in order.
4. Inventory each existing literal rewrite anchor in `verify-r9-compatibility-sql.mjs`. Leave historical runners unchanged unless an explicitly scoped harness change is necessary.
5. State that repository-continuation may install local-only historical migrations absent from live. It proves local compatibility, not exact live restoration.

**Done when:** migration/test inventory names existing files correctly, marks future migrations without invented timestamps and identifies the historical harness limitations.

**Stop this phase:** unexplained effective-body differences or missing product rules. Never guess a replacement R7/R9 body.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `docs/phase65-live-deployment-2026-10-07.md`
- `docs/product-refinement/r0-r13-database-rollout-2026-10-09.md`
- `docs/product-refinement/r0-scope-contracts/decisions-and-authority.md`
- `docs/product-refinement/r7-members-hierarchy-contract.md`
- `docs/product-refinement/r7-members-hierarchy-delivery.md`
- `scripts/verify-r7-hierarchy-sql.mjs`
- `scripts/verify-r9-access-sql.mjs`
- `scripts/verify-r9-compatibility-sql.mjs`
- `src/app/features/nested-work/components/WorkPeoplePicker.tsx`
- `src/app/features/nested-work/components/WorkRootOwner.tsx`
- `src/app/features/nested-work/components/WorkTree.tsx`
- `src/app/features/nested-work/components/WorkTreeEditor.tsx`
- `src/app/features/nested-work/selectors/tree.ts`
- `src/app/features/staffing/hooks/useStaffingReview.ts`
- `src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx`
- `supabase/migrations/20261005170822_phase65_project_local_office_identity.sql`
- `supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql`
- `supabase/migrations/20261008060756_r8_approved_project_invitations.sql`
- `supabase/migrations/20261008081855_r9_project_access_lifecycle.sql`
- `supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql`
- `supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql`
- `tests/sql/helpers/phase65Database.mjs`
