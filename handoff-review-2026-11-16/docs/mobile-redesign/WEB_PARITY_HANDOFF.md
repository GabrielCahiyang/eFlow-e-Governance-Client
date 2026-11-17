# Portable eFlow Web parity handoff

**Latest archive entry point:** `docs/mobile-redesign/WEB_WORKFLOW_UX_DEPENDENCY_HANDOFF.md`. Use its current deployment distinctions and pending date-link candidate. This earlier visibility/deletion specification remains reference scope, not evidence that every historical proposal is still absent or should be rerun.

Prepared 16 November 2026, Asia/Singapore. This document is self-contained. The receiving agent does not need access to the Mobile developer's computer or checkout.

## Instructions to the receiving Codex agent

Work in your own eFlow Web checkout. Inspect its AGENTS.md, current Git state, callers, tests and installed backend contracts first. Preserve unrelated work. Implement the smallest changes for the rules below. Match behavior and shared contracts; do not copy React Native UI into Web or rebuild working features.

If an archive accompanies this prompt, extract it into a local review folder outside your migration discovery directory. All paths below are relative to that extracted archive. Do not assume any `C:/Users/james/...` path exists on your machine. If files cannot be accessed, identify which attachment is missing rather than inventing its contents.

## Approved behavior

1. **Task visibility stays unchanged.** The new visibility restriction applies only to Subtasks. The subsequently approved limited-editing policy below applies to both Tasks and Subtasks; it supersedes the earlier instruction to leave all Task editing unchanged.
2. **Delete applies to both Tasks and Subtasks:** offer it only to an authorized actor for unstarted work. Recheck current authority, state, started history, descendant/dependency and existing financial/history restrictions. Preserve Task soft deletion/audit and Subtask impact/revision/receipt contracts. Confirm clearly, do not blindly replay uncertain results, and return to a valid parent after success.
3. **Subtask visibility follows parent Task Start:** before the parent Task starts, its appointed Task Lead gets the Subtask planning view. Assigned Subtask Leads, contributors and other project readers wait until parent Start. After parent Start, otherwise authorized project/Office readers can view Subtasks. They do not have to wait for each Subtask to start individually just to view it.
4. **Visibility grants no write authority.** Preserve Task Lead supervision, the assigned Subtask Lead/contributor actions, contributor proposals and Lead approval, no self-review, scheduling, dependency and evidence requirements. Unassigned viewers cannot modify work. Keep direct Office Subtasks as capstone scope; retain existing Personal/history structures and legitimate scoped Office authority.
5. **Contributor management and Lead transfers are separate.** A Task Lead manages contributors on their own Task, including active projects. A Subtask Lead manages contributors on their own Subtask. Exclude the appointed Lead from available/selected contributor lists and counts while preserving canonical Lead IDs in worker arrays. Contributor permission cannot transfer the Lead appointment. Task Lead transfer uses the Project Lead's separate authority; Subtask Lead transfer uses Task Lead authority, subject to existing legitimate scoped Office Head authority and independent restrictions. Overlapping appointments retain only their relevant scope.
6. **Nested selection confirmation:** when a people picker opens inside a modal, stage choices locally. Confirm applies them to the parent form; X/Cancel discards that picker draft. Parent Save changes writes to Supabase. Do not call picker confirmation a completed server save. Retain existing inline Web pickers with clear Save changes rather than adding unnecessary nested dialogs.

## Subsequently approved editing policy — both work types

Existing authorized editors may correct name/title and priority after Start. Due-date changes require existing supervising/upper-Lead authority, a reason and schedule checks. Planned start, prerequisites, hierarchy/order/structure and other planning definitions remain locked after current or historical Start, including started descendants. General details are read-only while awaiting review or completed/cancelled. Contributor updates, appointment authority, execution, blockers, Next step, evidence and approvals retain their independent contracts. Do not introduce a new correction bypass or infer untouched work solely from `status='todo'`.

Use the portable instructions in `docs/mobile-redesign/WEB_STARTED_EDITING_HANDOFF.md`, the full `WEB_CONTRIBUTORS_HANDOFF.md` checklist and the shared reference candidate `docs/mobile-redesign/backend-review/started-editing/20261116030000_started_detail_editing_REVIEW.sql`. They describe the versioned policy, payload, guards, Activity metadata and current deployment evidence. A newer read-only handoff check finds the editing RPC/schema and shared command/capability definitions matching that candidate. Do not blindly reapply either SQL patch. Full installation and authenticated workflow acceptance remain unverified.

## Correct deployment status

- The contributor-authority patch **was applied by the user and verified read-only earlier**: all five installed definitions matched. The attached `evidence/contributor-installed-readonly-verification.json` records those hashes. Older copied prompts saying it was not installed are stale. Recheck current definitions before changing anything; do not reapply the contributor patch or create a competing correction.
- The two newer scripts below are **review candidates prepared by the Mobile agent**. This handoff does not confirm they have been applied. Inspect the recipient's current environment read-only; do not infer installation from their presence in this archive.
- Latest read-only editing-baseline evidence captures a `node_visible` that already includes parent Task current/historical Start. The whole earlier visibility/deletion deployment was not reverified. A subsequent handoff check finds the editing schema/RPC and newer shared command/capability definitions; see the contributor handoff status summary. Do not blindly reapply older candidates or equate these observations with authenticated acceptance.
- No dedicated accounts, disposable fixtures or staging target were approved for agent-run writes. Authenticated mutation/concurrency/device tests remain BLOCKED until approved.

## Existing Web implementation to inspect

At the last inspected checkout (`d68f13d964d644fdb2b84b1ca345d3c1d2016771`), these parts already existed; inspect your latest code before editing:

- `src/app/features/tasks/components/board/TaskManagementMenu.tsx` and `useTaskLifecycleActions.tsx`: Task deletion menu/confirmation; trace all caller gates and list/board/editor variants.
- `src/app/features/tasks/services/taskReviewLifecycleService.ts`: `soft_delete_task` call.
- `src/app/features/nested-work/components/WorkHierarchy.tsx`: capability-driven Delete subtask and other actions; check table/detail variants and stale impact recovery.
- `WorkRootOwner.tsx`, `WorkRootStaffingDialog.tsx`, `WorkStaffingDialog.tsx`, `WorkPeoplePicker.tsx`, `WorkLeadField.tsx`, `WorkContributorsField.tsx`, `WorkTreeEditor.tsx` and `selectors/staffing.ts`: separate permissions, Lead exclusion, canonical IDs and Save changes already partly implemented.

The deployed Web build itself was not verified by the Mobile agent. Do not confuse a source checkout with deployment acceptance.

## Backend review files in this archive

- `docs/mobile-redesign/backend-review/subtask-planning/20261116010000_unstarted_task_delete_REVIEW.sql`: atomic pre-start/history check in existing `public.soft_delete_task`. Passed 18 isolated PostgreSQL checks.
- `docs/mobile-redesign/backend-review/subtask-planning/20261116020000_parent_task_subtask_visibility_REVIEW.sql`: corrects `eflow_m7.node_visible`, baseline node/people/count projection, evidence readers and missing restrictive attachment-metadata policy. Passed 69 isolated checks per LF/CRLF input mode.
- `docs/mobile-redesign/backend-review/started-editing/20261116030000_started_detail_editing_REVIEW.sql`: limited started editing and atomic Task edit Activity, with current evidence and 50 isolated assertions per LF/CRLF mode. See its README; do not execute `policy-body.sql` alone.
- The adjacent README, captured definitions and supporting policies document exact assumptions and limitations. Scripts stop on expected-function hash/anchor drift. Never remove those checks to force an installation.

The existing operational Subtask/progress/submission/event/notification read policies are **RESTRICTIVE**. An earlier inference that they combined with broad policies through OR was incorrect. Inspect their actual predicates and security-definer projections; do not add duplicate policies blindly.

Review snapshots, raw reads, counts, dependency metadata, history/proposals/evidence, feeds, notifications, search, links, Storage and Realtime. Root events can embed complete node snapshots even with a null node ID. Preserve Task visibility, Personal work, finance authority and historical records. The proposed SQL uses parent status history for genuinely started historical parents; the current Mobile cancelled-parent presentation still fails closed and needs a compatible historical-start projection/native adaptation before complete historical parity can be claimed. Previously issued file links/cached payloads and real Storage behavior remain unverified.

Coordinate one reviewed migration against the actual installed baseline. These prepared scripts are evidence and proposals, not permission to apply SQL. If their assumptions differ from your latest source/deployment, report exact differences and revise the proposal for review.

## Validation and limits

The archive includes SQL test runners and captured baselines with their original relative layout. They run disposable local PGlite only. Set `EFLOW_WEB_SOURCE` to your own Web checkout containing the already installed `@electric-sql/pglite` dependency, then run the scripts using their actual extracted paths. No packages need be downloaded by these runners. If the dependency is absent, report the local SQL test as blocked instead of silently installing tools.

- `scripts/verify-unstarted-task-delete-review.mjs`
- `scripts/verify-parent-task-visibility-review.mjs`
- `scripts/verify-parent-task-visibility-review.mjs --crlf-sql`

Identity/membership/finance/activation/file-scope adapters are synthetic. Local SQL passes do not establish production RLS, real account roles, storage, signed-link/cache behavior, concurrency, Web/Mobile workflows or staging acceptance. Mobile reference snippets are illustrative, not portable Web tests.

Add regressions for unchanged Task visibility; authorized delete before Start and denial after Start/history/descendant changes; concurrent Start/delete; pre-start Subtask denial and Task Lead planning; post-start readers without write authority; contributors/Lead exclusion and transfer separation; cross-branch/Office denial; overlapping appointments; nested Confirm/Cancel; and stale/uncertain receipt recovery. Run repository-required check/test/build and configured browser smoke tests. Real-role tests use protected login and approved dedicated fixtures only; never request passwords or bypass authentication/RLS.

## Authorization and deliverables

Do not apply migrations, change production data/RLS/grants/configuration/roles, deploy, push, or create/mutate live fixtures without explicit approval. Preserve secrets and unrelated dirty work. The sole historical hosted target recorded by this handoff is `ixnfphgjyelhckjwjkdv`; verify your configured target rather than silently redirecting it.

Return exact changed files, existing-versus-changed behavior, reviewed SQL/deployment status, compatibility/rollback/staging requirements and PASS/FAIL/BLOCKED evidence. Keep implementation, tests, deployed definitions and authenticated acceptance separate. Do not declare complete privacy/deletion safety while the shared enforcement or real testing remains unverified.
