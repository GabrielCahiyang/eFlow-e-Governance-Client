# Capstone Web Task / direct-Subtask alignment — 15 November 2026

Scope: confirmed Web workflow defects only. Started from clean `main`. No push, deployment, SQL application, hosted record writes, fixture creation in a hosted database, account login, credential changes, publication changes, or migration-history changes were performed. Existing nested work and historical receipts remain intact.

## Production definition inspection — PASS (read-only)

Connected only to `ixnfphgjyelhckjwjkdv` with a PostgreSQL read-only transaction; inspected function definitions and trigger/publication metadata, then rolled back. This establishes installed definitions, **not authenticated acceptance**.

| Installed function | Definition MD5 |
| --- | --- |
| `eflow_r7.complete_subitem(uuid,jsonb)` | `59ed3dc6fa227c067073d7b60f85edd6` |
| `eflow_r7.operation_capabilities(uuid,uuid)` | `dfa6e9d95e8303e1a737deaca383902e` |
| `public.m7_start_subtask(uuid,uuid)` | `f1048dc09d64f2b25033bdd64ca3e9e7` |
| `eflow_r7.guard_subtask_dependency_write()` | `b4d5670273b17c2bc3395144404452bc` |

Confirmed the completion sibling-order condition is guarded by `s.dependency_ids IS NULL`; did not reapply it or older pending dependency migrations. Start and operation capabilities use explicit selections when non-null. The write trigger requires pre-start planning authority, rejects cancelled replacements, permits removal of visible cancelled selections, and denies removal of invisible selections. `tasks`, `subtasks`, and `subtask_progress_updates` are published; `task_progress_updates` is absent from `supabase_realtime`.

## Confirmed client defects and fixes

| Status | Exact files | Defect / resulting behavior |
| --- | --- | --- |
| PASS — local regressions | `src/app/features/task-inspector/components/TaskInspector.tsx`; `src/app/features/tasks/selectors/dependencyReadiness.ts`; `src/app/features/tasks/index.ts`; `src/app/features/task-inspector/components/InspectorExecution.tsx` | Start previously ignored dependencies and planned dates. Start now requires completed prerequisites (missing/cancelled remain unresolved) and a valid date on/before the current work day. Uses the server-provided scheduling day when available. The message explains that both Start and final submission wait for prerequisites. Progress permission alone cannot expose Start for an unready Task. Lifecycle RPCs retain final authority. |
| PASS — local regressions | `src/app/services/taskDiscussionService.ts` | Replaced the unpublished-history subscription with existing shared published Task-row invalidation, confirmed local events, focus/visibility refresh, and 15-second visible-document polling. Coalesces overlapping reads and cleans up listeners/timers. A failed read never calls the success callback with `[]`. Emits the local event after `submit_task_progress` confirms success. |
| PASS — local regressions | `src/app/features/task-inspector/components/InspectorExecution.tsx`; `src/app/features/work-state/components/WorkExecutionForm.tsx` | Retains the last confirmed blocker on refresh failure, shows a retry/error, and disables updates while blocker state is unverified. Confirmed remote blocker reporting/clearing now reaches an untouched form; local edited drafts remain intact. |
| PASS — local regressions | `src/app/features/subtasks/selectors/sequencing.ts`; `src/app/features/subtasks/selectors/subitemStart.ts`; `src/app/features/subtasks/components/SubitemInspector.tsx`; `src/app/features/subtasks/components/SubitemWorkflow.tsx`; `src/app/features/subtasks/components/SubtaskProgressForm.tsx`; `src/app/features/subtasks/selectors/inspectorCapabilities.ts` | Existing sequencing already distinguished `[]` from `NULL`. Added missing/restricted-context blocking, explicit-selection Start checks, and protection against a stale caller-supplied earlier sibling overriding non-null selections. Dependency messages refer to prerequisites. Server-selected execution/submit capabilities remain required. |
| PASS — local regressions | `src/app/components/ui/workspace/PrerequisiteCell.tsx`; `src/app/features/nested-work/components/WorkNodePlanningCells.tsx` | Visible cancelled selections can be unchecked/replaced by an already-authorized planner; unselected cancelled work is not offered. Missing/restricted selections keep editing closed. The editor formerly collapsed `NULL` and `[]` into an identical draft, disabling a direct empty-selection save. It now preserves that distinction and offers an intentional “Use no prerequisites” action, writing `[]` once. Existing gates still require `can_edit_dependencies`, `todo`, and no `started_at`; the checked command and write trigger decide each save. |
| PASS — local regressions | `src/app/features/subtasks/services/subtaskCompletion.ts`; `src/app/features/subtasks/services/subitemLeadReview.ts`; Inspector/form files above | Refreshes current direct-completion capabilities or Lead-proposal eligibility before a new attempt. Confirmed SQL denials require another recheck. Transport/unknown results retain the same request and uploaded evidence for receipt recovery; recovery does not require a capability that successful completion may already have removed. RPC payloads and public return values are unchanged. |

## Traced lifecycle (source and installed definitions)

1. Project table / Task Work / My Work entrances route supported Office work through `SubtaskWorkDrawer.tsx` to `SubitemInspector.tsx`, using `r7_work_tree` and strict item/history reads. Existing nested children remain viewable; no creation expansion was added.
2. `SubitemStartPanel.tsx` calls `public.m7_start_subtask`. The installed function checks appointed Subtask Lead, active project, parent Task in progress, planned date, parent-node activation where applicable, and explicit prerequisites or NULL legacy ordering. It safely returns an existing activation on repeat.
3. `SubtaskProgressForm.tsx` calls `save_subtask_work_update` for direct progress and blocker reporting/clearing. Contributor proposals use `m7_work_proposals` / `m7_propose_work`; direct authority remains independent from proposal/reviewer authority. `useWorkTree` uses shared work-change invalidation and bounded refresh; `useSubitemInspectorData` strictly reloads canonical progress/history.
4. A separately appointed Subtask Lead submits completion through `SubitemLeadReview.tsx` / `m7_propose_work`. Returned proposals retain their history; a revised submission supplies `p_supersedes`. Current server-selected `canDecide` controls review buttons.
5. `m7_decide_work` / `eflow_m7.decide_work` checks current reviewer, no-self-review, unchanged baseline, evidence and request identity. Approval of a Lead completion invokes `eflow_r7.complete_subitem`; a return does not write canonical completion. A Lead holding both applicable appointments uses `public.complete_subitem` directly. Canonical completion retains the installed dependency, descendant, financial, evidence and receipt guards.
6. Parent Task submission remains `submit_task_for_review`, followed by `decide_task_review`. Child completion/readiness, independent reviewer eligibility and financial checks remain separate. No backend guard was weakened.

## Verification

Intercepted tests and mocked regressions cannot establish Web/Mobile or production parity. Local raw command logs are retained under ignored `.codex-tmp/capstone-readonly/`.

- Focused regressions: **PASS — 73 tests / 11 files**, including explicit `[]`, satisfied/incomplete/cancelled/missing selections, NULL ordering and intentional conversion, stale sibling override, authorized correction, blocker refresh/error retention, return/resubmission, current eligibility and same-request recovery (`focused-final.log`).
- `npm run check`: **PASS**, repeated after the final client edit (`check-final.log`).
- `npm test`: **FAIL / incomplete**, with 408 of 409 files returning a result. Seven failures reproduced both against the changed working source and an isolated unchanged-`HEAD` source overlay (5 failed / 2 passed files; 7 failed / 89 passed tests in each comparison). Two additional full-run 5-second timeouts passed on the bounded rerun. The remaining file stalled and the owned test process tree was stopped; no complete-suite PASS is claimed.
- `npm run build`: **PASS**, repeated after the final edit; chunk-size/dynamic-import warnings remain (`build-final.log`).
- Existing intercepted Chromium smoke: **PASS — 2 tests**, using the built local preview (`direct-subitems.spec.ts`, `subtask-schedule.spec.ts`). The first dev-server attempt failed during `page.goto('/')` at `fixtures/projectWorkspace.ts:485`, before login/workflow interaction (120s / 90s timeouts). Built-preview execution passed; this is synthetic browser coverage only.
- `npm run graph:update`: **PASS with parser limitations**, repeated after the final edit. Five partial-extraction warnings concern untouched `guided-tours/index.ts`, `productivity/index.ts`, `project-table/components/ProjectTaskCreateAction.tsx`, `project-table/components/ProjectTaskRow.tsx`, and `work-templates/index.ts`. No forced graph replacement/rebuild was used.
- `git diff --check`: PASS.

Unchanged-HEAD failures (not broadened into this capstone patch):

| Exact test file | Reproduced error |
| --- | --- |
| `tests/unit/globalUiP3.test.tsx` | 3 failures: `supabase.channel is not a function` in `subscribeNotificationChanges`, called by the invitation membership queue with an incomplete mock. |
| `tests/unit/reviewEvidenceDetails.test.ts` | Missing expected text `75%`. |
| `tests/unit/financialRemediationPresentation.test.tsx` | Expected `Financial Officer`, rendered Accounting wording. |
| `tests/unit/workspaceRefinementHierarchy.test.tsx:53` | Missing `Bob selected for project` after overlapping refreshes. |
| `tests/unit/workspaceRefinementWorkRefresh.test.tsx:121` | Expected 2 load calls, received 1 after the slow refresh timer. |

`tests/unit/nestedWorkTableEntrances.test.tsx` and `tests/unit/nestedWorkDraftRecovery.test.tsx` timed out in the parallel full run but passed in both bounded comparison runs. `tests/unit/nestedWorkCollapsedReadiness.test.tsx` produced no test result in the full run and also stalled for 60 seconds under unchanged `HEAD`; that isolated baseline process was stopped. These are repository test gates, not evidence of live workflow parity. Comparison tooling read `HEAD` sources into an ignored Vite loader overlay; working files were never reverted or swapped.

## Authenticated acceptance matrix — BLOCKED

No accounts or disposable fixtures have been explicitly designated. No passwords were requested, authentication bypassed against an actual service, or capstone records used for tests. Every row below requires approved accounts and disposable fixtures before execution; Mobile also requires an approved build/device/session.

| Required scenario | Live status | Available local evidence |
| --- | --- | --- |
| Project / Task / direct-Subtask creation, assignment and dates | BLOCKED | Existing creation/staffing/date tests; date readiness regression |
| Explicit `[]` with unfinished unrelated earlier siblings | BLOCKED | Sequencing, Start Inspector and stale-caller form regressions |
| Satisfied versus incomplete selected prerequisites | BLOCKED | Sequencing and Start Inspector regressions |
| Cancelled selected prerequisites and authorized correction | BLOCKED | Unresolved-dependency and real checkbox/save interaction regressions |
| NULL legacy sequencing | BLOCKED | Sequencing, Start Inspector and form regressions |
| Wrong Lead/reviewer, future dates, parent-not-started, self-review denial | BLOCKED | Existing capability/Inspector/review tests and date regressions; installed guard inspection |
| Web ↔ Mobile blocker reporting/clearing while both stay foreground | BLOCKED | Web subscriber invalidation, polling, failure and form synchronization regressions only |
| Completion return, resubmission, approval and parent Task final review | BLOCKED | Lead-review/proposal tests; intercepted smoke verifies direct completion and parent submission only |
| Lost-response recovery without duplicate writes/history | BLOCKED | Direct completion/proposal same-request/evidence retry tests only; persisted history not exercised |

Remaining release gates: repair the independently reproduced repository-test issues under an appropriate scope, then execute the approved authenticated matrix. This delivery does not certify parity or authorize a backend change or deployment.
