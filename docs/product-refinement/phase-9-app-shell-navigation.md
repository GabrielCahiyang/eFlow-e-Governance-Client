# Phase 9 — App Shell and Navigation V2

## Goal and dependencies

Replace the many-module discovery model with clear global navigation plus contextual workspace content, while keeping every authorized workflow reachable. This phase changes shell composition and navigation discovery, not the underlying authorization or business workflows.

Depends on Phase 8A's frozen current → target mapping, role/navigation/action matrices, URL/deep-link compatibility inventory, and Phase 8B's tokens, menus, drawer/tree presentation, state and accessibility contracts. Full My Work and Inbox aggregation is Phase 13; full Admin/Accounting reorganization is Phase 16. Phase 9 can group existing destinations without claiming those later experiences already exist.

Preserve the latest Projects interactions: restored authorized Create project, absent sidebar Create work plan, planning Drafts/Waiting for approval, sticky first-column task action menus, inline blur creation, Add view and Main table/Board return. Phase 6.5 may be postponed only with current Office compatibility retained.

## Current-state evidence

| Finding | Source and consequence |
| --- | --- |
| Shell currently constructs a flat role-aware list and delegates to RoleContent; it also owns top-bar utilities, guided-tour context and mobile navigation. | `src/app/features/app-shell/EflowAppShell.tsx`. Extract navigation presentation in small slices; retain permission and tour composition. |
| Desktop is a compact rail that expands on hover/focus; mobile exposes the same groups in a modal. | `src/app/features/app-shell/components/ProductivitySidebar.tsx`, `eflowAppShell.css`. Replace discovery and responsive behavior without requiring mouse hover. |
| Workspace name is a read-only current Office label from existing org data. No shell workspace selector/favorites persistence or global Search was found in inspected sources. | `EflowAppShell.tsx`, `ProductivitySidebar.tsx`, `src/app/contexts/UserPreferencesContext.tsx`. A genuine new workspace model, shared folders/dashboard storage, or search backend is a gated capability decision. |
| Navigation records are built in a compatibility module with stable section IDs and role defaults. Accounting adds five explicit destinations to the Member workflow. | `src/app/components/Layout/coreWorkflowNavigation.tsx`. Maintain additive personal work for Accounting Staff and explicit destination permissions. |
| Permission-managed administrative candidates can be offered to operational roles; Task Lead destinations depend on actual leading work. | `src/app/features/navigation/roleNavigation.tsx`, `navigationPermissions.ts`. Sidebar grouping alone must not impose a stronger role restriction or grant broader access. |
| RoleContent checks direct content access, lazy-loads role/workspace components, and treats Admin separately from operational roles. | `src/app/features/navigation/RoleContent.tsx`. Keep defense on both menu and direct route; preserve lazy boundaries. |
| URL handling uses stable paths plus page query, aliases, history and project invitation context. | `src/app/features/navigation/navigationUrl.ts`, `useRoleNavigationState.ts`. New labels/groups need explicit old-route mapping and no silent loss of query context. |
| Project navigation is separately owned by ProjectsWorkspace, whose visible project list includes authorized shared/inter-Office data rather than a simple Office-only filter. | `src/app/features/projects/components/ProjectsWorkspace.tsx`, `ProjectContextSidebar.tsx`. Workspace grouping cannot narrow the accessible projects to only `project.orgId === currentOfficeId`. |
| Top bar contains account/Profile/Appearance/logout, notification navigation, chat/calls, help/onboarding and tours. | `src/app/features/app-shell/components/EflowTopBar.tsx`. Do not hide these utilities or break notification deep links during shell cleanup. |
| Temporary navigation locks already block select/back attempts while an operation is locked, but there is no general dirty-form discard protocol here. | `src/app/shared/navigationLock.ts`, `useRoleNavigationState.ts`. New workspace/project switching needs explicit coordination with unsaved forms. |

## Source modules and test anchors

Modify focused shell/navigation modules under `src/app/features/app-shell/` and `src/app/features/navigation/`; keep domain-neutral tree/drawer controls in `src/app/components/ui/`. If a new workspace presentation feature is warranted after 8A, create `src/app/features/workspaces/` with a small public `index.ts` and adapters over existing access-filtered services; this path is proposed, not an existing capability.

Existing tests: `tests/unit/navigation.test.ts`, `navigationUrl.test.ts`, `accountingRoleNavigation.test.tsx`, `phase02MobileNavigation.test.tsx`, `navigationActionAlerts.test.ts`, `projectViewNavigation.test.tsx`, `projectLifecycle.test.tsx`, `notificationNavigation.test.ts`, `notificationBellNavigation.test.ts`, `guidedTourCatalog.test.ts`, `guidedTourInteraction.test.ts`; browser specs `tests/e2e/navigation.spec.ts`, `admin-unification.spec.ts`, `admin-mobile-dialogs.spec.ts`, `phase1-authority.spec.ts`, `phase2-invitations.spec.ts`, `project-workspace-controls.spec.ts`, and `phase6-project-offices.spec.ts` protect relevant paths. Add a proposed fixture-backed `tests/e2e/navigation-v2.spec.ts` for the complete role × route/context matrix; it does not exist yet.

## Graphify navigation

Used `npm run graph:query -- "EflowAppShell RoleContent navigation sidebar role visibility shared UI"`, then read actual shell, role/URL/permission modules, role route manifests, Projects context and tests. It identified the relevant dependency roots; further broad shell queries are unnecessary now. Use future bounded queries only for unexplored caller paths, e.g. `npm run graph:query -- "notification navigation intent project invitation shell routing callers"` or `npm run graph:query -- "GuidedTourProvider navigation section catalog callers"`. Refresh with `npm run graph:update` after structural slices, reviewing existing parser warnings without forcing an incomplete smaller graph.

## Target information architecture and capability decisions

| Layer | Target discovery | Initial implementation constraint |
| --- | --- | --- |
| Global | Home, My Work, Inbox, Search, Workspaces; Accounting/Admin Center when authorized; Help/Profile | Use existing destinations/handlers where equivalent; dedicated personal/action aggregations arrive in Phase 13. Do not label Head's Office Task Board as a personal assigned-work list. |
| Workspace panel | Current context selector, Favorites, Overview, Projects/content tree, Office Team, scoped insights | Start with authorized existing Office/project contexts. If only one context is available, render an honest current-context label; do not imply selectable unavailable workspaces. |
| Shared content creation | Project, proposal import, and further items only when implemented and allowed | Reuse existing CreateProjectDialog and proposal-import handlers. No decorative Dashboard/Folder/Invite entries that do nothing. Office/project invitation scopes remain distinct. |
| Project | Main Table, Board, Gantt, Calendar, Dashboard, Offices and contextual settings | Keep existing project view ownership until Phase 10/12; no duplicate global destinations or per-view stores. |
| Role-specific work | Accounting and Admin Center with existing internal destinations | Group current screens; preserve independent entitlement checks and current workflows until Phase 16. |

Freeze these decisions before implementation:

- **Workspace identity/persistence:** decide whether the initial selector represents existing Office/project contexts only or introduces true membership-bearing shared workspaces. The latter needs a separately scoped schema/API/RLS design and authorization review; it is not included in the UI-only shell slice.
- **Favorites/expanded state:** choose local visual preference versus cross-device persistence. A UI-only option is versioned local state scoped by authenticated user/context, limited to authorized record IDs, validated on access changes and cleared on logout. Extending the persisted UserPreferences API requires a separate reviewed change. Never store a duplicate project/task record cache as navigation state.
- **Global Search:** the inspected shell has no indexed cross-resource search. Implement a clearly labeled search of currently loaded, authorized navigation/project content only if approved as the first increment; keep full server-backed Search as a separate data/security/performance decision. Do not fetch privileged/all-Office records to populate results.
- **Home/My Work/Inbox phase boundaries:** preserve existing role landing defaults until an equivalent landing/action path is approved. A transitional My Work/Inbox collection may link to existing personal/review/notification workflows with accurate labels; the Phase 13 aggregate cannot be fabricated by visual regrouping. Document this increment and its Phase 13 replacement.
- **Compatibility:** retain old route resolution and legacy links while showing one canonical navigation treatment. Visual retirement must be conditional on a replacement that passes the corresponding role/action acceptance path.

## Numbered vertical slices

1. **Introduce a presentation destination model over existing contracts.** Add focused typed selectors for global group, workspace context, contextual children, labels, badges and targets, derived from existing candidates/permissions. Keep account role and project access separate. Implement explicit mappings from the 8A inventory rather than reassigning a permission because a label changes. **Checks:** pure mapping tests for all four roles, Task Lead/non-lead, individually granted administrative access, accounting additive personal work, and unknown/legacy role rejection; existing direct-route guard tests stay green.
2. **Render the global rail and contextual panel without changing data ownership.** Replace ProductivitySidebar composition with shared accessible global/context controls, retaining top-bar utilities and the existing RoleContent router. Group current Projects/planning content and authorized role-specific destinations. Preserve stable tour markers or migrate the tour catalog in the same slice. **Checks:** each previously visible destination has an equivalent visible/keyboard action; current page indication, page title, badges and tour paths remain correct; no extra project/task subscriptions introduced by the tree.
3. **Add authorized context selection and project content tree.** Build a selector over the approved initial context model and access-filtered existing data. Show projects, nested/collapsible sections, archived items where currently supported, planning Drafts/Waiting for approval and Office Team under the correct authority. Reuse existing project-open callbacks and creation controllers through feature public APIs; do not reach into service internals from generic tree items. Add favorites only under the approved local/persistence choice. **Checks:** context switch preserves the authorized project set, including inter-Office participants; empty/loading/error/unassigned-Office/stale-favorite states are usable; authorized Create project opens its existing dialog, Member/Observer lack creation, sidebar Create work plan remains absent.
4. **Install the small Add to workspace menu and honest transitional discovery.** Wire Project and proposal import only to supported existing handlers under current creation permissions. Keep project Office invitations within Project Offices and Office account invitations within authorized Office Team. Add Home/personal/action/search navigation only per the approved capability increments above; defer unsupported Dashboard/Folder creation to its separate decision. **Checks:** every enabled menu item performs its named behavior, no permission expansion, no My Work creation option, and selecting a contextual creation flow preserves return context on cancel/success/failure.
5. **Preserve URL/history/notification/invitation navigation.** Map old section paths/page aliases to canonical shell discovery without changing service or invitation contracts. Preserve project/view query context on the Projects invitation route; clearing it outside Projects remains intentional. Coordinate selection, project switching, drawer close and browser back with registered dirty-form discard handling; retain temporary operation locks. **Checks:** reload/back/forward and direct old URLs land on equivalent authorized content, stale query falls back safely, deny paths reveal no records, invitation/account startup and notification navigation keep the correct task/project context, canceling discard keeps the editor open.
6. **Implement mobile navigation as a deliberate small-screen composition.** Keep Home/personal work/Projects/Inbox/More conceptual priority but expose only delivered equivalents. Move contextual workspace/tree selection into an accessible drawer; role-specific Admin/Accounting/utilities remain reachable through More when allowed. Tablet may compress panels; desktop remains keyboard-selectable without hover. **Checks:** at 390/320 and tablet widths, no page-wide horizontal overflow, drawer focus is contained/restored, active project survives close/reopen, and first-column task menu/view picker/Board return remain usable.
7. **Retire visual duplicates and publish compatibility mapping.** Remove duplicate sidebar entries only after their replacement route/action passes. Keep aliases until source search and explicit adoption evidence justify removal; remove legacy component exports only after no consumers remain. Update navigation/tour/help/docs and Graphify for structural edits. **Checks:** the 8A matrix has no orphan actions, every old URL has an explicit result, bundle lazy boundaries remain intact, and the new navigation registry—not copy/pasted screen menus—is the canonical discovery source.

Each application slice runs `npm run check`, `npm test`, `npm run build`, and the affected configured Playwright specs. Do not infer a pass from credential tests being skipped. Maintain small commit/revert boundaries for mappings, rendering, context selection, menus, URLs and mobile.

## Component and data/API impact

Likely changes are shell composition, navigation presentation selectors, tree/context/favorite visual state, drawer composition and route compatibility adapters. Existing AuthContext permissions, task/project hooks, service return values and role screen controllers remain authoritative. The shell should consume public feature APIs and callbacks, not duplicate project loading/eligibility rules.

**No database/RLS/business-rule changes.** No migrations are required for the approved UI-only existing-context increment. True workspace membership/persistence, shared folder/dashboard objects, persisted favorites, full Search endpoints/indexes, or changed route payload contracts are explicitly gated separate work. If any is essential for the chosen scope, stop that dependent slice at a concrete contract/design review; continue independent shell and compatibility work rather than silently invent storage.

## Authority, states, and mutation safety

Preserve Admin as platform authority, not operational superuser; Office Head authority stays own-Office; contextual Task Lead remains execution scoped; Observer stays read-only; individual grants remain effective; finance execution/approval separation, invitation security and PDS privacy remain untouched. The same guard must protect menu visibility and direct route.

**Gate G2:** source migrations `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql` and `20261004182453_phase6_shared_structure_guards.sql` leave a Head-only shared-project team mutation restriction in `phase6_guard_task`. Do not freeze that discrepancy as desired Task Lead authority or enable client-only staffing. Preserve server enforcement, explain current denials, and gate affected Task Lead team controls on the separate narrow correction. Deployed behavior has not been audited by this planning task.

Navigation and collapse are low-risk visual actions. Local favorites are reversible presentation preferences. Project creation retains existing validation/pending/error/retry. Do not add confirmation to ordinary navigation unless a genuinely dirty multi-field form is open. Important/destructive actions retain existing impact/blocker/confirmation flows, and request retries must not duplicate creation. A shell context switch must not lose a failed inline draft or acknowledge success before the existing service succeeds.

Required panel states: startup loading; no assigned Office; zero authorized projects; collapsed/expanded content; partial data failure with retry; stale selected project/access revoked; missing/not-found context; restricted destination; mobile drawer open/closed; pending creation and retained failed form. Badges must disclose only accessible actions, not counts from hidden records.

## Responsive and accessibility requirements

Use stable landmarks (primary/global navigation, workspace content, active main), one clear active destination, labeled context selector and creation trigger, skip-to-workspace, visible focus and descriptive action names. Favor disclosure semantics for simple nested lists; only use ARIA tree roles if full tree keyboard behavior is implemented. Support keyboard context selection, expand/collapse, Escape, focus return after drawer/dialog close, and clear disabled explanations. Avoid hover-only labels or destinations. Respect reduced motion and contrast; keep scroll affordances visible.

Complex project tables remain independently horizontally scrollable; shell changes must not squeeze main content to an unusable width. Mobile navigation is purpose-built, not a scaled desktop sidebar. Keep nested dialogs/popovers hit-testable above the drawer and restore the opening control when dismissed.

## Verification and E2E acceptance

Test role × route × context with fixtures, including explicit permission grant/deny and shared-project Observer/Task Lead cases. Use existing tests as contracts, then add interactions for new grouping/tree/favorites/selector and route adapters. Navigation mapping tests must assert targets and allowed actions, not merely labels.

Acceptance paths:

1. Each role signs in → approved landing → new global/context navigation → every formerly authorized destination → refresh/back/forward. Accounting retains Member work and five entitled accounting destinations; Admin has no automatic project operations.
2. Head without leading work versus Member actually leading → contextual leading/review entry visibility; explicit support grant reaches an administrative page through both menu and direct URL; denied account gets AccessDenied without privileged records.
3. Workspace/project context → shared inter-Office project → project Main table → Board → back with filters intact; invitation deep link lands on project/Offices and notifications open their existing target.
4. Authorized Create project opens/succeeds/cancels/fails in the existing flow; Member/Observer cannot create; no sidebar Create work plan; no non-working Dashboard/Folder entries; no Add to workspace → My Work entry.
5. Dirty multi-field editor → choose another project/browser back → Keep editing retains state; Discard navigates once. Autosaved inline creation remains single-save on blur/Shift+Enter and retains failure drafts.
6. At 390/320 and tablet sizes, drawer keyboard behavior, nested menus, long titles, independent table scrolling, sticky row actions, active tab and context remain correct; no unintended document horizontal overflow.

Configure `EFLOW_E2E=1` and `EFLOW_E2E_BASE_URL` for a test server; `navigation.spec.ts` additionally requires authorized `EFLOW_E2E_ACCOUNTS`. Mutation checks use fixture interception/test accounts, never real destructive live operations. This document specifies future verification; it does not claim a current live or test run.

## Rollout and rollback

Adopt the destination model behind a temporary local presentation switch or separate render adapter so old/new shells share permission/router contracts; do not add a backend setting for rollout. Enable per role after its matrix passes, then remove the old visual shell after full acceptance. Retain old route aliases during rollout and define their eventual removal owner/criteria.

Rollback by reverting the affected shell/presentation slice or using the temporary old renderer, keeping canonical data/services unchanged. Clear/version incompatible local visual state safely if needed; no database rollback applies. Never maintain two equivalent canonical workflows indefinitely—document the replacement and retirement criteria in 8A's map.

## Definition of done and out of scope

Done when global/context navigation follows the approved IA, every existing authorized action is reachable, role and individual capability checks agree with direct routes, old links/history/invitation/notification paths work, delivered creation/search/context controls are honest and functional, mobile/keyboard acceptance passes, and navigation/help/tour docs are synchronized.

Out of scope: full Phase 13 My Work/Inbox aggregation, full Phase 16 Admin/Accounting UX, new workspace/Search/folder/dashboard persistence without separate approval, Phase 6.5 and G2 server authority changes, changing role defaults/permissions for cosmetic convenience, or removing a legacy action without a validated replacement.
