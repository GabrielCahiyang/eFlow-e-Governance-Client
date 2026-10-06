# Phase 8B — Design System Foundation

## Goal and dependencies

Consolidate the existing Vibe/Radix/adapted UI into one documented eFlow foundation for later phases. Retain Figtree, teal identity, neutral surfaces, compact professional controls, status semantics, and accessible interactions. Use existing primitives and compatibility APIs before adding wrappers.

Depends on Phase 8A's component/token inventory, screenshot baselines, mutation classification, and frozen IA. This is a UI-only phase. The latest Projects baseline includes authorized Create project, no sidebar Create work plan, sticky first-column three-dot menus, blur task/subitem creation, portaled Add view, and explicit Board return. Keep these behaviors during visual migration.

## Current-state evidence

| Existing foundation | Observed behavior / planned use |
| --- | --- |
| `src/app/shared/vibe/eflowVibeTheme.ts`, `EflowVibeProvider.tsx` | Vibe ThemeProvider already overrides supported brand colors and follows light/dark/system preferences. Extend its supported theme surface; do not replace the provider or invent a second source of theme state. |
| `src/app/contexts/UserPreferencesContext.tsx` | Theme preference is persisted through existing settings service; failed saves restore the previous appearance. Preserve this state/service contract. |
| `src/styles/globals.css`, `workspace-foundation.css`, `default_theme.css`, `index.css` | Multiple semantic token sets and stylesheet layers coexist. Globals remap Tailwind neutrals, hide scrollbars globally, and force Vibe internals to fixed/z-index 9999. Cleanup must be consumer-led and incremental. |
| `src/app/components/ui/Modal.tsx` | Compatibility adapter around Vibe supports existing isOpen/onClose/title/footer/width/preventClose API and accessible focus handling. Consolidate callers through this contract where suitable. |
| `src/app/components/ui/FeatureDialog.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` | Radix foundations already provide portals, focus/dismissal and feature-owned composition. Reuse them where appropriate and compare against the existing InspectorPanel before changing overlay ownership. |
| `src/app/shared/motion/InspectorPanel.tsx`, `motionTokens.ts`, `index.ts` | An InspectorPanel already portals to body, locks root inert/aria-hidden, traps Tab and restores focus; shared motion tokens already exist. Harden its supported API and nested-portal behavior before proposing a replacement or duplicate inspector. |
| `src/app/components/ui/DataTable.tsx` | Existing generic table supports search, sort, loading/empty states, scroll region, keyboard row activation, and aria-sort. It is not the editable project table; preserve that distinction. |
| `src/app/components/ui/workspace/` | WorkspaceHeader, WorkspaceShell, WorkspaceTabs, ActionMenu, WorkspacePopover, SplitActionButton, InlineEditableText, StatusPill, PeopleAvatarStack, skeleton and empty-state controls exist. Extend these APIs only when gaps are demonstrated. |
| `src/app/components/ui/button.tsx`, `FormField.tsx`, `input.tsx`, `select.tsx`, `Toast.tsx`, `sonner.tsx` | Vibe and Radix/native control styles coexist. FormField currently renders a label without an explicit htmlFor association or shared error ID. Compatibility additions can improve associations without rewriting feature validation. |
| `src/app/components/ui/useConfirmation.tsx` | Shared Radix confirmation resolves acceptance before mutation and cancels on unmount. It has a simple string description and bespoke z-index. Extend for impact/blocker presentation; do not make it a blanket modal for every edit. |
| `src/app/features/tasks/presentation/taskStatusPresentation.ts` | Task status text, descriptions, and Vibe colors already have one mapping with an unknown-status fallback. Generic surface semantics must consume that mapping rather than duplicate lifecycle labels. |

## Source modules and test anchors

Primary shared modules are `src/app/components/ui/`, `src/app/components/ui/workspace/`, `src/app/shared/vibe/`, `src/app/shared/motion/`, and `src/styles/`. Keep domain-neutral additions in shared UI; keep Person/Office eligibility, statuses, and mutations in feature controllers/selectors/services. Export cross-feature adapters through deliberately small public entry points.

Existing tests to extend: `tests/unit/vibeFoundation.test.tsx`, `sharedUiVibeAdapters.test.tsx`, `workspaceFoundation.test.tsx`, `inspectorPanel.test.tsx`, `neutralSurfacePresentation.test.ts`, `phase03ProjectPresentation.test.tsx`, `projectViewNavigation.test.tsx`, `projectLifecycle.test.tsx`, `inlineCreateRow.test.tsx`. Browser regression anchors include `tests/e2e/project-workspace-controls.spec.ts`, `phase3-project-table.spec.ts`, `admin-mobile-dialogs.spec.ts`, and `navigation.spec.ts` with its credential requirements. Add a proposed fixture-only `tests/e2e/design-system-foundation.spec.ts` for compound overlays/keyboard/theme proofs; it does not currently exist.

## Graphify navigation

Used the bounded `npm run graph:query -- "EflowAppShell RoleContent navigation sidebar role visibility shared UI"`; it identified the shared Vibe adapter tests and UI dependencies. Known modules above were then read directly. At implementation time, query only an unexplored impact, such as `npm run graph:query -- "Modal FeatureDialog useConfirmation caller impact"`, and inspect every affected source caller before replacing an API. Refresh with `npm run graph:update` after structural changes and review known parser warnings; CSS consumers still require `rg`, because a graph edge is not a complete stylesheet impact map.

## Target information architecture

Maintain the 8A global/workspace/project separation. Shared WorkspaceHeader/WorkspaceTabs present workspace content; project-specific ViewTabs remain distinct, controlled adapters over canonical project views; neither owns project data. A WorkspaceTree is presentation over authorized content, not a new database abstraction. InspectorPanel provides layout and accessibility; domain tabs and capabilities remain feature-owned.

Document the canonical adapter for each job, allowed exceptions, state contract, and migration owner. Do not require every screen to use a proposed AppButton/AppIconButton name when existing Vibe Button/IconButton already satisfies the need.

## Numbered vertical slices

1. **Define tokens and map existing sources.** Add a documented semantic token contract for color, typography, spacing, radius, elevation, control height, table density, focus, motion, breakpoints, layers, and status tones. Map current Vibe variables, globals, and workspace variables to one source per semantic value; retain old aliases while their consumers migrate. Keep Figtree/theme preference integration. **Checks:** shared theme tests cover light/dark/system change and failed preference persistence; fixture screenshots demonstrate readable contrast and no layout regression at 1440/768/390/320.
2. **Standardize controls and feedback using compatible adapters.** Consolidate Button/IconButton variants, ActionMenu/ContextMenu, Search/Select, FormField labels/errors, shared empty/error/success/skeleton patterns, and transient feedback. Add optional IDs, description/error associations, pending state and disabled reasons where existing APIs lack them. Reuse installed toast infrastructure; undo appears only when a feature has a safe inverse service operation. **Checks:** keyboard activation, accessible names, form association/error announcements, pending duplicate-submit prevention, and disabled explanation tests; verify New task split chevron and Create project dimensions remain usable.
3. **Standardize overlays and risk presentation.** Reuse Modal/FeatureDialog/sheet/alert-dialog and the existing shared-motion InspectorPanel API for Dialog, Confirm/DestructiveDialog and SidePanel/Inspector layout. Preserve current task/announcement/audit inspector callers; evaluate consolidating underlying focus handling only when nested portal tests justify it. Add compatible impact content, blockers, pending/error/retry, focus return, and optional typed confirmation where approved by mutation risk. Define layers for sticky table, drawer, popover, modal, nested alert and toast; remove Vibe internal-class fixed/z-index hacks only after equivalent portaling and real hit-testing passes. **Checks:** keyboard/Escape/backdrop behavior, nested picker within inspector and dialog, dirty-discard alert over form, row menu over sticky table and mobile view picker remain correctly positioned, keyboard usable and clickable; root inert/overflow lock always releases after close/unmount.
4. **Consolidate workspace and table composition.** Extend existing workspace header/tabs/menu/status/avatar/skeleton/empty controls and generic DataTable for documented density, toolbar/filter slots, scroll affordances and action cells as required. Add a shared tree presentation only after 8A establishes its content model. PersonPicker/OfficePicker/DatePicker/StatusPicker reuse existing eligible options and handlers; generic UI must not recalculate authority. **Checks:** adapter behavior tests plus representative project/admin/people fixtures; preserve active view/filters/focus and unknown-status text; no extra network requests or view-specific task stores.
5. **Migrate a representative vertical slice, then retire compatibility CSS by consumer.** Start with Projects controls, one people/admin list and its dialog; keep independent commits for each migrated feature. Replace hardcoded values with tokens without changing their services/controllers. Remove broad neutral remapping and global scrollbar hiding in bounded regions after source search proves relevant consumers migrated; style thin visible scrollbars in genuine scroll regions. Do not delete unmigrated aliases. **Checks:** all 8A screenshots for touched routes, existing affected E2E, unchanged role/action matrix, and before/after large-list scroll behavior.
6. **Publish the foundation contract and migration ledger.** Document usage, states, exceptions, supported public APIs, token/layer tables and remaining compatibility consumers. Each later phase receives a migration list rather than a mandate to rewrite unrelated screens. **Checks:** small public entry points, no feature-internal imports, no orphan styles/components, and Graphify update warnings reviewed before declaring structural completion.

Every implementation slice runs `npm run check`, `npm test`, and `npm run build`; run affected Playwright smoke tests when their environment is configured. Pure documentation slices do not require application test execution. Do not make passing source-string presentation assertions the only proof of interactive behavior.

## Component and data/API impact

Prefer optional adapter props and compatibility re-exports while consumers migrate; remove old APIs only after repository search and regression coverage prove no callers remain. New generic primitives should have a demonstrated consumer gap, not duplicate Vibe/Radix controls for naming consistency.

**No database/RLS/business-rule changes.** No migration, permission default change, new service return value, theme persistence field, workspace persistence, Search index or backend endpoint is authorized in 8B. A picker receives eligible records from its existing feature controller; a status control receives permitted transitions rather than inventing them. Shared tables must not take over financial/project domain rules.

## Authority, states, and mutation safety

Keep Admin/system access, Head/Office authority, contextual Task Lead, Observer/read-only and finance separation unchanged. **Gate G2:** the existing `phase6_guard_task` migration restricts shared-project staffing updates, including `team_member_ids`/`team_id`, to the responsible Office Head. This conflicts with the brief's Task Lead execution-team intent; a separately reviewed narrow authority correction is required before changing affected controls. The design system must not mask rejection or grant client-only access.

All async adapters expose idle/pending/success/failure/retry and preserve drafts on failure; the feature controls the mutation. Level 1 inline edits save directly without extra confirmation. Level 2/3 confirmation surfaces show actual impact/blockers and prevent duplicate submits. A dirty-state adapter may render discard UI, but must receive explicit form dirty state and leave autosaved inputs alone; integrate close/Escape/backdrop/navigation guards incrementally rather than silently changing dismissal everywhere.

## Responsive and accessibility requirements

Set a shared minimum hit-area policy for navigation/action controls while allowing compact table visuals; test actual clickable bounds. Tables retain visible horizontal scrolling and sticky action access; desktop drawers become usable full-screen panels on small viewports with safe areas and independent scrolling. Popovers remain within the viewport and outside clipping ancestors. Avoid forcing desktop inspector columns onto mobile.

Require name/description/error relationships, visible focus, keyboard menu/selection/tab behavior, dialog focus trap and restoration, status text plus color, tested contrast in both themes, reduced motion, and usable 200% zoom. Screen reader announcements must report save/error state without repeatedly announcing the whole table. Use existing portal/focus implementations rather than manual document focus management where possible.

## Verification and E2E acceptance

Acceptance paths: theme changes light → dark → system; project view picker opens above clipped/scrolled content and returns focus; first-column row menu remains hit-testable after horizontal scroll at 390px; inline task/subitem blur saves once and failed save retains the draft; form errors link to inputs; a destructive confirmation cancellation causes no service call; pending operations cannot duplicate; keyboard-only users can navigate headers/tabs/dialogs; scrollbar affordances are visible on oversized tables and navigation.

Use `EFLOW_E2E=1`, a configured `EFLOW_E2E_BASE_URL`, and fixture-backed specs for mutation tests. `tests/e2e/navigation.spec.ts` needs authorized test credentials. No live destructive action is required for visual proof. Planning itself does not run or claim these gates.

## Rollout and rollback

Roll out semantic aliases first, then one adapter/caller slice at a time. Retain source APIs and old token aliases until their consumers migrate. Do not combine provider replacement, global CSS deletion and feature redesign in one commit. Roll back a slice by reverting its adapter/caller migration; no data rollback is needed. If portal or theme regression appears, restore the previous scoped compatibility rule while keeping a documented follow-up; do not reinstate a permanent global 9999 workaround as the target.

## Definition of done and out of scope

Done when token sources and layers are documented, representative controls/overlays/workspace compositions share state/accessibility contracts, responsive/theme/interaction tests pass, cleanup is proved by migrated consumers, and later phases have a clear migration ledger.

Out of scope: a new component library/framework, a wholesale page rewrite, business-rule or permission changes, Phase 6.5/G2 authority corrections, global Search/workspace storage, view-specific data stores, and claiming every legacy stylesheet has been removed before its consumers migrate.
