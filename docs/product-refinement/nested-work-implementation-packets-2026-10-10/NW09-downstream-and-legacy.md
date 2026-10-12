# NW9 — My Work, reporting, notifications, activity and legacy integration

**Prerequisite:** NW2–NW8 implemented prerequisite outputs/checks. Accept NW8's Inspector/Activity shell while final event presentation remains open for NW9.6; close that integration before NW10. Execute independent downstream slices separately.


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


## NW9.1 — Add narrow authorized context adapters

**Read/change:** `src/app/features/nested-work/types.ts`, `src/app/features/nested-work/index.ts`, `src/app/services/subtaskService.ts` (`Subtask/rowToSubtask`), `src/app/features/subtasks/types.ts`, and `src/app/features/personal-work/types.ts`.

1. Reuse the people selectors from NW3 and display-tree/path selectors from NW6 through the nested-work public API. Do not build a second hierarchy or infer parenthood from title/order.
2. Preserve the different existing records: WorkNode uses `parent_subtask_id`; Subtask exposes `parentSubtaskId`; submissions and personal WorkRow have their own contracts.
3. Add only optional, authorized display metadata where needed: node ID, parent ID, full permitted path, explicit Lead/name and node due date. Preserve old fields and return values.
4. When a workflow needs full Subtask data, load/merge its existing authorized record. Never cast WorkNode to Subtask: WorkNode does not supply every history/timestamp/workflow field.
5. Keep path creation bounded to the already authorized root/subtree. A hidden ancestor must not leak its title or become a reason to grant root access.

**Tests:** add focused adapter cases to the existing nested-work and personal-work selector suites: duplicate titles, depth 8, missing/denied ancestor, explicit Lead absent from compatibility workers, legacy record without optional metadata.

**Done when:** downstream tasks can consume one canonical path/people model without importing another feature's internals.

## NW9.2 — Make deep assigned work discoverable in My Work

**Read/change under `src/app/features/personal-work/`:** `services/workFeedService.ts:loadWorkFeed`; `services/officeWorkRows.ts:appendOfficeRows`; `services/personalWorkSource.ts:appendPersonalRows`; `services/workSourceReads.ts:readWorkTable/settledMap`; `workSelectors.ts:selectWorkRows/workspaceSummary`; `hooks/useWorkFeed.ts`; `components/WorkList.tsx`; `components/WorkInspector.tsx:useWorkInspector/WorkInspector`.
**Read:** `src/app/features/nested-work/services/workTreeService.ts:fetchOfficeWorkRoots/fetchPersonalWorkRoots`.

1. Include the actor's assigned nested items and own appointed Lead work, including Lead-only rows absent from worker arrays. Enumeration must use authorized sources.
2. Populate NW9.1 path/people metadata. Replace technical Depth presentation with Task → ancestor → Subitem path; make displayed path searchable using existing filter conventions.
3. Use the item's due date, explicit Lead and contributor count. Preserve Mine/Leading filters, source error handling, refresh/subscription behavior and list counts.
4. Opening a row selects its canonical ID in NW8's Inspector through public exports. Separate execute, review and budget controls as already defined there.
5. Do not promote a deep assignee to root management or show unauthorized sibling branches. Preserve personal-work legacy operations.

**Tests:** `tests/unit/workspaceRefinementWork.test.ts`, `workspaceRefinementWorkRefresh.test.tsx`, `phase13PersonalWork.test.ts`; affected `tests/e2e/workspace-refinement-r10.spec.ts` and `phase13-personal-work.spec.ts`. Include depth-8 discovery, Lead-only execution, searchable path, distinct due dates, denied source and access revoked while open.

## NW9.3 — Correct report attribution and preserve financial totals

**Read/change:**
- `src/app/features/team-management/services/teamWorkflowFactsService.ts:fetchTeamWorkflowFacts/subscribeToTeamWorkflowFacts` and its local `toSubmission`.
- `src/app/features/reports/selectors/workReportRows.ts:buildContributionRows/buildOperationRows/buildProjectRows`; `workflowReportRows.ts:subtaskPath/buildReviewRows/buildEvidenceRows/buildRiskRows/buildLifecycleRows`; `departmentReportSelectors.ts:buildDepartmentReportRows/filterDepartmentReportRows`; `src/app/features/reports/exportColumns.ts:departmentReportColumns`.
- `src/app/features/projects/selectors/projectFinancialReportSelectors.ts:buildProjectExecutionFinancialRows/subtaskReportPath/orderedSubtasks`; `projectReportScope.ts:selectProjectReportScope`; `projectReportColumns.ts:COLUMNS`.
- `src/app/features/projects/components/project-command/ProjectReportsTab.tsx` and `ProjectReportRegisters.tsx:ExecutionRow/ReceiptRegister`.

1. Replace local duplicate path/people algorithms with public NW9.1 adapters where their data scope permits.
2. Attribute appointed Lead plus distinct contributors once each, including Lead absent from worker arrays. Preserve original authors of recorded work and evidence.
3. Display item due date and full authorized path in onscreen rows and CSV/PDF exports. Resolve names through the permitted report scope.
4. Separate pending reviewer assignment from actual recorded decision actor. The current local `toSubmission` prefers `reviewer_id` over `decided_by`; do not relabel that preference as actual historical decision authorship. Add an explicit decision-author field if required while preserving old payload semantics.
5. Retain all existing filters, approval/readiness/finance scope, column formatting and export checks. Do not double-count root/manual budgets or cash entries.

**Tests:** `tests/unit/projectFinancialReport.test.ts`, `departmentReports.test.ts`, `workspaceRefinementR11Reports.test.ts`, and affected R11 E2E. Preserve monetary/root-progress/receipt totals; contribution row counts must equal the reviewed unique Lead-plus-contributor set, including intentionally restored Lead-only rows; onscreen/export rows must match; test changed reviewer, deep duplicate-title paths and Lead deduplication.

## NW9.4 — Refresh review queue context and historical attribution

**Read/change:** `src/app/features/subtasks/services/subtaskWorkflowService.ts` (`readPendingSubtaskReviews/mapSubmission/fetchPendingSubtaskReviews/fetchPersonalSubtaskReviews/subscribeToPendingSubtaskReviews/decideSubtaskReview/fetchSubtaskSubmissions/getSubtaskEvidenceUrl`); `src/app/features/subtasks/types.ts`; `src/app/features/reviews/components/SubtaskReviewInbox.tsx`; `src/app/features/reviews/components/TaskSubtaskEvidenceSection.tsx:contributorNames`; `src/app/features/subtasks/components/SubtaskSubmissionHistory.tsx`.

1. Add batched authorized path/people context to queue records. Avoid one unconstrained parent read per row.
2. Consume NW4's current server-selected reviewer; reuse NW8's review detail presentation.
3. Show pending reviewer and historical decision author separately. A Lead transfer changes eligible pending review without rewriting old decisions.
4. Preserve canonical submission/node IDs, queues, evidence reads, expiry and subscriptions. Actor/reviewer changes cannot silently erase draft feedback or expose protected evidence.

**Tests:** the existing reviewer/history/inbox suites and NW8's new review-detail tests, plus correction SQL scenarios: own Lead first, self-submitting Lead skipped, changed appointment, parent fallback and personal reviewer unchanged.

## NW9.5 — Keep notifications opening the canonical item

**Read/change:** `src/app/services/notificationService.ts:Notification`; `src/app/features/notifications/navigation.ts:resolveNotificationDestination/NotificationNavigationIntent`; `navigationIntent.ts:queueNotificationNavigationIntent/peekNotificationNavigationIntent/completeNotificationNavigationIntent/subscribeToNotificationNavigationIntent`; `hooks/useNotificationNavigationIntent.ts`; `src/app/components/workflow/SubtasksWorkspace.tsx`.

1. Preserve `work_node_id → workNodeId → entityId` through notification mapping and navigation intent.
2. Focus the NW8 Inspector by canonical ID and correct origin/section, including a deeply nested item with a duplicate title.
3. Retain legacy label fallback only where required. Handle ambiguous labels explicitly; never choose an arbitrary first match.
4. Preserve finance destinations, read receipts, pending-intent lifecycle and revoked-access behavior. Do not create a new reminder scheduler.

**Tests:** `tests/unit/notificationNavigation.test.ts`, `notificationBellNavigation.test.ts`, `notificationPresentation.test.ts`, affected personal-work/notification E2E; include deep link after reload, duplicate title, missing item and lost access.

## NW9.6 — Present nested work activity in human terms

**Read/change:** `src/app/features/nested-work/components/WorkActivity.tsx` and `services/workTreeService.ts:fetchWorkEvents`; `src/app/features/projects/activity/activityService.ts:fetchActivityPage/fetchActivityPrint`, `types.ts`, `activityPrint.ts:formatActivityTime/buildActivityPrint`, `useActivityPage.ts`; `src/app/features/projects/components/project-command/ProjectActivityTab.tsx:ProjectActivityTab/ProjectActivityHistory`.
**NEW:** `src/app/features/nested-work/selectors/workEventPresentation.ts`, exported through its public index; `tests/unit/nestedWorkEventPresentation.test.ts`.

1. Translate existing commands into readable staffing, transfer, details, move, order and delete descriptions.
2. Use event before/after snapshots for historical path and people changes. Current tree position cannot explain a deleted/moved item's former path.
3. Show actor/time and meaningful changed fields without raw command keys as product copy.
4. Preserve the existing 25-row paging/cursor contract and authorized event scope.
5. R11's existing event projection maps work events into existing event kinds. Do not invent an incompatible fifth kind.
6. Complete NW8's focused Subitem Activity integration here using the shared presenter and authorized before/after paths; verify unrelated events stay out of its scoped view.
7. If printable project activity lacks required event metadata, make that a separately reviewed additive projection/migration slice. Preserve existing fields/kinds and bounded reads; do not fetch an entire event table client-side to compensate.

**Tests:** `tests/unit/workspaceRefinementR11Activity.test.tsx`, `workspaceRefinementActivity.test.tsx`, `workspaceRefinementR12AuditRefresh.test.tsx`, new presenter tests, affected R11 E2E and `npm.cmd run verify:r11-activity`. Include deleted item, moved ancestor, old/new Lead, ordering and pagination.

## NW9.7 — Preserve excluded and legacy entry points

**Read/change only proven callers:** TaskSubtasksWidget/its Legacy component, SubitemRows/its Legacy component, project-table openSubitem, InspectorTeam, `src/app/features/tasks/components/board/TaskEditorModal.tsx`, `src/app/components/workflow/SubtasksWorkspace.tsx`, useTaskSubtasks and `src/app/services/subtaskService.ts` create/batch/update/delete/due/order/cache/subscriptions.
**Read:** `src/app/features/project-import/services/projectImportService.ts:importReviewedProject/importReviewedProjectWithOffices`; `src/app/features/work-templates/services/subtaskTemplateService.ts:saveSubtaskTemplate/applySubtaskTemplate`; `src/app/features/work-templates/types.ts:SubtaskTemplateItem`.

1. Route supported callers through the canonical hierarchy/staffing/Inspector public APIs. Preserve caller readOnly, project locks, prerequisites and callbacks.
2. Keep `supportsNestedWork` exclusions. Legacy fallback is for proven missing installation (`WorkTreeUnavailable`/the checked missing-RPC case), never permission denial, access expiry or ordinary save failure.
3. Preserve flat import/template contracts and their explicit rejection of unsupported nesting. Do not silently strip parentage or flatten accepted work.
4. Search actual consumers before removing any compatibility export. Keep legacy service functions until zero consumers are proven.
5. Use focused Graphify/source searches for boundary callers; refresh the map only after actual structural edits.

**Tests:** `tests/unit/phase12SubtaskScope.test.tsx`, subtask sequencing/hierarchy and import/template suites; affected `phase12-shared-inspector.spec.ts`, `phase13-personal-work.spec.ts`, `phase5-project-import.spec.ts` and R7 E2E.

**Stop for this phase:** a downstream change requires broader visibility, changed financial totals, rewritten historical authorship, weakened personal review or a denied operation becoming a legacy fallback.


## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/components/workflow/SubtasksWorkspace.tsx`
- `src/app/components/workflow/TaskSubtasksWidget.tsx`
- `src/app/features/nested-work/components/WorkActivity.tsx`
- `src/app/features/nested-work/index.ts`
- `src/app/features/nested-work/services/workTreeService.ts`
- `src/app/features/nested-work/types.ts`
- `src/app/features/notifications/hooks/useNotificationNavigationIntent.ts`
- `src/app/features/notifications/navigation.ts`
- `src/app/features/notifications/navigationIntent.ts`
- `src/app/features/personal-work/components/WorkInspector.tsx`
- `src/app/features/personal-work/components/WorkList.tsx`
- `src/app/features/personal-work/hooks/useWorkFeed.ts`
- `src/app/features/personal-work/services/officeWorkRows.ts`
- `src/app/features/personal-work/services/personalWorkSource.ts`
- `src/app/features/personal-work/services/workFeedService.ts`
- `src/app/features/personal-work/services/workSourceReads.ts`
- `src/app/features/personal-work/types.ts`
- `src/app/features/personal-work/workSelectors.ts`
- `src/app/features/project-import/services/projectImportService.ts`
- `src/app/features/project-table/components/SubitemRows.tsx`
- `src/app/features/projects/activity/activityPrint.ts`
- `src/app/features/projects/activity/activityService.ts`
- `src/app/features/projects/activity/useActivityPage.ts`
- `src/app/features/projects/components/project-command/ProjectActivityTab.tsx`
- `src/app/features/projects/components/project-command/ProjectReportRegisters.tsx`
- `src/app/features/projects/components/project-command/ProjectReportsTab.tsx`
- `src/app/features/projects/selectors/projectFinancialReportSelectors.ts`
- `src/app/features/projects/selectors/projectReportColumns.ts`
- `src/app/features/projects/selectors/projectReportScope.ts`
- `src/app/features/reports/exportColumns.ts`
- `src/app/features/reports/selectors/departmentReportSelectors.ts`
- `src/app/features/reports/selectors/workReportRows.ts`
- `src/app/features/reports/selectors/workflowReportRows.ts`
- `src/app/features/reviews/components/SubtaskReviewInbox.tsx`
- `src/app/features/reviews/components/TaskSubtaskEvidenceSection.tsx`
- `src/app/features/subtasks/components/SubtaskSubmissionHistory.tsx`
- `src/app/features/subtasks/components/TaskSubtasksWidget.tsx`
- `src/app/features/subtasks/hooks/useTaskSubtasks.ts`
- `src/app/features/subtasks/services/subtaskWorkflowService.ts`
- `src/app/features/subtasks/types.ts`
- `src/app/features/task-inspector/components/InspectorTeam.tsx`
- `src/app/features/tasks/components/board/TaskEditorModal.tsx`
- `src/app/features/work-templates/services/subtaskTemplateService.ts`
- `src/app/features/work-templates/types.ts`
- `src/app/features/workspaces/navigation.ts`
- `src/app/services/notificationService.ts`
- `src/app/services/subtaskService.ts`
- `tests/e2e/phase12-shared-inspector.spec.ts`
- `tests/e2e/phase13-personal-work.spec.ts`
- `tests/e2e/phase5-project-import.spec.ts`
- `tests/e2e/workspace-refinement-r10.spec.ts`
- `tests/unit/departmentReports.test.ts`
- `tests/unit/notificationBellNavigation.test.ts`
- `tests/unit/notificationNavigation.test.ts`
- `tests/unit/notificationPresentation.test.ts`
- `tests/unit/officeIdentityImport.test.ts`
- `tests/unit/phase12SubtaskScope.test.tsx`
- `tests/unit/phase13PersonalWork.test.ts`
- `tests/unit/phase15ImportSafety.test.tsx`
- `tests/unit/projectFinancialReport.test.ts`
- `tests/unit/subtaskSequencing.test.ts`
- `tests/unit/subtaskTemplateSafety.test.ts`
- `tests/unit/workspaceRefinementActivity.test.tsx`
- `tests/unit/workspaceRefinementR11Activity.test.tsx`
- `tests/unit/workspaceRefinementR11Reports.test.ts`
- `tests/unit/workspaceRefinementR12AuditRefresh.test.tsx`
- `tests/unit/workspaceRefinementWork.test.ts`
- `tests/unit/workspaceRefinementWorkRefresh.test.tsx`

