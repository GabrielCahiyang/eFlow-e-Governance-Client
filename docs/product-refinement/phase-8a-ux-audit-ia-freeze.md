# Phase 8A — UX Audit and Information Architecture Freeze

## Goal and dependencies

Produce an evidence-backed current product inventory and approve where each existing workflow belongs before changing navigation or visual structure. This phase produces audit artifacts and decisions; it does not redesign screens or remove functionality.

Baseline: Phase 1–7 and commit `a16d36e`, including the restored **Create project** sidebar action, absent **Create work plan** sidebar action, sticky first-column task actions, inline task/subitem creation on blur, working Add view, and Board → Main table return. The reported baseline is 620 unit tests; re-establish the actual counts and results at implementation kickoff rather than treating that historical result as a current execution.

Phase 6.5 is a separate functional correction. If postponed, record the existing canonical Office limitation and avoid making a global Office directory link a permanent navigation assumption. Phase 8B and Phase 9 depend on this phase's IA decisions. Later phases consume the role, action, mutation, and component inventories rather than re-inventing them.

## Current-state evidence

| Finding | Source and consequence |
| --- | --- |
| The shell derives role destinations, checks permissions, adds contextual Task Lead destinations, derives alert badges, and owns mobile navigation. | `src/app/features/app-shell/EflowAppShell.tsx`. Treat these behaviors as separate compatibility contracts when designing a new shell. |
| The workspace label is derived from the user's `org_id`/`departmentId`; it is not evidence of a selectable or persisted workspace entity. | `src/app/features/app-shell/EflowAppShell.tsx`. Workspace creation/selection, folders, and shared dashboards need explicit capability discovery and product decisions. |
| A compact desktop rail expands on hover or keyboard focus; mobile renders the same destinations in a Vibe modal. | `src/app/features/app-shell/components/ProductivitySidebar.tsx`, `src/app/features/app-shell/eflowAppShell.css`. Audit compact, expanded, and mobile states separately. |
| Four active account roles are registered; the contextual Task Lead is not another account role. | `src/app/components/Layout/coreWorkflowNavigation.tsx`, `src/app/features/navigation/roleNavigation.tsx`, `src/app/features/navigation/RoleContent.tsx`. Legacy prototype manifests must be marked separately from reachable current screens. |
| Navigation permission checks exist in both visible destination construction and content resolution. Additional administrative destinations can be offered to non-Admin roles with explicit account-support permissions. | `src/app/features/navigation/navigationPermissions.ts`, `src/app/features/navigation/RoleContent.tsx`. A target role matrix cannot replace individual permissions. |
| Readable section paths, `page`, project invitation query context, aliases, and browser history are existing contracts. | `src/app/features/navigation/navigationUrl.ts`, `src/app/features/navigation/useRoleNavigationState.ts`. Keep a URL compatibility column in every mapping. |
| Task/Project views and personal work already share some data and compatibility aliases, but the proposed unified global Inbox/Search/Workspaces are not established by the shell. | `src/app/features/role-head/HeadContent.tsx`, `src/app/components/Member/MemberContent.tsx`, `src/app/features/projects/components/ProjectsWorkspace.tsx`. Distinguish current screens, future regrouping, and genuinely new capabilities. |
| Shared UI already includes Vibe adapters and Radix workspace controls. | `src/app/components/ui/Modal.tsx`, `DataTable.tsx`, `FeatureDialog.tsx`, `workspace/`, `src/app/shared/vibe/`. Inventory these before proposing new primitives. |
| Global style compatibility rules remap neutrals, hide all scrollbars, and force Vibe menu/dialog internals to fixed positioning at z-index 9999. | `src/styles/globals.css`. Record owners and consumers before staged cleanup in 8B. |
| The current navigation lock prevents navigation during temporary operations; it does not implement form dirty/discard handling. | `src/app/shared/navigationLock.ts`, `src/app/features/navigation/useRoleNavigationState.ts`. Mark unsaved-change protection as an audit finding, not a capability already provided. |
| Source authority conflicts with the intended Task Lead team model for shared projects. | **Gate G2:** `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql` (`phase6_guard_task`) requires the responsible Office Head for changes to assignee/lead/team IDs. `20261004182453_phase6_shared_structure_guards.sql` adjusts identity/move handling without lifting that staffing restriction. `src/app/features/tasks/services/taskTeamService.ts` saves contributors through task mutation. Record intended versus enforced source behavior separately; deployed behavior has not been audited. |

### Current role × navigation seed

These are candidate destinations from source, not a guarantee that every account can open them. Apply `canOpenNavigationSection`, individual permission grants, and leading-work visibility for the effective matrix.

| Account role | Registered defaults and destinations |
| --- | --- |
| Admin | Default `users`; User Management subpages include All Users, Role Defaults, User Access, Office Structure, Account Audit, System Settings, Backup & Export. |
| Head | Default `dashboard`; Overview, Projects, Tasks, Office Budget, Work I'm Leading, My Subtasks, Reviews, Office Team, Identity & Access, Team Intelligence, Reports, Announcements. Leadership is contextual; Identity & Access requires persisted Head. |
| Member | Default `tasks`; My Tasks, Projects, Work I'm Leading, My Subtasks, Leader Reviews, Deadlines, Task History, Performance, Work Report, Announcements. Leading/Leader Reviews require visible leading work. |
| Accounting Staff | Default `accounting_overview`; Member destinations plus Accounting Overview, Voucher & Cash Releases, General Journal, Financial Audit Trail, Office Budget Ledgers. |

## Source modules and test anchors

Inspect `src/app/features/navigation/roleNavigation.tsx`, `sidebarContent.tsx`, `navigationPermissions.ts`, `navigationUrl.ts`, `useRoleNavigationState.ts`, and `RoleContent.tsx`; `src/app/components/Layout/coreWorkflowNavigation.tsx`; role route manifests; and each feature's `index.ts` public entry before following a screen's implementation. Audit top-bar profile/settings, notifications, chat/calls, onboarding, guided tours, invitation startup, and session-security flows as well as sidebar pages.

Relevant tests: `tests/unit/navigation.test.ts`, `navigationUrl.test.ts`, `accountingRoleNavigation.test.tsx`, `phase02MobileNavigation.test.tsx`, `navigationActionAlerts.test.ts`, `workspaceFoundation.test.tsx`, `sharedUiVibeAdapters.test.tsx`, `projectViewNavigation.test.tsx`, `projectLifecycle.test.tsx`, `inlineCreateRow.test.tsx`, `projectSubitems.test.tsx`; existing browser specs in `tests/e2e/` cover navigation, authority, invitations, table/views/import/Offices/readiness and Admin dialogs.

## Graphify navigation

Used: `npm run graph:query -- "EflowAppShell RoleContent navigation sidebar role visibility shared UI"`. The bounded result identified the shell, navigation, role content, AuthContext, and shared adapters. Stop querying those paths now that actual files are known. The local graph has 6,846 nodes, is stamped before the latest small UI restoration, and has six known parser warnings; source remains authoritative.

For audit areas not yet mapped, use one bounded question at a time, for example `npm run graph:query -- "TaskDetailDrawer callers review evidence team capability propagation"` or `npm run graph:query -- "OfficeTeamWorkspace invitation PDS profile consumers"`. Do not use the graph as proof of RLS or reachability. A documentation-only audit does not require rebuilding the graph; implementations refresh with `npm run graph:update` after structural changes.

## Target information architecture and decisions

The target global layer is Home, My Work, Inbox, Search, Workspaces, role-specific Accounting/Admin Center, Help, and Profile. Workspace content includes Projects, shared dashboards/folders when supported, Office Team, and scoped shared content. Project-local Main Table, Board, Gantt, Calendar, Dashboard, and Offices are views over canonical project data. Review, staffing, evidence, budget, and dependencies remain contextual actions or inspector sections where their workflow permits.

Record the initial candidate mapping below; freeze only after the full inventory and authority review.

| Current surface | Proposed treatment | Required compatibility decision |
| --- | --- | --- |
| Head Overview | Keep within Home or Office overview | Preserve Office scope; do not relabel Office-wide tasks as personal My Work. |
| My Tasks / My Subtasks / Leading / Deadlines / History | Combine discovery under My Work in Phase 13 | Retain reachable existing screens and routes until replacement paths cover every action. |
| Reviews / notifications / action badges | Combine discovery under Inbox in Phase 13 | Preserve independent task-review, financial, invitation, and governance handlers. |
| Projects context and project view bar | Move contextually into workspace/project layers | Preserve planning Drafts/Waiting for approval and explicit Board return. |
| Office Team / Team Supervision / Identity & Access / Team Intelligence | Workspace people/insights with permission-aware subviews | Separate Head-only Office authority from individually granted system access. |
| Accounting destinations | Group within Accounting | Keep all five destination permission keys and the Head/accounting separation. |
| Admin User Management subpages | Group within Admin Center | Preserve legacy support URLs and permission-managed operational access. |
| Reports / Performance / Announcements | Scope-dependent workspace views or personal discovery | No retirement until the report/announcement scope and equivalent action path are established. |

Do not represent My Work as something created through Add to workspace. Decide the persistence and membership model for genuine workspaces, folders, favorites, dashboards, and cross-scope Search separately; these do not become authorized backend changes merely because the target IA names them.

## Numbered vertical slices

1. **Establish the audit harness and route inventory.** Add `docs/product-refinement/audit/current-ia.md` and a screen register with stable screen ID, role, permission/capability, entry route, current caller, feature owner, data source, aliases, and reachability evidence. Traverse all four active roles plus Task Lead/non-lead, explicit administrative grants, collaborating Office, and Observer contexts. Mark unreachable prototypes rather than guessing they can be deleted. **Check:** every candidate destination and known invitation/notification deep link maps to a source owner; unknowns have an owner and next inspection step.
2. **Inventory interactions, mutations, and states feature by feature.** Add `action-matrix.md` and `mutation-registry.md`. Capture actor, record scope, permission, risk level, service/RPC, server validation, existing audit effect, confirmation, undo feasibility, blockers, success/failure/retry, dirty handling, and evidence/test link. Inventory every dialog, popover, side panel, form, list/table/card, creation/deletion workflow, loading/empty/error state, and permission denial. **Check:** every mutating handler in a mapped feature has a registry row; server/audit behavior is marked verified or unresolved, never inferred from client visibility.
3. **Inventory components and CSS, and capture visual baselines.** Add `component-inventory.md`, `token-inventory.md`, `duplicate-workflows.md`, and `screenshot-register.md`. Compare shared adapters with feature implementations; list selectors/tokens and consumers for broad compatibility CSS. Capture fixture-controlled desktop (1440), tablet (768/1024), mobile (390 and narrow 320) screenshots and keyboard paths. **Check:** every inventory screen has a screenshot/state coverage entry or an explicit access/configuration blocker; no live task/account mutation is needed for baselines.
4. **Review and freeze target IA.** Add `target-ia.md`, `current-to-target.md`, and `ia-decisions.md`. Every current surface gets Keep / Combine / Convert-to-view / Move-contextually / Retire-visually, destination, replacement action path, authority, URL alias, and owning phase. Approve the role × navigation and role × action matrices, including individual grants and Task Lead context. **Check:** no orphan workflow or unexplained permission expansion, no new shared storage assumed, and each future sidebar destination has a reason it cannot be contextual.
5. **Publish the handoff and phase gates.** Link audit artifacts from the program index; open bounded follow-up decisions for unsupported capabilities, known permission mismatches, and Phase 6.5 constraints. Record baseline test/build results when implementation starts. **Check:** Phase 8B receives token/component priorities, Phase 9 receives route/authority mappings, Phase 17 receives the mutation registry, and Phase 18 receives the screenshot/accessibility/performance baseline.

## Component and data/API impact

No application component edits are required for the audit. Document existing component APIs, consumers, and which adapters later phases should extend. **No database/RLS/business-rule changes.** No migrations, RPC changes, service contract changes, or runtime introspection are part of 8A. Inspect migrations/RPCs read-only when a matrix claim concerns authority, invitation security, finance, or server blockers; record the actual policy/function and test rather than deciding from Graphify.

## Authority, states, and mutation safety

Admin remains platform administration rather than an operational superuser; project access remains separate from account role. Head authority stays Office scoped. The intended Task Lead model permits eligible contributors/subtasks for the task they lead without becoming Head; the Lead Office cannot staff another Office. **G2 must remain an explicit authority discrepancy in the freeze:** do not approve the current shared-project Head-only team mutation restriction as the desired rule, and do not bypass it in the UI. Gate affected Task Lead controls on a separate narrow authority correction with positive/negative server regression coverage. Keep finance separation, PDS privacy, and AI's advisory boundary explicit.

Use the three risk levels for the inventory: direct save/autosave for reversible changes; impact confirmation for important changes; strong confirmation/blocker summaries for destructive or authority-sensitive actions. Record existing implementations and missing behaviors separately. Multi-field unsaved forms need a future discard strategy for close/navigation/project switch/browser back; autosaved inline rows do not receive blanket dirty prompts. Each important async action needs idle/pending/success/failure/retry; retain the user's draft on failure.

## Responsive and accessibility requirements

Audit keyboard-only navigation, visible focus, menu dismissal/focus restoration, mobile drawer containment, table headers/status text, reduced motion, contrast, page/region scrolling, and screen reader names. Include large project titles, long Office names, empty/all-error lists, and high record counts. The global scrollbar suppression is an explicit baseline defect to remove incrementally, not a desired standard.

## Verification and E2E acceptance

This planning/audit phase does not claim that tests or a live audit have been run. During implementation, establish `npm run check`, `npm test`, and `npm run build` as baseline gates. Run the affected fixture-backed browser specs against a configured test server; `navigation.spec.ts` additionally needs `EFLOW_E2E=1` and authorized `EFLOW_E2E_ACCOUNTS`. Do not silently count skipped credential tests as role coverage.

Acceptance paths: each role signs in → every effective destination opens → refresh/back/forward preserve context; Task Lead contextual pages appear only when leading work; explicit support grant opens the same allowed screen through menu and deep link; project invitation lands on its project/Offices context; Member/Observer lack mutation controls; table → Board → Main table preserves filters; Create project is present for authorized creators, sidebar Create work plan absent, and blur task/subitem behavior remains unchanged.

## Rollout and rollback

Audit documents are versioned independently from application changes. Freeze the map with a baseline commit/date and retain prior screenshots; amend decisions explicitly when later source differs. No runtime rollback is needed for documentation-only changes. Do not remove a legacy screen until search and acceptance evidence establish replacement consumers; later UI slices must have their own revert boundary.

## Definition of done and out of scope

Done when every reachable screen and interaction has an owner and disposition, the role/navigation/action matrices are approved, mutation and component/token inventories are complete, screenshot gaps are recorded, and all new capability/authority questions have explicit phase gates. The inventory must distinguish observed behavior from proposed targets.

Out of scope: broad visual rewrites, changing authorization, deleting legacy code merely because its name is old, creating workspace/folder/dashboard persistence, global Search backends, merged business workflows, and implementing Phases 6.5 or 8B–18.
