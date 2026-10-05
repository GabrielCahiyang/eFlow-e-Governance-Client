# Phase 4 — Project views

Implemented from Phase 4 of `eFlow_Remaining_Phases_3_to_7_Roadmap.md`, using the supplied Monday.com references for view tabs, shared toolbars, colored Board lanes, calendar pills and compact dashboard widgets. The application remains branded as eFlow.

## Delivered

- Main Table, Gantt, Board, Calendar, Project Dashboard and Offices use the existing canonical project/task records. Search, person, status, Office and sorting filters carry between these views. Updates refresh the other views through the existing task subscriptions.
- Gantt shows recorded start/due dates, dependency arrows, milestones, overdue indicators, date-only markers and the longest dependency chain by recorded duration. Responsible Office Heads can drag, resize or use keyboard/date-dialog edits. Missing dates are never inferred from creation time. The chain highlight does not claim resource-constrained critical-path scheduling.
- Board shows To Do, In Progress, For Review and Completed, with separate revision/cancelled lanes when needed. Permitted start/resume moves save canonical status. Evidence submission, Head review and final completion remain in the existing task/review workflow; dragging cannot bypass them.
- Calendar shows task deadlines, milestones, project start/target and persisted Office review deadlines. Authorized task dragging preserves the recorded duration; keyboard edits use the same date service. Review and milestone cards open the existing context/plan controls. Failed saves revert the drag or retain the date-dialog inputs with an error.
- Project Dashboard summarizes completion, status, Office work, upcoming/overdue deadlines, active assignments and financial utilization. Financial utilization uses approved top-level allocations and settled actual spending, excluding duplicate delegated subtask allocation and planning estimates. Existing dashboard details remain accessible below the new widgets.
- Offices summarizes ownership, total/completed/active/overdue tasks, task details and filtered Main Table drilldown. Mobile layouts contain horizontal Board/Gantt scrolling within their views.
- Existing Main Table, Overview, Timeline planning, task details, evidence, budget, governance and reporting destinations remain available. Gantt and Calendar are in the view tabs; Board, Project Dashboard and Offices can be opened with **Add view**.

## Database and deployment

**No Phase 4 SQL migration is required.** Schedule editing reuses the Phase 3 `phase3_patch_task` RPC already deployed to the main Supabase project, and status changes reuse the existing lifecycle service. No rehearsal database was used and no Phase 4 schema, RLS, gateway or runtime configuration change was introduced.

The implementation and production output are local. Hosted frontend/gateway deployment and real deployed-account acceptance remain release steps; this delivery does not claim that a hosted site was updated.

## Verification

- Full unit suite: **576 passed across 159 files**. Includes 10 Phase 4 selector checks for shared filtering, strict dates, date movement/order, lifecycle protection, dependency chains/cycles and Office summaries.
- TypeScript check and production build passed. Existing build chunk-size/circular-import warnings remain.
- Client secret scan passed against the production output; tracked changes pass the whitespace check.
- Four combined Phase 3/4 browser checks passed: Head creation/table editing, Member table protection at 390px, cross-view filters/status updates, actual Gantt dragging, keyboard resizing, Calendar dragging/date-dialog saving, rejected save handling, Dashboard/Offices and Member view permissions/mobile containment.
- Browser verification uses intercepted synthetic records; no production task/project was created. Calendar review dates without a synthetic originating draft were not exercised against a live Office approval request.
- Local Graphify report, JSON and HTML were refreshed. Five existing barrel-file extraction warnings remain; source stays authoritative.

Screenshots: [Gantt](phase4/screenshots/gantt.png), [Board](phase4/screenshots/board.png), [Calendar](phase4/screenshots/calendar.png), [Dashboard](phase4/screenshots/dashboard.png), [Offices](phase4/screenshots/offices.png), [mobile](phase4/screenshots/gantt-mobile.png).

Repeat the browser checks against the existing local frontend with `EFLOW_E2E_BASE_URL` set to its URL, then run `npx playwright test tests/e2e/phase3-project-table.spec.ts tests/e2e/phase4-project-views.spec.ts --workers=1`.
