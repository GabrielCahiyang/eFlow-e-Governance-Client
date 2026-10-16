# Global UI/UX simplification — P2 implementation receipt

Date: 13 October 2026, Asia/Singapore. User authorization: “start implementing phase p2,” followed by “continue.” P2 builds on the approved, uncommitted P0/P1 working tree at HEAD `545245e353ad04ac47e24f95a71e06cf736ca0f8`. **P2 is implemented and locally verified. P3–P7 have not begun.** No migration, hosted database write, deployment, permission rule, backend endpoint or business-authority change was made.

## Corrected behavior

- **One destination host:** the existing My Work rail is authoritative when expanded. The page fallback uses the existing sidebar destination records when the desktop rail is collapsed, on mobile with the drawer closed, or standalone. Opening the mobile drawer hides the page fallback so there is one interactive host. The existing rail, workspace header/switcher and icon registry were preserved; this is a bounded My Work composition correction.
- **Compact filters:** search and one Filters trigger replace the separate scope/date/recent rows. The labeled popover retains all original date choices, workspace scope, and the History-only Recently completed option. Nondefault filters remain visible as removable chips and a count after closing the popover. Search has its own clear action; Clear filters resets date/scope/recent. A filtered empty state can clear search and filters together. The original URL/history/dirty-navigation owner still applies the changes.
- **Accurate filter state:** old Due today, Due this week, Overdue and Recently completed bookmarks keep their meaning. Query, date, workScope and recent survive the accepted refresh/history/context paths. Recent applies only to History and still means the last seven days by last update. An unavailable selected workspace is identified explicitly, without silently presenting it as the unrestricted default.
- **Restrained tools:** the old page-wide Work tools menu and repeated Open Inbox action are removed. A collapsed disclosure belongs to the active destination host. It derives entries from existing authorized navigation records and offers the selected workflow's distinct full controller plus authorized Calendar/Performance/Work Report tools. It does not list aliases or every legacy route. Head Task Board and Reports remain in Workspaces. The existing current legacy-tool item appears once, and the disclosure does not repeat it.
- **Office handoff preserved:** selecting a personal workspace does not restrict the global My Work feed. Its tool disclosure uses the shell's already-authorized global records, so the Office calendar and appropriate full workflows remain reachable. Selecting an Office tool still invokes the existing guarded, verified return to the actor's Office.
- **Compact work rows:** each row keeps title, one scope/breadcrumb line, relation, explicit Lead/contributor count for subitems, status, due date and progress. Progress remains visible on mobile. An inline Details disclosure retains the complete authorized path, full workspace/project identity, relation, Lead, contributor names and timezone on touch and keyboard. Row keys, canonical IDs, Inspector selection and focus return remain unchanged. Missing Lead/reassignment information stays visible.
- **Immediate visual refinement:** the toolbar, chips, rows, statuses, details and responsive states reuse Figtree, semantic eFlow tokens, existing Button/Popover/StatusPill primitives and compact patterns. Manual inspection caught a 320 px History popover extending below the viewport; it now uses the shared popover's available height and keeps Done visible while the content scrolls. Mobile filter actions, including Done and Clear filters, have 44 px targets.

## Distinct retained tools and reachability

| Tool | Why it remains distinct | Where exposed |
|---|---|---|
| Task workspace | Existing task board, status/group views and task operations | Assigned work, under the actor's existing task grant; Head's Office board stays in Workspaces |
| Lead workspace | Existing scoped Lead workflow and task/subtask work controls | Leading, only when the existing navigation records show a current eligible appointment |
| Subtask workflow | Existing status/scope, reviewer and prerequisite presentation | Subtasks, when authorized |
| Task history details | Existing detailed task-history presentation | History, when authorized |
| Deadline calendar | A calendar is distinct from filtering a work list by date | Authorized personal-tool disclosure |
| Performance / Work Report | Existing metrics and report workflows are distinct from work rows | Authorized personal-tool disclosure; Head Office reports stay in Workspaces |

There are at most four disclosed tools for a Member/Accounting Staff view: one relevant full workflow and three distinct general tools. Head's Assigned work has no redundant disclosure; eligible Leading/Subtasks keep only the relevant distinct workflow. Other legacy routes and aliases remain compatible and searchable through existing authorized navigation. No route label supplies authority.

## Exact P2 files

The [P2 changed-file inventory](global-ui-p2-evidence/changed-files.txt) distinguishes this phase's changes from the earlier uncommitted P0/P1 slice. Application/test changes are:

| Ownership | Exact paths |
|---|---|
| Existing shell composition | `src/app/features/app-shell/EflowAppShell.tsx`; `src/app/features/app-shell/components/ProductivitySidebar.tsx`; `src/app/features/app-shell/components/ContextRail.tsx`; `src/app/features/app-shell/navigationV2.css` |
| Existing navigation contract/presenter | `src/app/features/navigation/RoleContent.tsx`; `src/app/features/navigation/index.ts`; new `src/app/features/navigation/PersonalWorkTools.tsx`; new `src/app/features/navigation/personalWorkTools.css` |
| My Work presentation | `src/app/features/personal-work/components/PersonalWorkWorkspace.tsx`; `src/app/features/personal-work/components/WorkList.tsx`; new `src/app/features/personal-work/components/WorkFilters.tsx`; `src/app/features/personal-work/personalWork.css`; `src/app/features/personal-work/workLocation.ts` (filter type export only) |
| Unit regression coverage | new `tests/unit/personalWorkNavigation.test.ts`; `tests/unit/contextRailIsolation.test.tsx`; `tests/unit/navigationHandoffGuard.test.tsx`; `tests/unit/workspaceRefinementWorkRefresh.test.tsx` |
| Browser regression coverage | new `tests/e2e/global-ui-p2.spec.ts`; `tests/e2e/phase13-personal-work.spec.ts`; `tests/e2e/workspace-refinement-r10.spec.ts` |

The audit's phase handoff, this receipt, and evidence files are also listed in the inventory. Existing browser tests now open the relocated filter controls and inline path details; their behavioral and authority assertions remain. [Before hashes](global-ui-p2-evidence/protected-baseline.json) and [after hashes](global-ui-p2-evidence/protected-after.json) confirm the feed service, selectors, navigation permissions, icon registry and switcher are unchanged from P0/P1. No `server/`, `supabase/`, package or lockfile file changed. P0/P1 receipts and screenshot evidence are intact.

## Verification

| Check | Result |
|---|---|
| `npm.cmd run check` | Passed |
| `npm.cmd test -- --maxWorkers=2` | **293 files, 1,761 tests passed** after the Office-handoff correction |
| `npm.cmd run build -- --outDir .codex-tmp/global-ui-p2/dist` | Passed after the final visual correction; existing large-chunk and dynamic/static import warnings remain |
| Affected Playwright suites, Chromium + WebKit | **68/68 passed**, no skips/flakes: P2, R10 work, Phase 13 personal-work and context-rail suites |
| Final P2 suite after the mobile popover correction | **18/18 passed**, no skips/flakes; includes the additional 320 px History/footer regression |
| `npm.cmd run graph:update` | Passed: 9,524 nodes / 423 communities; the four existing parser warnings remain |
| `git diff --check` | Passed |

The 68-case and 18-case runs overlap; they are separate verification runs, not 86 unique tests. [Verification summary](global-ui-p2-evidence/verification.json) records their actual result counts. Firefox was unavailable during P0/P1 (`spawn UNKNOWN`); no Firefox pass is claimed here.

## Browser and visual evidence

Both automated and manual browser sessions used local synthetic authorized role/account fixtures, with no external API fallback. This provides realistic Office/personal rows, long titles/workspace names, depth-eight paths, contributor details, actual empty and filtered-empty states, and the existing role grants without hosted writes. It does not establish genuine hosted JWT/Storage or multi-account release acceptance.

The in-app browser was manually operated through search, scope/date/recent controls, chips, context return, tool disclosure, expanded/collapsed/mobile destination hosts and inline branch details. Head, Member and Accounting Staff presentation was inspected in light/dark; Admin was checked for the absence of My Work and operational authority. Automated visual cases cover 1440/768/390/320 px for each operational role/theme, with document/main overflow checks and keyboard/popover checks. Representative direct manual captures:

| Evidence | Capture |
|---|---|
| Member compact desktop and tools | [Rows](global-ui-p2-evidence/member-desktop-light.jpg), [restrained tools](global-ui-p2-evidence/member-tools-light.jpg), [collapsed fallback](global-ui-p2-evidence/member-collapsed-light.jpg) |
| Full depth-eight authorized identity on desktop and touch | [Desktop details](global-ui-p2-evidence/member-branch-details-light.jpg), [mobile details](global-ui-p2-evidence/member-branch-mobile-light.jpg) |
| Mobile filters and genuine empty state | [390 light filters](global-ui-p2-evidence/member-filters-mobile-light.jpg), [390 dark empty](global-ui-p2-evidence/member-empty-390-dark.jpg) |
| Head local Lead/Subtask authority and dark presentation | [Leading light](global-ui-p2-evidence/head-leading-desktop-light.jpg), [branch dark](global-ui-p2-evidence/head-branch-desktop-dark.jpg) |
| Corrected 320 px History panel and one drawer host | [History/footer dark](global-ui-p2-evidence/head-history-filters-320-dark.jpg), [drawer dark](global-ui-p2-evidence/head-drawer-320-dark.jpg) |
| Accounting Staff long scope and personal-work boundary | [768 scope light](global-ui-p2-evidence/accounting-scope-768-light.jpg), [desktop dark filters](global-ui-p2-evidence/accounting-filters-desktop-dark.jpg), [390 dark rows](global-ui-p2-evidence/accounting-mobile-dark.jpg) |
| Admin remains support-only | [Desktop light](global-ui-p2-evidence/admin-boundary-desktop-light.jpg), [mobile dark](global-ui-p2-evidence/admin-boundary-mobile-dark.jpg) |

The [capture manifest](global-ui-p2-evidence/screenshots.json) records dimensions and hashes. The corrected History panel measured bottom 884.4 px and Done bottom 869.6 px within a 900 px viewport.

## Remaining limits and next gate

P2's bounded local checks pass. Genuine hosted multi-account acceptance and Firefox remain unverified. The pre-existing build and Graphify warnings are recorded. P3 Inbox/Reviews, P4 Budget/Office tools, P5 Admin/Accounting duplicate controls, P6 Help and P7 final cross-system verification remain separate work. Per-phase visual improvements have been applied here; P7 is the final verification of those improvements. Do not start another phase until the preceding phase is validated and the user authorizes that phase.
