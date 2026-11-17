# Web handoff — workflow feedback and date-neutral prerequisites

User-approved scope, 16 November 2026. **Implement in your own Web checkout.** Read its AGENTS.md, inspect Git state and preserve unrelated work. Inspect existing features and make the smallest necessary changes. No production changes, migration execution, deployment, push or live fixtures without explicit approval.

This ZIP is self-contained: all paths below are relative to its extracted root. Extract outside automated migration discovery. Mobile sources under `mobile-reference/` illustrate contracts/UX and regression cases; do not paste React Native code into Web or treat those files as standalone runnable Web tests. Use the authoritative Web code in your checkout.

## Latest prerequisite rule — both Tasks and Subtasks

- Dependency selection is independent of prerequisite dates. Incomplete A can be linked without a due date, and A/B can overlap or start on the same day. Show dates as information; remove disabled options and save validation based on A's due date versus B's start.
- Preserve execution gates: B cannot Start, enter `in_progress`/set `started_at`, submit completion or Complete until every selected A is `completed` and B's own start date has arrived. Cancelled selected prerequisites remain unresolved. Preserve all additional authority, parent Task activation, Lead, review/evidence and lifecycle restrictions.
- Preserve Task bounds within project dates; Subtask bounds within project/Task/ancestors; start <= due. A prerequisite's missing due date is not a linking error, but this does not remove an independent schedule requirement on creation/editing of that work item itself.
- Preserve scope/visibility, self/duplicate/cycle detection, pre-start prerequisite edit lock and protections against reopening/deleting prerequisites used by started work. Preserve `null` legacy sequential behavior and explicit `[]` independence. Never silently convert between them.
- Do not change Task/Subtask dependency semantics to OR: multiple selected prerequisites must ALL be completed.

Inspect current Task dependency fields/selectors, `WorkTreeEditor`, dependency/schedule selectors, writers, capabilities and completion/submission/approval paths. Search for the actual date comparisons and due-required checks, not just the picker label. Do not remove own-date-bound validation while removing cross-item date coupling.

**Backend correction REQUIRED and NOT APPLIED:** read `docs/mobile-redesign/backend-review/dependency-linking/README.md`. The pending candidate `20261116040000_date_neutral_dependency_linking_REVIEW.sql` removes only three date comparisons in `eflow_project.guard_dependencies()`, `eflow_r7.guard_subtask_dependency_write()` and `eflow_r7.check_subtask_dependency_graph()`. All three originals still matched in the final read-only production check. Preserve its raw-hash and normalized single-anchor checks. Review against your latest migrations and installed definitions; do not author a competing patch or bypass server rejection in JavaScript.

Until coordinated installation, a save can still fail on the server. Mobile translates the old date-link rejection to “Prerequisite linking needs a backend update. Contact your Office Head.” Keep the entered selection visible on failure and never show it as saved.

## Workflow UI changes to match

1. Put authorized Task and Subtask Delete beside Edit, with distinct destructive styling and an explicit confirmation. Keep every existing permission, ever-started/history, dependency/descendant, review, finance and atomic server restriction. Visibility/placement is not permission.
2. Use small accessible pending feedback for writes and refreshes. Disable duplicate submissions and affected actions until the confirmed result/refresh. Local selection drafts can update immediately; server statuses, deletion, staffing, review and finance must not falsely appear committed. Preserve original request IDs, receipts and uncertain-outcome recovery.
3. Do not hide otherwise authorized action buttons solely because a background capability read started. Keep last-known controls visible but disabled with a small checking indicator. Initial capability loading needs an explicit placeholder; missing/stale/unavailable/revoked permissions still fail closed and are rechecked on submission. Do not weaken finance or account-access guards to stop flicker.
4. Reopening an ordinary edit form loads current saved values, not an abandoned typed draft. Do not reset typing on every background update. Failed open-form saves retain input; uncertain requests keep their separate immutable recovery flow. Creation drafts may retain their existing behavior.
5. Replace the child-timeline validation with: `Ask the appointed Task Lead to reschedule “<subtask name>” first.` Keep actual schedule validation and the current form values. Use an understandable validation title rather than a generic crash message.
6. Show a small Start work confirmation before the fresh authority check and write; cancel makes no write. Keep own schedule/dependency checks intact. Prevent stacked confirmations/double taps. Explain parent Start visibility where relevant.
7. Put the existing “Work has started…” limited-editing notice at the very top of the Task edit form, before its fields. Retain the limited-edit policy and review/completion locks.

Use Web-native dialogs/loading patterns already present. Retain inline selectors with a clear Save changes action; nested people selectors need Confirm/Cancel, with Confirm updating the parent draft and Save writing to Supabase. X/Cancel discards the nested draft.

## Cumulative rules still required

Read **both** `docs/mobile-redesign/WEB_CONTRIBUTORS_HANDOFF.md` and `docs/mobile-redesign/WEB_STARTED_EDITING_HANDOFF.md`. Their full requirements remain part of this handoff:

- Own Task/Subtask Leads manage contributors, including active projects, without Lead-transfer authority. Exclude the appointed Lead from contributor choices/selections/counts while retaining canonical backend IDs. Project membership alone grants no staffing authority. Preserve scoped upper-Lead/Office authority, overlapping appointments and revoked-access/receipt recovery.
- Both Tasks and Subtasks have limited editing after Start: existing authorized editors may correct name/priority; existing supervising authority plus a reason is needed for due-date changes. Planned start, dependencies and structure remain locked. Record actual committed field deltas and authorship in Activity; preserve before/after data, reasons and proposal-versus-application distinctions.
- Task visibility remains unchanged. Only Subtask visibility waits for parent Task Start, with the appointed Task Lead's planning exception and no extra execution/edit authority. Preserve legitimate historical visibility and existing privacy restrictions across snapshots, raw reads, counts, history/evidence, notifications, links and Realtime. See `docs/mobile-redesign/WEB_PARITY_HANDOFF.md` and the included `backend-review/subtask-planning/` references.

Inspect existing `TaskManagementMenu`, `useTaskLifecycleActions`, `WorkHierarchy`, `WorkStaffingDialog`, `WorkContributorsField`, `WorkLeadField`, `WorkRootOwner`, `WorkTreeEditor` and `selectors/staffing.ts` before rebuilding anything. Contributor and deletion controls already exist in Web source; retain working implementations.

## Deployment status — distinguish evidence from acceptance

- Contributor correction: three contributor-specific definitions still match the installed correction. Two shared functions match the later started-editing candidate after newline normalization. Do not use the obsolete claim that all five originals remain unchanged.
- Started editing: schema/RPC existence and two shared-definition matches observed; full trigger/grant/RLS and authenticated acceptance unverified. Historical preparation headers are not current installation status.
- Parent-start visibility/deletion: current evidence includes a parent-start `node_visible` predicate. Entire earlier proposal installation/security/atomic race behavior is not certified.
- **New date-linking candidate: not installed**, as confirmed by the three current target hashes. It requires review, approved staging tests and separate production approval.

Do not execute every SQL file in this ZIP. Earlier proposals are historical/reference inputs and may fail safely against newer definitions. Do not remove hash checks or silently overwrite installed contributor/started-editing functions. All agent hosted operations for this work were read-only.

## Required verification and report

Add meaningful Web regressions for overlap/undated linking, all-prerequisite completion, cancelled unresolved, own-date bounds, scope/cycles, pre-start locks/reopen/delete protections, error recovery, stable pending controls, fresh ordinary edits, Start cancellation/double taps, contributor/Lead separation and Activity deltas. Run your checkout's required checks/tests/build and browser checks.

The Mobile evidence in `evidence/` records **636 tests / 146 suites**, TypeScript/Metro, Android+iOS JS exports, Android release/signature/30 active-source matches and a three-executable credential audit. Seven maintained components are not in the current bundle and have only source/test coverage. The dependency SQL runner passed **44 disposable local assertions per LF/CRLF mode**; synthetic helpers do not establish hosted roles/RLS/concurrency or staging safety.

Use approved dedicated Head/Project Lead, Task Lead and separate Subtask Lead/reviewer fixtures through normal login. No accounts/fixtures/staging were approved for mutation, so real authenticated/RLS/concurrent-session, Web-to-Mobile, native install and Android/iOS workflow acceptance are **BLOCKED/NOT RUN**. The candidate README contains the staging matrix. Report exact changed files, errors/RPCs and PASS/FAIL/BLOCKED evidence. Do not claim end-to-end success from compilation, mocks, installed function hashes or these Mobile references.
