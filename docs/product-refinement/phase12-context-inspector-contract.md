# Phase 12 — Shared project context and inspector contract

Implemented locally on 6 October 2026. This extends the Phase 11 table contract; canonical task, Office, review, subtask and financial service payloads remain unchanged.

## Shared views

Main Table, Board, Gantt, Calendar, Dashboard and Offices consume the same search, appointed owner, status, Office, sort and inclusive schedule-overlap date range. Undated/inverted schedules are excluded only when a date range is active. Due-only tasks are points. Clearing filters retains the selected sort. The table keeps the complete canonical collection for group deletion and other structural checks; a filtered display cannot make nonempty groups appear deletable.

`scopeProjectViewData` scopes tasks, subtasks, progress, submissions, status history, evidence, attention, metrics and financial records using the same task IDs. Financial records remain approved allocations, releases, requests and settled spending; planning estimates do not become spending. Office management stays separate from visual Office summaries. Office drill-down applies its filter and changes to Main Table in one guarded navigation action.

Personal presentation uses `eflow_project_views_v1_<userId>_<projectId>` for filters, plus `:gantt-scale` and `:calendar-mode`. Malformed values, unknown statuses/sorts/modes, inverted ranges and blocked storage fall back safely. These browser-local preferences do not create shared saved views, cross-device storage or task records. Existing project tab/layout keys remain compatible.

## Inspector API and sections

New callers import `TaskInspector` or the compatibility name `TaskDetailDrawer` from `src/app/features/task-inspector/index.ts`. Project views use `useTaskInspector(scope)` with canonical task ID and an origin containing view, return-focus element and an optional resolver for refreshed source elements. Selection contains no copied task records. A missing/reassigned/restricted canonical task shows an unavailable-access panel; null selection renders nothing.

Overview composes description, completion standards, dependencies, progress, budget, team, subtasks and existing lifecycle/submission controls. Activity, Discussion and Evidence are discoverable sections. Review appears only in its current requested capability/status scope; the review feature independently checks reviewer identity and preserves cash clearance and routing. Rich submission notes are sanitized in both overview and shared evidence/review display. Error/loading/retry is distinct from empty evidence, discussion and activity.

The old workflow drawer path and the tasks feature alias remain compatibility exports. Internal callers now use the inspector feature's public API. Existing domain service operations, Task Lead subtask rules, review readiness, unfinished-subtask removal blockers and financial permissions remain intact. No generic management flag grants additional authority.

Read-only account/Office/project scope and unresolved proposed Office responsibility suppress operations. Shared-project non-Head Task Leads cannot edit task teams: the separate G2 authority correction remains unresolved. Outside a project provider, the inspector loads existing Office context; inside one, it reuses that context. Realtime channel instances use distinct names, and late Office/subtask/discussion results cannot populate a changed scope.

## Drafts, saves and focus

Discussion, progress, submission evidence, review decisions, task dates and task team drafts register with the existing navigation guard. Close, section change, task/project navigation and browser back keep drafts unless the user accepts discard. Pending checks use synchronous refs, blocking duplicate requests and conflicting navigation. Explicit form controls cannot change their captured draft during submission. Failed writes retain drafts; team changes also reject a remotely changed membership baseline.

Team saves use a shared impact confirmation, preserve the lead and unfinished-work checks, and retain server denials. Comment moderation uses a reason dialog and preserves audit history. Start/resume errors appear in the inspector rather than browser alerts.

Board retains canonical transition RPCs, drag denial feedback, and keyboard/touch Start/Resume alternatives. Evidence submission, completion and revision decisions cannot be shortcut by lane movement. Gantt and Calendar reuse the canonical date patch service and responsible-Office Head rules. Date forms protect dirty dismissal; established schedule changes show their before/after impact, including dependent dates not being automatically moved. The brief supplies no numeric materiality threshold, so every change to an established schedule receives Level 2 confirmation. New previously undated schedules remain direct. Recorded time/offset suffixes are preserved across date moves and resizing.

Inspectors trap focus, return it to the originating control (or its refreshed equivalent), respect nested dialogs and Escape, and contain their scroll regions at 390px. Tabs use labeled, roving keyboard controls with horizontal containment when needed.

## Verification boundary

See `phase12-delivery.md` and `phase12-evidence/evidence.json` for actual receipts. Browser tests run the real frontend on port 5173 with synthetic intercepted auth/REST/gateway/realtime records; they are not a deployed RLS audit. Database schemas, policies, Python endpoints, API payloads and existing service return values were not changed in this phase. The optional discussion error callback and strict local reader retain the original array/unsubscribe contracts. Native zoom and assistive-technology sessions were not run. Prior phase evidence is preserved.
