# NW7 — Canonical Task Inspector Work section

**Prerequisite:** NW6; use completed NW3 staffing and NW5 editor state.


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


## NW7.1 — Add sections without breaking old origins

**Read/change:** `src/app/features/task-inspector/components/TaskInspector.tsx`, InspectorHeader; `hooks/useTaskInspector.ts`; public index. **NEW:** `src/app/features/task-inspector/types.ts`.

1. Define section IDs overview, work, updates, files, activity, review.
2. Extend TaskInspectorOrigin additively. Keep old details value as supported alias; details maps to Overview, explicit team entry maps to Work. Existing task-ID-only callers remain valid.
3. Use one accessible tab/section navigation model, preserving current header/panel mechanics.
4. Every section change, including keyboard tab navigation, passes requestNavigation. Preserve origin returnFocus/restoreFocus.
5. Keep authorized historical Review view separate from currently allowed approve/request-change actions. No UI section grants review authority.
6. Update three-tab tests to six-section requested design while retaining functional coverage.

**Tests:** workspaceRefinementInspector, phase12InspectorDrafts, phase14InspectorHandoff, inspectorPanel; direct details and new work origins, denied dirty transition, focus return.

## NW7.2 — Extract the Work composition and migrate folded Details

**NEW:** `src/app/features/task-inspector/components/InspectorWork.tsx`.
**Change:** TaskInspector, InspectorTeam, InspectorSummary and tree ownership only as needed.

1. Work receives task/project/readOnly context and NW6's public `WorkTreeController`; displays Task Lead, Contributors, shared hierarchy and Add subitem. The supported-work Inspector owner instantiates `useWorkTree` once and passes it down; InspectorWork and staffing components import only public nested-work exports and start no extra pollers.
2. Reuse NW3/6 public compositions. Avoid loading duplicate snapshot controllers for people and hierarchy.
3. Remove supported-work Head-only shared contributor banner/check. Current capabilities independently gate contributor and Lead appointment actions.
4. Move work/staffing out of folded Details. Overview preserves title/status/priority/dates/Office/dependencies and existing authorized budget details.
5. For unsupported work use the preserved legacy widget/editor adapter; do not broaden supportsNestedWork.
6. AI entry uses NW3 advisory handoff.

**Tests:** shared Task Lead contributor edit, Head own Office oversight, contributor no structural control, Admin readOnly, closed/proposed task locks, failed tree read and legacy fallback.

## NW7.3 — Verify all prior task functions remain reachable

**Read/reuse:** InspectorExecution, InspectorFiles, InspectorEvidence, InspectorProgressUpdates, useInspectorLifecycle; TaskDiscussion, TaskActivityTimeline, TaskReviewPanel and WorkActivity through public APIs.

1. Updates retains start/resume/submit, existing permitted progress, discussion and progress history.
2. Files retains general library and separately protected official evidence access.
3. Activity includes canonical task activity plus delegation events.
4. Review uses existing root Head workflow and current independent review gates; do not apply subitem review resolver to official root review.
5. Preserve readiness, proposed Office execution block, src/app/features/budget/finance separation, archived/oversight state and saved-result refresh behavior.
6. Change caller type unions for new work section only after searching existing details origins; preserve aliases until callers migrate.

**Checks:** common gates and shared inspector/R7/R6 local smoke tests. **Stop:** moving a section would strand evidence, budget, readiness, dependency or lifecycle actions.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/components/workflow/TaskActivityTimeline.tsx`
- `src/app/components/workflow/TaskDiscussion.tsx`
- `src/app/components/workflow/TaskReviewPanel.tsx`
- `src/app/features/nested-work/components/WorkActivity.tsx`
- `src/app/features/nested-work/hooks/useWorkTree.ts`
- `src/app/features/nested-work/index.ts`
- `src/app/features/reviews/components/TaskReviewPanel.tsx`
- `src/app/features/task-inspector/components/InspectorEvidence.tsx`
- `src/app/features/task-inspector/components/InspectorExecution.tsx`
- `src/app/features/task-inspector/components/InspectorFiles.tsx`
- `src/app/features/task-inspector/components/InspectorHeader.tsx`
- `src/app/features/task-inspector/components/InspectorProgressUpdates.tsx`
- `src/app/features/task-inspector/components/InspectorSummary.tsx`
- `src/app/features/task-inspector/components/InspectorTeam.tsx`
- `src/app/features/task-inspector/components/TaskInspector.tsx`
- `src/app/features/task-inspector/hooks/useInspectorLifecycle.ts`
- `src/app/features/task-inspector/hooks/useTaskInspector.ts`
- `src/app/features/task-inspector/index.ts`
- `src/app/shared/navigationGuard.ts`
