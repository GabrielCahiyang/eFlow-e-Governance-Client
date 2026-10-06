# Phase 11 — Main Table V2

Local implementation: [Phase 11 delivery](phase11-delivery.md) and [compatibility contract](phase11-table-contract.md). G2 and bulk mutation gates remain deferred.

Original plan status: implementation plan only, inspected 2026-10-06 at shipped baseline `a16d36e`. The attached brief supplies target requirements; it does not authorize execution. The previously reported 620 tests are a historical baseline, not tests rerun for this plan.

## Goal and dependencies

Make Main Table the fast, consistent primary project work surface while preserving canonical workflow and staffing authority. Depend on Phase 8A's mutation inventory, Phase 8B's tokens/controls, and Phase 10's project identity/navigation. Apply the cross-phase dirty-state and impact-confirmation contract in every slice; Phase 17 audits completeness. Shared task-inspector work belongs to Phase 12; expose its existing entry point here without building a second drawer.

## Verified current state

| Module | Current behavior / work still needed |
| --- | --- |
| `src/app/features/project-table/components/ProjectTableWorkspace.tsx` | Groups, shared filters, owner/status/search/sort, hidden-column preferences, loading/error/retry, New task/group/import dialogs, and subtask drawer exist. Hidden columns use a project-scoped browser key. Structural edit scope and collaborating-Office staffing scope are separate. |
| `ProjectGroupTable.tsx` in the same directory | Collapsible groups, title/color editing, summaries, column menus, hide/sort, move commands, and **Delete empty group** exist. Default/nonempty group deletion is blocked. It has no selection model or column resizing. |
| `ProjectTaskRow.tsx` | First-column sticky three-dot actions replaced draggable grips; menu retains details, Add subitem, move up/down and group moves. Title/owner/status/priority/planning cells are already editable with restrictions. Add subitem focuses the existing input. Preserve these changes. |
| `InlineCreateRow.tsx` and `SubitemRows.tsx` | Task/subtask titles create on blur, without an Add button; Enter commits, Shift+Enter continues, Escape cancels. In-flight refs prevent double creation and clear the committed draft before refresh. Preserve intra-row focus behavior and refresh-failure messaging. |
| `PlanningCells.tsx` | Number fields autosave on blur; timeline/dependency forms explicitly save and display validation/error/success. Picker consistency and dirty-close guards need improvement. Dependencies have client cycle checks; estimates are not accounting approval. |
| `src/app/features/project-table/selectors.ts`, `types.ts` | Nine optional columns, deterministic manual/title/deadline/priority sort, canonical status restrictions, group summaries, and cycle checks are tested. Manual reorder is restricted when filters/sort/Office scope make the visible subset incomplete. |
| `src/app/features/project-table/services/workspaceService.ts` | Delegates to `phase3_create_task`, `phase3_patch_task`, `phase3_reorder_tasks` and existing group mutations. No new write path is needed for this redesign. |

Graphify question already used: `ProjectsWorkspace ProjectCommandWorkspace project views table inspector navigation`. Follow-up required at implementation: `ProjectTaskRow ProjectGroupTable PlanningCells workspaceService callers` to bound extraction impact; use source as proof because graph predates latest control restoration. Do not query Graphify for CSS-only work.

## Target information architecture and slices

Main Table retains the project view strip/shared filters, a compact table toolbar, grouped task tables, first-column actions, task identity/subitems, and optional planning columns. Task/team/Office controls open contextual pickers or the shared inspector; they do not introduce global sidebar pages.

1. **Stabilize table layout/preferences.** Introduce focused column metadata and preference normalization, then add bounded width resizing, reset widths, and sticky task identity alongside the existing sticky actions. Keep action/task columns always available and measure offsets from effective widths. Namespaced local preferences tolerate bad values/storage failures; switching projects cannot leak widths/hidden columns. Check alignment of group headers, body, summaries, expanded subitems, and first/last visible columns.
2. **Unify search/filter/sort discovery.** Reuse the existing shared `ProjectViewFilters`; add removable chips, clear-one/all, sorting indicators and clear empty-result text. Preserve owner versus team participation semantics; any new contributor filter is distinctly labeled. Keep canonical manual order untouched by sorting, filtering, or resizing. Unit-test composition and stable ties with archived/undated tasks.
3. **Normalize inline editor/picker behavior.** Extract focused presentation cells rather than expanding the long row controller. Adopt Phase 8B person/Office/status/date/dependency controls while retaining existing validators and services. Show saving/saved/error at the cell; retain failed edits for retry, prevent concurrent duplicate writes, and keep dates consistent with the existing canonical timestamp contract. Add explicit-save dirty guards to timeline/dependency forms; do not add them to successful autosave fields.
4. **Expose authorized team work in context after G2.** Add a clearly discoverable Team entry through the shared inspector using the existing task-team editor/service. Current `phase6_guard_task` restricts shared-project team/assignee edits to `eflow_phase6.head`, conflicting with contextual Task Lead staffing. Require program gate **G2**, a separately reviewed narrow authority compatibility correction, before enabling that shared-project action. Test contextual Task Lead staffing of their own task and eligible same-Office/project members, unfinished-subtask removal blockers, Lead protection, and read-only observer/other-Office/Admin access. Head owner appointment remains separate from contributor management; do not widen UI or RLS within this phase to mask the conflict.
5. **Improve groups/row navigation.** Retain empty-only group deletion and explain its blockers. Preserve inline creation and sticky menu focus handoff. Add visible row hover/focus and keyboard edit entry/cancel/commit behavior through semantic table controls; use a full ARIA grid only if its entire navigation contract is implemented/tested. Avoid wrapping tables in conflicting keyboard traps.
6. **Consider selection/bulk actions only after a contract gate.** Start with selection and nonmutating inspect/export actions if justified by Phase 8A. Reuse existing services for any approved safe action, show eligible/excluded row counts and per-row results, and never invent an atomic bulk endpoint or mass status completion. If partial success cannot be represented safely, defer bulk mutation. Finish mobile and keyboard regression evidence before completion.

## Components and data effects

Feature-owned column metadata/preferences hook, resizer, focused cell renderers, filter-chip adapter, optional selection controller, and table state boundary fit under `project-table/`; generic pickers/feedback/confirmation belong under shared UI. Import other features only via their public `index.ts`.

**No database/RLS/business-rule changes.** Preserve current task/group RPC payloads and service returns, authoritative `tasks.org_id`, task lifecycle, assignment services, and actual budget operations. Local widths/density/column visibility are presentation state, not shared schema. Durable shared layouts or atomic bulk writes require a separate migration/API/RLS proposal. No schema migration is part of this phase.

Read authoritative guards before editing: `supabase/migrations/20261004140128_phase3_project_table_workspace.sql` protects group/project/task structure and reorder; `20261004174950_phase6_project_office_collaboration.sql` limits Office handover and own-Office staffing; `20261004182453_phase6_shared_structure_guards.sql` adds shared-work guards; `20260821000006_task_team_removal_guard.sql` enforces unfinished-work removal blockers. These checks must survive changes to UI visibility.

## Guardrails and states

Task Lead can manage eligible contributors/subtasks of their own task, but cannot change Lead or Responsible Office. Head appoints Leads/staffs own Office responsibilities; one Office never selects another Office's people. Project membership/access remains separate from account role, and Admin/Observer oversight stays read-only. AI recommendation remains a proposal requiring existing Head authorization.

Shared-project Task Lead staffing depends on G2; until resolved show an accurate limitation instead of a save path that promises unauthorized success. For Phase 6.5 unresolved project-local Offices, retain proposed responsibility and explain the identity/linking requirement; staffing and execution cannot start before canonical resolution.

Level 1 title/priority/order/ordinary date edits show direct-save feedback; Undo is offered only where an existing safe compensating mutation exists and the record has not changed concurrently. Level 2 owner/team/Office/material-date/dependency changes display the affected responsibility/access/schedule and blockers. Level 3 group deletion uses impact confirmation only for the currently supported empty group; do not expand destructive capability. Preserve drafts on failed saves, route/project switch guards for explicit forms, and current canonical values on denied/stale edits.

Idle cells show readable values; loading preserves geometry; success identifies the saved value; failure stays near the cell with retained draft; retry resubmits only the failed edit; empty distinguishes no group work from filter exclusions; disabled controls have a reason/authorized resolution. If refresh fails after a committed creation, report **Added, could not refresh** and retry refresh without recreating the task.

At 390px scroll the table internally, keep action/task context visible without consuming the entire viewport, and use overlay pickers with touch targets. Resizers have keyboard alternatives and width announcements. Focus rings, field labels/error associations, `scope` headers, expanded-subitem relationships, non-color status, and stable focus after creation/menu close are mandatory.

## Validation, rollback, done

Extend `tests/unit/projectTable.test.ts`, `projectSubitems.test.tsx`, `inlineCreateRow.test.tsx`, `taskTeamEditorDialog.test.tsx`, `taskTeamMembership.test.ts`, `projectOfficeAuthority.test.ts`, and `subtaskAssigneePicker.test.ts`; add preference/resizing/selection tests for extracted logic. Browser paths: `tests/e2e/phase3-project-table.spec.ts`, `project-workspace-controls.spec.ts`, `phase4-project-views.spec.ts`, and `phase6-project-offices.spec.ts`. Add `tests/e2e/phase11-main-table.spec.ts` for resize/hide/reset persistence, horizontal scroll and first-column menus, keyboard saves, failed retry, filters, and capability-specific team actions. Every slice requires `npm run check`, `npm test`, `npm run build`, affected configured Playwright tests and, after structural changes, `npm run graph:update`.

Rollback individual UI slices; ignore/remove only their new local preference namespace if needed, while retaining old column visibility and canonical data. Done means better layout/pickers/navigation with no loss of shipped creation/menu behavior, correct authority and partial-failure handling, complete states, desktop/mobile/a11y evidence, and passing gates. Out of scope: arbitrary lifecycle status edits, reintroducing drag grips/Add buttons, deleting nonempty groups, accounting approval, new shared layout storage, or unapproved bulk endpoints.
