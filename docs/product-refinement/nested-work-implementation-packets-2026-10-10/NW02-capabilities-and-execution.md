# NW2 — Trusted action capabilities and own-Lead execution

**Prerequisite:** accepted NW1 contract. Work in three separately checked tasks.


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


## Fixed interfaces for this phase

Preserve existing `r7_work_tree`, `r7_work_command`, legacy fields/booleans and signatures. In a NEW capability correction migration, add optional `capabilities` maps to the existing snapshot root and each node; this is a reviewed additive backend contract, not a structural-only refactor.

Each action entry contains `allowed` and `reason_code` (null when allowed). Root keys: `manage_contributors`, `appoint_lead`, `create_child`, `order_children`. Node keys: `manage_contributors`, `appoint_lead`, `create_child`, `edit_details`, `move`, `order_children`, `delete`, `execute`, `submit`, `review`.

Use a NEW private `eflow_r7.operation_capabilities(p_root uuid,p_node uuid default null)` projector. Existing server predicates remain the authority; a projection is not permission to mutate. Root-task/group creation stays with existing project structural APIs, not tree-management capability. Do not put finance permission in these work capability keys.

## NW2.1 — Add server capabilities and a current correction harness

**Read:** R7 effective `manage/chain/node_work/snapshot/command`; R9 membership overrides; Phase 3 `phase3_create_task` and project-group policies; NW1 fixture inventory.

**Create/change:** NEW CLI-generated migration named for `nested_work_capabilities_and_execution` (timestamp generated during implementation); NEW `scripts/verify-nested-work-correction-sql.mjs`; add `verify:nw-correction` to `package.json`.

1. Discover the installed CLI/migration command through help, then generate a new file. Never edit the original R7.
2. Add the projector from existing current predicates. Appointment of a node's own Lead uses ancestor appointment authority; contributor editing uses branch management.
3. Root `order_children` concerns the task's direct children (`order` payload `parent:null`). Node `order_children` concerns that node's child list (`parent:node.id`). Neither grants rearrangement of the node among its own siblings. `move` is provisional until destination is checked by the command/impact collector.
4. Include caller/current-membership, root-open and lifecycle restrictions in the projection. Denials have stable reason codes such as read-only, access unavailable, branch denied, appointment denied, lifecycle blocked or history blocked; presentation maps codes to user copy.
5. Add root/node maps in `snapshot` while keeping every old field/value. Preserve the private/public security model and exact grants; no anonymous mutation execute.
6. Add synthetic allow/deny cases to the NEW harness. Historical R7/R9 anchor runners remain intact. Include the exact newly generated filename in an explicit reviewed test manifest, not a wildcard of every pending migration.

**Done when:** snapshots and mutation-time rules agree; a contributor or sibling cannot gain management from positive unrelated flags; old response consumers still work.

## NW2.2 — Make own-node Lead execution work end to end

**Read:** `eflow_r7.node_work`; effective `save_subtask_progress`, `submit_subtask_for_review`, `guard_subtask_contributor_update`; `eflow_evidence.can_upload/guard_attempt`; caller adapters in R7.

1. For supported **Office R7 nodes**, allow the current eligible node Lead to execute its own appointed node under a valid delegation chain, even if historical worker arrays omit that person. Preserve the assigned-contributor predicate, the existing personal branch verbatim and legacy excluded-root behavior.
2. Do not grant an ancestor executor rights simply because `manage` is true.
3. Follow raw `assigned_to/assigned_to_ids` predicates through progress, submission, contributor trigger, evidence reservation/upload and attempt/seal authorization. For supported Office R7 work route assignment eligibility through `eflow_r7.node_work`; do not retain a raw worker-array check as an additional required condition; preserve every other status, sequencing, ownership, MIME/size and evidence guard.
4. Keep appointment writes including the Lead in compatibility worker arrays. Do not bulk repair historical data or rewrite completed authorship.
5. Add a fixture whose Lead is absent from both legacy worker fields: snapshot capability, progress, formal evidence attempt/upload and submission must all agree. Add an inactive/revoked/broken-chain version and an unassigned ancestor denial.

**Done when:** Lead-only execution succeeds through real SQL/evidence guards, not only a positive snapshot boolean; contributor behavior and personal/legacy contracts are preserved.

## NW2.3 — Add one frontend capability adapter

**Read/change:** `src/app/features/nested-work/types.ts`, `services/workTreeService.ts`, `index.ts`; **NEW** `src/app/features/nested-work/selectors/capabilities.ts`; **NEW** `tests/unit/nestedWorkCapabilities.test.ts`.

1. Add typed optional capability maps and typed reason entries. Keep `WorkNode/WorkTreeSnapshot/WorkRequest` compatible.
2. Export selectors resolving root/node action availability and user-facing disabled reasons from current server data plus caller readOnly/executionBlocked state.
3. Map absent or unverifiable required action data to disabled/unavailable for the NEW editors. Do not substitute global role, first assignee, `isTaskLead` or broad `can_manage`.
4. Keep existing UI entry points until their later migration task; do not redesign screens in this phase.
5. Test own-appointment denial, contributor-only root edit, Head oversight, ancestor/sibling restrictions, caller readOnly override, missing capabilities, stale actor/scope and separate execute/review permissions.

**Checks:** `npm.cmd run verify:nw-correction`, `verify:r7-hierarchy`, `verify:r9-compatibility`, `verify:merge-integrated`, plus common source gates.

**Stop:** effective bodies/grants differ from NW1; execution parity requires widening Office/evidence/finance or personal policy.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `scripts/verify-r7-hierarchy-sql.mjs`
- `scripts/verify-r9-access-sql.mjs`
- `scripts/verify-r9-compatibility-sql.mjs`
- `src/app/features/nested-work/index.ts`
- `src/app/features/nested-work/services/workTreeService.ts`
- `src/app/features/nested-work/types.ts`
- `supabase/migrations/20260816000001_subtask_evidence_review.sql`
- `supabase/migrations/20260817000002_subtask_progress_leader_notifications.sql`
- `supabase/migrations/20260819000004_subtask_execution_dependencies.sql`
- `supabase/migrations/20260831000001_task_evidence_security.sql`
- `supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql`
- `supabase/migrations/20261008060756_r8_approved_project_invitations.sql`
- `supabase/migrations/20261008081855_r9_project_access_lifecycle.sql`
- `supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql`
- `supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql`
