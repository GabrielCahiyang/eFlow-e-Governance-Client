# NW11 — Reviewable live rollout and recovery

**Prerequisite:** NW10 evidence complete; current live metadata and recoverability verified. Execution requires a later explicit deployment request.


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


## NW11.1 — Prepare the concrete rollout package without live changes

**Read:** `docs/phase65-live-deployment-2026-10-07.md`; `docs/product-refinement/r0-r13-database-rollout-2026-10-09.md`; `docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json`; the NW10 verification document; installed migration metadata and the new correction migrations.
**Inspect only:** `.refinement/deploy-refinements.py` if still present. Its historical nine-file selection, scratch paths and ledger assumptions are dated; do not execute it unchanged.
**NEW:** `docs/product-refinement/nested-work-correction-rollout.md` and a separately identified local isolated migration workspace/receipts.

1. Reconfirm the single target is `ixnfphgjyelhckjwjkdv`. Query current metadata read-only: exact live ledger, function definitions/grants/search paths, RLS and required schema/storage contracts.
2. Compare effective live definitions with accepted baseline and pending correction signatures. If the ledger changed, investigate; never repair it to match local filenames.
3. Populate an isolated migration workspace from exact current live history, preserving deployed versions. Copy only reviewed new migrations as pending, with checksums and dependency order.
4. Recheck current Supabase CLI version/help and supported targeting flags. Use its documented linked/project-reference/workspace workflow. Avoid exposed connection strings, invented credential flags, role/seed application or broad historical-folder push.
5. Require `--skip-vault` for the reviewed dry run and push so unrelated Vault changes are excluded. Produce a dry-run receipt that targets only this project and lists only the expected new pending files. `--include-all` is allowed only when justified by the exact isolated selection and reviewed dry run; it is not a remedy for history mismatch.
6. Create/verify a fresh recoverable database backup including required Auth/private data, plus separately documented Storage objects/configuration and previous matching frontend/gateway artifacts.
7. Rehearse restoration of that fresh archive in an isolated environment. The dated Windows `WinError 4551` restoration failure remains an open gate until an actual successful restore receipt exists. An older rehearsal receipt is insufficient.
8. Specify deployment order, compatibility window, exact frontend/gateway artifacts, genuine acceptance actors, monitoring, stop criteria and recovery steps. Include real protected fields/IDs/history to preserve.
9. Present the completed package and outstanding gates for review. No live apply, hosting publish or account/invitation changes are authorized by this planning request.

**Done when:** the user can review exact target, pending files/checksums, expected effects, dry run, recoverable backup, candidate evidence and recovery artifacts before deciding about deployment.

## NW11.2 — Execute only the later authorized reviewed rollout

**This task is inactive until the user explicitly requests deployment of the concrete NW11.1 package.** Approval must cover its actual artifacts and target.

1. Recheck target, ledger, pending file checksums and fresh recovery receipt immediately before applying. Stop on unexpected pending files or baseline drift.
2. Apply only reviewed correction migrations through the isolated workspace. Preserve installed migration timestamps and existing data/IDs.
3. Deploy the compatible frozen frontend and matching gateway artifacts using the project's documented hosting route. Do not invent a destination or silently switch project.
4. Verify effective functions/grants/RLS and acceptance with genuine separate sessions: responsible Head, Task Lead, own Subitem Lead, contributor, sibling/deeper Lead, descendant-only contributor, Admin, Viewer/Observer, foreign-Office actor, expired/revoked person and permitted guest where available.
5. Test direct-table attempts as well as RPCs; own-Lead-first routing; self-review prohibition; branch restrictions; concurrent revision conflict; exact retry after committed-but-unobserved save; actual evidence bytes/signed access; financial/readiness contracts and hierarchy paths.
6. Confirm previously protected evidence, budgets, schedules, membership, identities and audit history remain. Exercise refreshed/expired sessions and access revoked while an Inspector is open.
7. Record actual served frontend/gateway version, live migration ledger, actor/session isolation and results in the rollout document. Preserve historical rehearsal receipts.
8. Keep remaining inherited acceptance gaps separate from the nested-work result. Do not declare completion based only on SQL metadata or a synthetic privileged fixture.

**Stop immediately:** wrong target, unexpected live ledger/pending set, unrecoverable backup, changed checksums, security denial regression, data/history loss or mismatched runtime.

## NW11.3 — Recover without flattening or erasing accepted work

1. For an uncommitted migration transaction, follow the CLI/database's verified transaction failure outcome and inspect actual ledger/schema before retrying.
2. For committed corrections, prefer a reviewed forward fix preserving IDs, parentage, Lead/contributors and historical events. Do not remove deployed ledger entries, rename installed migrations or drop accepted nested-work fields.
3. Use the previous compatible frontend/gateway artifact only if its calls and security behavior remain compatible with the current schema. Otherwise temporarily gate the affected operation through the existing supported operational mechanism.
4. Recovery must preserve ended grants, R9 removed-person access revocation, evidence seals, budgets, lifecycle status, receipts and completed decisions. Reinstating a broad old permission function is not an acceptable rollback.
5. If restore is necessary, use the rehearsed backup package and documented impact decision. A destructive restore requires explicit approval tied to the actual recovery package and affected data.
6. Repeat relevant live acceptance after recovery and record incidents/open gates. Keep historical receipts; append the current outcome.

**Done when:** the authorized release or recovery has concrete live evidence and all required acceptance gates are resolved. Documentation-only preparation cannot mark live rollout complete.


## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `docs/phase65-live-deployment-2026-10-07.md`
- `docs/product-refinement/r0-r13-database-rollout-2026-10-09.md`
- `docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json`
- `supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql`
- `supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql`

