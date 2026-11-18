# Web workflow parity implementation — 16 November 2026

> **18 November 2026 status:** The dependency-date integration block recorded below is historical. SELECT-only inspection confirmed that the live Task and Subtask guards now omit the old cross-item date comparisons. See [current alignment and verification](web-mobile-dependency-blocker-alignment-2026-11-18.md). The original receipts below are preserved.

Local Web implementation of `eFlow-Web-Workflow-UX-Dependency-Linking-Handoff-2026-11-16.zip`. The archive was extracted to `handoff-review-2026-11-16/`, outside migration discovery. README, contributor, started-editing, visibility and dependency-review handoffs were read. AGENTS.md and Git state were inspected before editing.

## Implemented behavior

- Task edit forms put access/loading, limited-editing, read-only, save-error and informational notices before the fields. Task and Subtask field controls use the version-1 server detail-edit policy and fail closed when it cannot be verified. Started work permits authorized title/priority corrections; due-date changes need supervisory permission and a trimmed reason of 1–1,000 characters. Planned start, prerequisites and structure remain locked. Review/completed/cancelled restrictions remain authoritative.
- Task project-table saves and nested-work edits recheck current records, actor/scope, capability/policy and revision before writing. Existing server RPCs enforce the final authorization. No alternative database policy was added.
- Task/Subtask Start has a small confirmation before the fresh check/write; Cancel makes no write, duplicate confirmations are blocked, and Task resume from changes requested remains supported. Parent visibility is explained. Account/task switches invalidate an open Task Start action.
- Delete sits beside Edit with existing destructive styling, confirmation and restrictions. Pending refreshes keep last-known authorized nested-work controls visible but disabled, with checking feedback.
- Ordinary reopened nested-work edits load saved values. An open failed save retains typed values. Immutable uncertain requests remain separate; original receipts are checked before retrying a write, including when the record revision or mutation eligibility changed.
- Existing contributor/appointment separation and canonical worker IDs were retained. A Lead is excluded from contributor display/selection without stripping their canonical backend membership.
- Task and Subtask Activity renders committed metadata deltas and recorded schedule reasons. It does not reconstruct a before value from current work. Existing author/proposal/application distinctions remain.
- Specific legacy cross-item date-link rejections explain that the backend update is needed and the selection has not been saved. Child timeline conflicts say `Ask the appointed Task Lead to reschedule “<name>” first.` Own-date bounds are retained.
- Existing pickers already allow overlapping/undated prerequisites; they were preserved. Execution still requires ALL prerequisites completed, with cancelled/missing prerequisites unresolved. `null` legacy sequencing remains distinct from explicit `[]` independence.

## Changed source files

Paths are repository-relative. This inventory covers this implementation; concurrent unrelated changes are excluded.

| Area | Exact files |
| --- | --- |
| Task field policy and writes | `src/app/features/tasks/services/taskDetailEditService.ts` (new), `services/taskService.ts`, `services/taskMutationService.ts`, `components/board/TaskEditorModal.tsx`, `components/board/useMondayBoardController.ts`, `index.ts` |
| Task Activity | `src/app/features/tasks/selectors/taskActivityDetails.ts` (new), `services/taskActivityService.ts`, `taskTypes.ts`, `components/board/TaskActivityHistoryView.tsx`, `src/app/components/workflow/TaskActivityTimeline.tsx` |
| Task Start/Delete | `src/app/features/task-inspector/hooks/useInspectorLifecycle.ts`, `components/TaskInspector.tsx`, `src/app/features/tasks/components/board/TaskManagementMenu.tsx` |
| Project-table Task edits | `src/app/features/project-table/components/ProjectTaskEditDialog.tsx`, `TimelineCell.tsx`, `ProjectTaskRow.tsx`, `ProjectTableWorkspace.tsx`, `services/workspaceService.ts`, `types.ts` |
| Subtask Start | `src/app/features/subtasks/components/SubitemStartPanel.tsx`, `SubitemInspector.tsx` |
| Nested-work editor policy | `src/app/features/nested-work/selectors/detailEditing.ts` (new), `selectors/editorDraft.ts`, `components/WorkDetailsEditor.tsx`, `WorkTreeEditor.tsx`, `WorkNodeTimelineCell.tsx`, `WorkTreeTable.tsx`, `hooks/useWorkEditorDraft.ts`, `types.ts`, `types/editor.ts` |
| Nested-work pending/staffing/recovery | `src/app/features/nested-work/components/WorkHierarchy.tsx`, `WorkRootOwner.tsx`, `WorkStaffingDialog.tsx`, `WorkTree.tsx`, `hooks/useWorkDraftRecovery.ts`, `services/workDraftStore.ts` |
| Nested Activity and error handling | `src/app/features/nested-work/selectors/workEventPresentation.ts`, `services/workRequestOutcome.ts`, `src/app/shared/prerequisiteLinkingError.ts` (new), `workTimelineError.ts` (new) |

## Regression files

New regressions: `tests/unit/nestedWorkDetailEditing.test.ts`, `workDetailsEditorPolicy.test.tsx`, `workDetailEditingPolicy.test.ts`, `workNodeTimelineCell.test.tsx`, `taskDetailEditService.test.ts`, `taskActivityDetails.test.ts`, `taskInspectorStartConfirmation.test.tsx`, `subitemStartConfirmation.test.tsx`, `workEventPresentation.test.ts`, `prerequisiteLinkingError.test.ts`, `workTimelineError.test.ts`.

Existing fixtures/expectations updated for the new field policy, fresh reads, confirmation, saved-value reopen and receipt-first retry: `nestedWorkAdvisoryAppointment`, `nestedWorkCommandForms`, `nestedWorkDraftRecovery`, `nestedWorkEditorDraft`, `nestedWorkLegacyBoundaries`, `nestedWorkRequestRecovery`, `nestedWorkStaffing`, `nestedWorkTableEntrances`, `subitemInspector`, `taskEditorSave`, `taskTeamEditorDialog`, `workspaceRefinementHierarchy`, `inspectorLifecycleRetention`, `taskDueDates` unit files; `tests/e2e/fixtures/nestedWorkStaffing.ts` supplies synthetic field policy. These fixtures do not create hosted data.

## Existing RPCs and errors

Task policy read: `work_detail_edit_state(p_task_id, p_node_id: null)`; nested policy: `r7_work_tree` node `detail_edit`. Task detail writes retain `edit_selected_project_task` / `phase3_patch_task`, with `p_patch.change_reason` for started due changes. Task Start retains `transition_task_status`. Nested work retains its checked command/impact/receipt services and original request IDs; no API or public service return shape was replaced.

The upgrade explanation only matches the two known obsolete date-link errors: `The subtask starts before a prerequisite is due. Adjust the schedule first.` and `Task start date is earlier than a prerequisite due date. Adjust the schedule first.` Other authorization, own-timeline and server errors are preserved. The child message mapper only matches `Reschedule subtask "<name>" before changing this timeline.`

## Verification and acceptance

| Check | Result |
| --- | --- |
| TypeScript `npm.cmd run check` | PASS |
| Production build `npm.cmd run build` | PASS; existing large-chunk warning |
| Dependency/schedule/Start/nested regressions | PASS: 209 tests across 14 files |
| Root staffing, hierarchy, policy and error regressions | PASS: 55 tests across 5 files |
| Final Task policy/Activity/Start/resume/editor/legacy boundaries/project-table/date checks | PASS: 66 tests across 9 files; the batch completed before the request to stop testing was processed |
| Additional nested editor/recovery suites | PASS; exact counts in verification note |
| Full `npm.cmd test -- --maxWorkers=2` | FAIL / incomplete: failures observed, then stalled without final summary; interrupted. No full-suite pass claimed. |
| Separate outside-scope regression audit | FAIL: 41 passed / 12 failed across 9 files; exact assertions in verification note |
| Chromium browser checks | BLOCKED: four tests could not launch because the Playwright Chromium executable is absent |
| Graph update | BLOCKED: local Graphify setup/map missing; source searches used |
| Authenticated roles/RLS, concurrent sessions, Web–Mobile acceptance | BLOCKED / NOT RUN: no approved authenticated fixtures or staging mutations |

Detailed evidence: [verification note](web-workflow-parity-2026-11-16-verification.md) and [dependency review](web-workflow-dependency-review-2026-11-16.md). Logs are under `.codex-tmp/workflow-parity/` (local, ignored).

## Backend and workspace boundaries

No migration was applied or changed, no deployment/push was performed, and no production data, live fixtures, RLS, grants or migration timestamps were modified. Hosted target remains `ixnfphgjyelhckjwjkdv`. The pending dependency correction is still review-only and unapplied. Its raw hashes and normalized single-anchor guards remain intact. Disposable local PGlite verification exercised 44 LF and 44 CRLF assertions; that does not certify the hosted baseline, RLS or concurrency. Coordinated reviewed backend installation and authenticated acceptance remain required for end-to-end date-neutral saves.

The initial tracked checkout was clean on `main`; the preexisting ZIP and `New Text Document.txt` were retained. Unrelated project-command, project view/filter, project setup and navigation work appeared concurrently and was preserved. Their changes are not part of this implementation inventory or a claim of passing acceptance.
