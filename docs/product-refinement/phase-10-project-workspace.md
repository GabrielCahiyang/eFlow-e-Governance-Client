# Phase 10 — Project Workspace V2

Status: implementation plan only. Source inspected on 2026-10-06 against shipped baseline `a16d36e`; the attached product brief describes the target, not authorization to implement it. The reported 620-test baseline is historical; this planning task runs no tests and changes no application code.

## Goal and dependencies

Make a project one recognizable object with a consistent identity, view strip, contextual utilities, and settings. Complete Phase 8A's current-to-target mapping, Phase 8B's shared primitives, and Phase 9's global/workspace navigation contract first. Phase 6.5 is a separate functional correction: this phase must work with existing canonical Offices and must not pretend that project-local Office identity has already shipped. Apply the cross-phase dirty-state and confirmation standards now; Phase 17 later audits their coverage.

## Verified current state

| Current entry/module | Findings and implication |
| --- | --- |
| `src/app/features/projects/components/ProjectsWorkspace.tsx` | Opens accessible projects from the context sidebar and auto-opens a requested/first project. Holds portfolio/project/proposal editor state, project creation, planning, lifecycle dialogs, and notification navigation. Preserve those entry paths; do not make the existing large controller larger. |
| `src/app/features/projects/components/ProjectContextSidebar.tsx` | Hosts project selection, planning shortcuts, lifecycle menus, participant summaries, and the restored **Create project** button. **Create work plan** remains absent from this sidebar. Participant labels are not a new authorization source. |
| `src/app/features/projects/components/project-command/ProjectCommandWorkspace.tsx` | Uses canonical project tasks and `useProjectCommandData`; shares filters and a task drawer across views. View selection updates `/projects?page=Projects&project=<id>&view=<view>` and listens to browser history. Current heading is inline title/Office/status/count plus Offices and Readiness shortcuts. |
| `src/app/features/projects/components/project-command/projectViewCatalog.ts` | Permanent views are Main table, Gantt, Overview, Timeline, Calendar; optional views include Board, Offices, Dashboard, reports, reviews, budget, and governance. Target discovery can change, but existing tools and direct view URLs must remain reachable. |
| `src/app/features/projects/components/project-command/ProjectViewTabBar.tsx` and `ProjectViewMenus.tsx` | Project-scoped optional view preferences, portal-based Add view, overflow, keyboard close, and active Board discovery already exist. Retain them. |
| `src/app/features/projects/hooks/useProjectCommandData.ts` | Reuses workflow facts, milestones, members, activity, and task-scoped budget; avoids resetting the canvas on routine refresh. It exposes data errors but no single broad retry operation. Plan retries per failing source, rather than an unsupported generic success claim. |

Graphify questions executed: `ProjectsWorkspace ProjectCommandWorkspace project views table inspector navigation`; `EmployeeMyTasks useMyTasks Inbox task review personal work navigation`. Bounded results identified the above callers, the shell/navigation, and `TaskDetailDrawer`. The local graph predates the latest restoration commit; actual source is the evidence. Before structural implementation use the narrower question `ProjectContextSidebar ProjectHeader ProjectDetail project lifecycle callers`; stop when callers are known and refresh with `npm run graph:update` after moves.

## Target information architecture

Project header: title, visible status, readiness summary, participant summary, optional personal favorite, and an accessible project menu. Main Table, Board, Gantt, Calendar, Dashboard, and Offices are core view destinations over the same project. Retain Overview, Timeline, proposal context, reports, reviews, workload, budget, activity, and governance as deliberate contextual views/tools with compatibility URLs. Put project settings behind the project menu. Invite/share opens the existing permission-aware Office/member context; a copy-link action communicates the link and existing access requirements and never grants access.

## Small implementation slices

1. **Freeze entry/view compatibility.** Add a current-to-target view catalog and explicit aliases using existing tab IDs. Test project links, notification intents, browser back, and optional views before changing labels. Resolve any target retirement through Phase 8A; no hidden loss of tools.
2. **Extract project identity and utilities.** Evolve the existing `ProjectHeader` into focused identity/status/participant pieces under `projects/components/project-command/`; keep `ProjectCommandWorkspace` responsible for composition. Reuse Phase 8B controls. Test title editing denial, long titles, missing Office/profile, closed project, and participant-loading failure. Keep all existing creation controls and the sticky first-column task menu unchanged.
3. **Unify view navigation.** Make the six target views consistently discoverable using the existing tab/menu implementation. Preserve optional-tool preferences, active view, focus restoration, and direct URLs. Test project switching resets filters while preserving project-scoped saved views, unavailable proposal/budget tools, overflow, and return from Board to Main table.
4. **Add a contextual project menu/settings surface.** Wire existing archive/restore/complete/delete dialogs and existing settings only. Expose Readiness as an explained indicator/action. Settings requiring new persistence are omitted pending a separate design. Test capability-denied actions and lifecycle server errors without closing the surface or implying success.
5. **Finish states, guards, and layout.** Apply shared async states and dirty navigation handling to explicit-save forms; preserve the existing autosave flow for inline titles/tasks/subtasks. Inspect the live fixture at desktop and 390px with screenshots after each slice; fix overflow and clipped menus before moving onward.

## Components and data effects

Feature-owned pieces: project identity header, status/readiness trigger, participant summary, project menu/settings adapter, view catalog aliases. Reusable menu, dialog, async feedback, and dirty guard remain in shared UI boundaries. Cross-feature consumers use feature `index.ts` exports, not internal task/Office service paths.

**No database/RLS/business-rule changes.** Continue using project mutation/lifecycle/member services, `project-offices`, `project-readiness`, and canonical tasks; never store copies per view. No API payload or public service return changes. Existing local view preferences remain local. A favorite can be device-local and explicitly personal; durable cross-device favorites, workspace objects, saved shared views, or new settings require a separately reviewed storage/API proposal before implementation. Phase 6.5 schema work is out of this phase.

## Authority, mutation, and state guardrails

Task Lead can staff their own task with eligible responsible-Office/project members and manage its subtasks; they cannot replace the lead, staff another task, invite accounts, or change Responsible Office. Head authority remains within their own Office; Admin is platform oversight and gains no operational powers. Project access is separate from account role; observers stay read-only. Existing `project-offices` selectors and Phase 6 migration/RPC checks remain authoritative.

Program gate **G2**: current shared-project SQL restricts team/assignee updates to the responsible Office Head even though the task-team editor supports contextual Task Lead editing. Do not claim parity or broaden the UI to bypass it; implement the separately reviewed narrow authority compatibility correction before exposing shared-project Task Lead staffing. If Phase 6.5 introduces an unresolved project-local Office, keep its responsibility visible as proposed and disable staffing/execution until canonical identity is linked.

Level 1 title edits show saving/saved/error and allow retry without needless confirmation. Level 2 access/team/Office changes show impact and existing blockers. Level 3 lifecycle/deletion uses existing impact-aware dialogs; preserve deletion's documented retained-task behavior. Guard dirty multi-field forms on close, project switch, route change, and browser back; keep editing/discard choices retain focus and pending data. Autosaved creation does not gain a discard warning. Recheck capabilities after refresh; show server denials inline.

Idle shows current context; loading uses stable skeletons; success confirms the applied action; failure preserves draft/context and identifies the failed operation; retry invokes only that operation; empty distinguishes no project, no tasks, and unavailable data; disabled actions explain role, access, project status, readiness, or blockers and link to an authorized resolution.

## Responsive and accessibility requirements

At 390px use a compact header and overflow utilities, with independently scrolling view/canvas regions and no document overflow. Portals remain outside clipping containers. Every icon has a name, tabs expose selection and keyboard navigation, menu/dialog focus returns to the opener, success uses a polite live region, errors are associated with fields, and status is legible without color. Respect reduced motion and the existing Figtree/teal visual identity.

## Validation, rollback, and done

Extend `tests/unit/projectViewNavigation.test.tsx`, `projectLifecycle.test.tsx`, `projectOfficeAuthority.test.ts`, and `phase03ProjectPresentation.test.tsx`. Required browser paths: `tests/e2e/project-workspace-controls.spec.ts`, `phase3-project-table.spec.ts`, `phase4-project-views.spec.ts`, `phase6-project-offices.spec.ts`, and `phase7-readiness-staffing.spec.ts`; add a focused Phase 10 test for project-menu/settings dirty guards and history. Run `npm run check`, `npm test`, `npm run build`, and affected configured Playwright tests for every slice, then update Graphify after structural edits. Record baseline/final screenshots and capability coverage; do not claim a historical baseline is a new run.

Rollback by reverting the individual UI slice and restoring its prior catalog/composition; retain canonical data and preference keys, tolerate unknown local values, and never roll back user task mutations. Done means cohesive identity/navigation, all legacy workflows reachable, correct per-Office authority, complete states and dirty guards, keyboard/mobile success, and passing gates. Out of scope: new project storage, role redesign, Office identity migration, new sharing permissions, or recreating shipped controls.
