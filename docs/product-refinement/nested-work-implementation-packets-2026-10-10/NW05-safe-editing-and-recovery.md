# NW5 — History-aware commands, impact confirmation and draft recovery

**Prerequisite:** NW2–NW4 and NW1 operation-state matrix. This phase is split into backend and frontend tasks so smaller models never rewrite every layer at once.


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


## NW5.1 — Centralize operation history and impact checks

**Read:** effective R7 `command/guard_node/guard_root/guard_completion`; R9 `impact/preview/clear_staff`; canonical progress/submission/evidence/allocation/cash/ledger tables; WorkTreeEditor payload construction.

**Create:** NEW CLI-generated migration named for `nested_work_operation_safety`. Fixed NEW private helpers: `eflow_r7.subtree_ids(p_root uuid,p_node uuid) returns uuid[]`, `eflow_r7.history_facts(p_root uuid,p_ids uuid[]) returns jsonb`, `eflow_r7.operation_impact(p_root uuid,p_command text,p_payload jsonb) returns jsonb`.

1. Bound traversal to the same root and depth/cycle safety.
2. Gather status/progress plus recorded progress, submissions/reviews, attachments/private sealed evidence, allocations/caps, petty-cash and ledger history. For personal work inspect `work_tree_events` execution commands `progress/submit/review` and relevant snapshots; creation/staffing alone is not execution history. Return counts/blocker codes, not private file paths. Unknown/unavailable history must fail closed for the affected operation.
3. Collect complete operation scope: moved/deleted/edited subtree, all reordered sibling subtrees, creation parent, contributor/Lead transfer affected appointments, and both movement endpoints.
4. Apply NW1 per-field lifecycle rules. Historical `todo`/0% is not untouched. Preserve permitted audited metadata/staff amendments rather than banning all started-work staffing.
5. Call the collector inside locked `r7.command` and equivalent direct-write guards before any affected write. Old command callers cannot bypass the new history rule.
6. Refine NW2 capability projection with the same safety predicates.
7. Preserve children-first deletion, no CASCADE history destruction, transfer invalidation, current R9 atomic membership removal and existing audit/receipt semantics.

**SQL assertions:** each history source independently blocks its prohibited operation; descendant-only history blocks; untouched safe subtree succeeds; cycle/depth9/deadline/foreign destination denial; failed write preserves rows/events/revision/finance.

## Collector table and writer inventory

Use this verified read set in NW5.1. Inspect effective overrides before implementing joins.

| History source | Link to selected work |
|---|---|
| `public.subtasks` | `id`, `task_id`, `parent_subtask_id`; status/progress/Lead/workers/latest submission |
| `public.personal_subtasks` | `id`, `task_id → personal_tasks.id`, `parent_subtask_id`; current execution/review fields |
| `public.subtask_progress_updates` | `subtask_id`, `task_id`; percentage and optional attachment |
| `public.subtask_submissions` | `subtask_id`, `task_id`; status and actual `decided_by/decided_at` |
| `public.subtask_submission_attachments` | `subtask_id/task_id/submission_id` |
| `eflow_evidence.objects` | `subtask_id/task_id`, `reference_kind/reference_id`; canonical seal identity |
| `eflow_evidence.attempts` | `subtask_id/task_id/kind/submission_id`; `creation_xid` transaction ownership |
| `public.work_budget_allocations` | `subtask_id/task_id`; includes protected caps |
| `public.work_budget_allocation_lines` | `allocation_id → work_budget_allocations.id` |
| `public.petty_cash_requests` | `subtask_id/task_id/allocation_id/allocation_line_id` |
| `public.budget_ledger_entries` | Direct `subtask_id/task_id`, with fallback joins through `allocation_id` and `petty_cash_request_id` for older/null links |
| `public.work_tree_events` | `root_id/project_id/node_id/command/before_data/after_data`; personal execution history as NW5.1 specifies |

Count protected historical financial rows regardless of current active status. Do not attribute root-only finance rows arbitrarily to every branch. Return private evidence counts/blockers, never object names or signed paths.

For NW5.2 lock coordination inspect these named producers and their effective trigger/RLS/direct-write paths:

- Progress/review: `save_subtask_progress`, `submit_subtask_for_review`, `decide_subtask_review`, `guard_subtask_contributor_update`; Phase 6 `phase6_guard_subtask/phase6_progress_authority`.
- Evidence: `eflow_evidence.guard_attempt/guard_attachment/guard_progress/seal_file/lock_path/guard_history`; upload `can_upload/path_context`.
- Allocations/caps: `create_subtask_budget_allocation/set_subtask_budget_cap/remove_subtask_budget_cap`; `eflow_budget.fund_work`, `fund_office_work`, `guard_partition_funding/check_partition_balances`.
- Cash/ledger: `create_contextual_cash_request/resubmit_contextual_cash_request`, `eflow_budget.cash_request_v2`, `create_contextual_cash_request_v2`, `audit_cash_request_change/audit_cash_release_change/audit_liquidation_change/audit_receipt_attachment/prevent_budget_ledger_mutation`, `eflow_budget.submit_items/submit_itemized_cash_liquidation`.
- Tree/access: `eflow_r7.command/bump/guard_node/guard_root`; `eflow_r9.serialize/remove_person/clear_staff`; Office-removal override.

This inventory identifies what to audit. It does not claim these writers already share a sufficient lock protocol.

## NW5.2 — Add authoritative previews and a checked confirmation wrapper

**Create in the NEW migration:** public invoker `nw_work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb)`; public invoker `nw_work_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text)`, delegating through restricted private helpers.

**Fixed interfaces:** both public wrappers return `jsonb`; the restricted NEW helper is `eflow_r7.checked_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text) returns jsonb`. Use fixed search paths: public invoker wrappers delegate only to their named private helpers; private definer helpers use fully qualified names and the existing locked-path pattern. Grant authenticated execution only on public entry points and the exact helper execution needed for invoker delegation; revoke anonymous/public execution and keep private tables inaccessible under the existing R7 pattern.

**Fixed preview JSON fields:** `root_id` (UUID string), `expected_revision`/`current_revision` (integers), `command` (string), `allowed` (boolean), `blocker_codes` (string array), `selected_count`/`descendant_count`/`affected_appointment_count` (integers), `before_path`/`after_path` (authorized string-label arrays), `fingerprint` (opaque string). Empty paths are empty arrays. Denied/unreadable previews return only authorized facts or the existing access denial. Define stable blocker code vocabulary in the NW1 contract before UI mapping.

1. Fingerprint covers canonical command/payload and relevant current affected tree/history/appointment facts; exclude time generated by the preview itself. Do not rely on tree revision alone when finance/evidence facts can change independently.
2. Checked command first validates current actor/read scope, then takes the existing R9 project advisory lock, project row, root row and affected item rows in stable ID order. Preserve advisory-before-row ordering in participating R7/direct safety paths; invoke the existing R7 command reentrantly in the same transaction.
3. Audit progress/submission/private-evidence/finance producers for that serialization protocol. These history tables are not all covered by R9's current serialization triggers. Require shared locking or an equivalent proven atomic protocol before claiming safety against history inserted between fingerprint validation and mutation. A fingerprint or root lock alone is insufficient. If this requires a contract change outside authorized scope, stop and document it.
4. If an actor/request receipt already exists in `eflow_r7.receipts` (identity actor/request), verify identical root/command/payload and return the existing operation's current authorized receipt/snapshot. Do not rerun impact or duplicate an already committed write merely because its old fingerprint is now stale.
5. Otherwise verify revision, fresh impact eligibility/fingerprint and invoke the existing checked R7 command in the same transaction. Its normal safety checks still run.
6. Keep old r7 signatures/payload allowlist intact. The fingerprint is a precondition of the new wrapper, not an extra field smuggled into old payloads. Changed mutation terms under a reused request ID conflict.
7. In frontend `WorkRequest`, add an optional impact fingerprint; `saveWorkTree` dispatches confirmed-impact requests to the new wrapper and preserves the ordinary path for commands needing no impact confirmation. Missing/denied new wrapper never falls back to an unchecked write.
8. Add preview service/type exports through nested-work index. Never replace project removal R9 APIs with this branch wrapper.

**Tests:** preview then changed history without tree revision; concurrent appointment/history insert with genuine separate database sessions (synthetic sequential cases establish only stale-preview evidence); cancel no calls; accepted result lost then exact retry once; changed retry terms; denied preview does not expose private paths; direct original r7 command still enforces safety.

## NW5.3 — Extract editor state and retry outcomes

**Existing:** WorkTreeEditor, useWorkTree, useExplicitDraft, navigationGuard.
**NEW:** `src/app/features/nested-work/types/editor.ts`, `src/app/features/nested-work/selectors/editorDraft.ts`, `src/app/features/nested-work/hooks/useWorkEditorDraft.ts`; tests `tests/unit/nestedWorkEditorDraft.test.ts`, `tests/unit/nestedWorkRequestRecovery.test.tsx`.

1. Move initialization, per-mode baseline equality and payload conversion into pure selectors. Untouched forms are clean; compare title/due/mode/parent/order/Lead/people/note/progress only in applicable modes.
2. Keep baseline revision and created-node/request IDs stable. First send freezes ID/command/payload/revision/fingerprint.
3. Distinguish confirmed failure, stale revision, unknown result, committed save plus failed refresh, and revoked authority. Unknown receipt retry uses exact original args; never alter frozen payload under one ID.
4. Open editors consume current NW2 action and appointment capability, not original `edit.node.can_appoint`.
5. Reduce WorkTreeEditor to mode composition; do not move every command's business rule into a new giant hook.

**Tests:** clean forms; every applicable field becomes dirty; double click once; changed revision retains draft; uncertain retry same object/IDs; completed save followed by failed refresh never duplicates.

## NW5.4 — Retain drafts across refresh, navigation and actual reload

**NEW:** `src/app/features/nested-work/services/workDraftStore.ts`, `src/app/features/nested-work/hooks/useWorkDraftRecovery.ts`, `tests/unit/nestedWorkDraftRecovery.test.tsx`. **Change:** useWorkTree, WorkTreeEditor, root/dialog owners.

1. Keep polling/focus authority refresh while dirty. Do not use `hold` to freeze current permissions.
2. Transient refresh failure preserves last snapshot plus editor draft, shows retry and disables actions requiring fresh verification. Explicit denied/revoked access clears protected tree display; retain only safely scoped quarantined draft data pending renewed authorized read.
3. Store whitelisted editor fields and request identity in per-tab sessionStorage, keyed by actor/project/root/item/mode plus baseline revision. Do not store whole snapshots, credentials, file objects, signed URLs or evidence payloads.
4. Recover only after fresh actor/scope/access verification. Show recovery/stale state; never auto-save. Actor switch/logout must clear or make old draft unrecoverable to the new actor.
5. Wire navigationGuard identity to task/item/mode. Close, section switch and collapse go through requestNavigation; explicit discard clears only the current draft. Successful save clears its draft.
6. Remove unused hold state only after all consumers/tests migrate.

**Tests:** dirty polling failure; fresh revocation disables save; reload recovery; stale recovered revision; wrong actor isolation; accepted discard; close while pending; late read cannot affect new item.

## NW5.5 — Split lightweight command forms and confirmations

**NEW under `src/app/features/nested-work/components/`:** `WorkDetailsEditor.tsx`, `WorkMoveDialog.tsx`, `WorkOrderDialog.tsx`, `WorkDeleteDialog.tsx`.
1. Details keeps title/due/Execution mode; create adds optional eligible Lead/contributors with advanced mode.
2. Move uses authorized readable destination paths and reparentChoices preview; server rechecks root/depth/ancestry/deadlines.
3. Order is one authorized parent's complete child list, with labelled keyboard Move up/down.
4. Delete displays selected-item plus child counts from NW5.2 and blockers.
5. Apply NW1 confirmation matrix: routine untouched rename/progress/notes no extra prompt; transfers, affected removals/moves/mode/material date impact reviewed; subtree deletion strong confirmation.
6. Keep `is_standalone` storage; UI labels “In sequence” / “Can start independently”; no Depth/root/ancestor jargon.

**Checks:** correction SQL runner for NW5.1/2, hierarchy/access suites, common source gates, R7 retry/revocation/navigation E2E. **Stop:** unapproved lifecycle exceptions, an unavailable exact canonical history source, or unproven serialization with relevant history writers.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/features/nested-work/components/WorkTreeEditor.tsx`
- `src/app/features/nested-work/hooks/useWorkTree.ts`
- `src/app/features/nested-work/index.ts`
- `src/app/features/nested-work/services/workTreeService.ts`
- `src/app/features/nested-work/types.ts`
- `src/app/shared/navigationGuard.ts`
- `src/app/shared/useExplicitDraft.ts`
- `supabase/migrations/20260816000001_subtask_evidence_review.sql`
- `supabase/migrations/20260817000002_subtask_progress_leader_notifications.sql`
- `supabase/migrations/20260819000004_subtask_execution_dependencies.sql`
- `supabase/migrations/20260822000008_department_budget_and_petty_cash.sql`
- `supabase/migrations/20260824000007_task_budget_daily_petty_cash_workflow.sql`
- `supabase/migrations/20260826000001_fix_subtask_budget_allocation_fiscal_reference.sql`
- `supabase/migrations/20260826000003_dynamic_task_funding.sql`
- `supabase/migrations/20260831000001_task_evidence_security.sql`
- `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql`
- `supabase/migrations/20261007153615_office_budget_partition_funding.sql`
- `supabase/migrations/20261007154917_petty_cash_vouchers_items.sql`
- `supabase/migrations/20261007160031_office_budget_ledgers.sql`
- `supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql`
- `supabase/migrations/20261008060756_r8_approved_project_invitations.sql`
- `supabase/migrations/20261008081855_r9_project_access_lifecycle.sql`
- `supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql`
- `supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql`
