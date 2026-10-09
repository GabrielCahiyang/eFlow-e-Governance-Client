# R0 navigation and retirement contract

The current path encoder is `src/app/features/navigation/navigationUrl.ts`. Sections and page labels below are actual source contracts; future replacements are described separately. Preserve authorized browser Back/Forward, URL context, inspector origin, dirty guards, notification entity IDs and focus return while moving presentation.

## Global/Office/personal destinations

| Current section / path | Current discovery | Target home and compatibility behavior | Phase |
| --- | --- | --- | --- |
| `dashboard` / `/overview` | Head default, presented as Home | Workspace Overview using the same permitted Office data; preserve section/path, change its presentation group | R2/R10 |
| `command` / `/command-center` | Legacy role-specific Home/command source | Role-authorized landing; no unsupported legacy role is activated by the redirect | R2 |
| `personal_work` / `/my-work` | My Work aggregate | Canonical My Work; Assigned work/Leading/Subtasks/History discovery and date filters | R10 |
| `tasks` / `/tasks` | Head Tasks / Member My Tasks | Head Office tools → Tasks retained; personal assigned work links into My Work/inspector. Existing task deep links still resolve | R2/R10 |
| `leading` / `/leading` | Leading Work | My Work → Leading; retain contextual review/task links | R10 |
| `subtasks` / `/subtasks` | My Subtasks | My Work → Subtasks; stable IDs open descendant inspector after R7 | R10 |
| `deadlines` / `/deadlines` | Personal deadlines | My Work date filters/context action; preserve old authorized view until replacement has parity | R10 |
| `history` / `/task-history` | Task History | My Work → History; full history is distinct from the current Recently completed last-seven-days filter | R10 |
| `performance` / `/performance` | Performance | My Work contextual personal insights action; preserve retained metrics and permission | R10 |
| `reports` / `/reports` | Head Reports / Member Work Report | Workspace Office tools → Reports for Heads; contextual personal report for Members. Do not mix scopes | R10/R11 |
| `projects` / `/projects?page=Projects&project=<id>&view=<id>` | Workspace Projects tree/portfolio | Persistent selected workspace Projects; project ID and view maintained on authorized navigation | R2/R3/R4 |
| `budget` / `/office-budget` | Office Budget | Office tools → Office Budget; existing budget URL/view scope retained | R2/R11 |
| `team` / `/team-supervision` | Office Team/Team Supervision | Office tools → Office Team remains. Remove only the project sidebar Team Members duplication | R2/R7 |
| `identity` / `/identity-and-access` | Head Identity & Access | Retained authorized Office tool; global Admin access remains a separate surface | R2/R12 |
| `intelligence` / `/team-intelligence` | Head Team Intelligence | Retained authorized Office tool, not silently removed with Workload & Team | R2 |
| `inbox` / `/inbox` | Personal notifications/actions | Retain Inbox; new Head invitation requests deep-link to Members/Invitations after R8 | R8/R10 |
| `reviews` / `/reviews` | For Review / Leader Reviews | Retain reviewer queue and contextual review. Removing Approval Status does not remove work/financial reviews | R4/R6 |
| `announcements` / `/announcements` | Inbox/communication | Retained authorized Inbox destination | R2 |
| `settings` / `/settings` | Profile/Appearance/Notifications/Security | Retained utility; no grant changes from navigation | R2/R12 |
| `users` / `/users` | Admin Center All Users | Admin default remains People/All Users; settings/audit/support pages use existing authorized page resolution | R12 |
| `permissions` / `/permissions` | Role Defaults alias | Preserve role-default destination and Admin-only constraints | R12 |
| `org_tree` / `/organization` | Office Structure | Admin Center → Offices & leadership; preserve old Admin alias to `users` + Office Structure | R12 |
| `audit` / `/audit` | Account Audit | Admin Center → Audit; preserve support grant and old alias | R12 |
| `administration` / `/system-settings` | System Settings | Admin Center → effective settings; preserve old alias | R12 |
| `migration` / `/data-tools` | Backup & Export | Admin Center → Backup & export; preserve old alias/protections | R12 |
| `accounting_overview` / `/accounting-overview` | Accounting default | Retain Accounting Overview default; never replace with Office Head Overview | R2 |
| `accounting_releases` / `/voucher-cash-releases` | Voucher & Cash Releases | Retain Accounting releases/settlement | R2/R11 |
| `accounting_journal` / `/general-journal` | General Journal | Retain Accounting journal, scope and immutable posting rules | R2/R11 |
| `accounting_audit` / `/financial-audit-trail` | Financial Audit Trail | Retain independent financial audit; not merged into project Activity | R2/R11 |
| `accounting_budgets` / `/office-budget-ledgers` | Office Budget Ledgers | Retain Accounting scope; old department-budget-ledgers alias remains | R2 |
| Home global button | Calls role `getDefaultSection`; not a `/home` entity | Remove button on desktop/mobile. Head lands at Workspace Overview; Member My Work; Accounting Accounting Overview; Admin People. Unknown/old Home URLs resolve to authorized default | R2/R10 |
| Global Search button | Opens `NavigationSearchDialog`, not a persisted search entity | Remove global item; reuse authorized loaded-record search in workspace header/switcher. Do not claim server-wide search | R2/R3 |

`navigationUrl.ts` also contains historical path mappings outside active simplified-role candidates. They are compatibility data, not instructions to reenable obsolete roles/pages. Keep them until actual consumer searches prove retirement is safe.

## Complete project-view disposition

| View ID / source label | Target disposition | Retired-link/required-action replacement |
| --- | --- | --- |
| `tasks` / Main table | Keep | Aliases `work`, `main_table`, `main-table` keep resolving to `tasks` |
| `board` / Board | Keep | Preserve return to Main table and dirty editor state |
| `gantt` / Gantt | Keep | Schedule/date resolution stays here |
| `calendar` / Calendar | Keep | Preserve same task scope/inspector |
| `dashboard` / Project Dashboard | Keep | Separate from workspace Overview and project Overview |
| `offices` / Offices | Keep | Office participation, identity, responsibility and staffing remain reachable |
| `overview` / Overview | Keep/redesign | Safe fallback for retired general summary links |
| `timeline` / Timeline | Keep | Aliases `plan`/`delivery` stay schedule aliases, not sidebar Planning entries |
| `reports` / Reports | Keep/redesign | Existing authorized exports/receipts/evidence drill-through |
| `proposal_context` / Proposal Context | Keep conditional | Alias `proposal-context`; originating proposal/revision and authorized governance context |
| `activity` / Activity | Keep/redesign/page/print | Decision/audit navigation lands here with appropriate filter/entity context |
| `reviews` / Reviews | Keep | Task/subtask review within the project; finance routing stays distinct |
| `budget` / Budget Overview | Keep conditional | Cash/settlement and budget-readiness resolution |
| `readiness` / Readiness & closeout | Remove standalone tab/menu | Overview plus enabled View completion requirements panel; keep Head review/activation/closeout actions |
| `workload` / Workload & Team | Remove | Initially Offices/Overview; Members after R7. Aliases `people`/`team` migrate too |
| `signoff` / Approval Status | Remove standalone tab/menu | Project settings/requirements → authorized Governance action panel. Preserve proposal endorsement/quorum/final closeout operations |
| `evidence` / Evidence Register | Remove standalone tab/menu | Task inspector Files/Review; initially Overview/task detail, no nonexistent project Files tab |
| `decisions` / Decision History | Remove standalone tab/menu | Activity plus contextual proposal decision/history panel; preserve immutable records |
| `members` / Members | New optional view, R7 | One project roster with Invitations area; do not expose it before implementation |

Removal applies to catalogue, Add view, overflow, tab persistence, direct aliases, internal callbacks and guided-tour copy. It never drops database records or authorizes the fallback destination. If the replacement is not installed yet, use an existing authorized Overview/Offices/Activity/task context and explanatory message, not a blank tab or fabricated success.

## Sidebar and preference migration

| State/caller | Current source contract | Target migration |
| --- | --- | --- |
| Workspace identity | `EflowAppShell.workspaceName` derives from profile Office | R2 explicit Office Workspace label; R3 real IDs/types/current/recents |
| Office tools/projects host | `WorkspaceNavigationPanel` wraps tools/hosts the portalled project tree only under Projects | Persist context and disclosure across Office pages; selection highlights without unmounting |
| Projects/Favorites/Archived | `ProjectContextSidebar` disclosures; Archived nested under Projects | Separate icon-led sections; Projects default open; add/show/hide sections with ordering |
| Planning/Drafts/Waiting for approval | `planningView`, `onOpenPlanning`, counts and project/proposal dialogs | Retire discovery; preserve draft data and contextual proposal import/recovery, authorized proposal review and notification handoff |
| Team Members | Sidebar `members` projection | Retire duplicate; Members/Offices/profile context replace it |
| `eflow:navigation:v1:<user>:<context>` | Device-local favorites, pruned by loaded authorization | Migrate real Office context to verified workspace ID; scope per user/workspace. Never restore access from preferences |
| Same prefix `:disclosures` | Closed IDs include projects/favorites/planning/people | Remove retired IDs; add Office tools/Archived/section visibility/collapse with a versioned, validated schema |
| `eflow_project_views_<project>` | Optional tabs local per project, not per user | Filter retired IDs and active view; future key includes user/workspace/project. Import old values only after project authorization; do not merge accounts |
| `eflow_project_columns_<project>` | Hidden-column array; missing means all visible | R5 distinguish absent preference from explicit empty/all-visible preference; new compact default only for absent/malformed records |
| `eflow_project_table_layout_v1_<project>` | Widths version 1 | Keep widths and `effort` ID; rescope verified records in R3 without losing user choices |
| Invalid/inaccessible context | Unknown URL or revoked project | Safe authorized landing/access denial, prune stale preference, no title/data leakage |

Local preferences are not server-side workspace membership. A sharing shortcut may identify the shared project under a chosen workspace without changing its home or adopting that workspace's permissions. Workspace switching clears stale queries/subscriptions and cancels late results; dirty-navigation confirmation remains.

## Required readiness and closeout replacements

| Current check/action | Authoritative source | Required retained entry |
| --- | --- | --- |
| Structure/dates/budget review | `phase7_project_readiness`, `phase7_review_project` fingerprints | View completion requirements → Head review controls; Main table/Gantt/Budget resolutions |
| Activation | `phase7_activate_project` | Requirements/settings action, current server checks, no AI activation |
| Office identity/invitation/responsibility | Phase 6/6.5 Office workflows | Offices; Members/Invitations after their phases |
| Task/subtask execution/evidence | Completion blockers + task/subtask reviewer services | Task/subitem inspector → Details, Files, Submit/Review |
| Cash on current/deleted/cancelled work | Existing cash lifecycle/Accounting | Task Funding / authorized financial review / Accounting settlement; hiding work never settles cash |
| Governed proposal endorsements/closeout | Source proposal/governance workflows | Authorized contextual Governance panel from requirements/Proposal Context; keep decisions and quorum |
| Complete/archive | `get_project_completion_readiness`, `complete_project`, `archive_completed_project` | Same reason at header/sidebar; View completion requirements still opens when Complete disabled; fresh checks inside modal |

`readinessResolution` and `closeoutResolution` currently route to `signoff`; `ProjectReadinessPanel` also exposes review, activate and close actions. Their callers must migrate together in R4. `ProjectSettingsDialog` currently edits metadata only; its target requirements/governance entry is new UI work, not a capability already present.

## Caller register and regression obligations

- `features/navigation/{roleNavigation,sidebarContent,presentationNavigation,navigationPermissions,navigationUrl,RoleContent}` and `useRoleNavigationState`: role discovery, guards, paths and history.
- `features/app-shell/{EflowAppShell,components/GlobalNavigation,components/MobileNavigationBar,components/WorkspaceNavigationPanel}` and `features/projects/components/ProjectsWorkspace.tsx`: context composition and project portal.
- `features/guided-tours/tourCatalog.ts`, `GuidedTourProvider.tsx`, progress service and onboarding banner: update retired selector targets/copy/resumable page IDs; retain Help/profile setup.
- `features/notifications/navigation.ts`, `navigationIntent.ts` and intent consumers: retain stable entity IDs and legacy-label fallback. Accounting has a dedicated budget route, but several generic task/project helpers omit `accounting_staff`; audit/fix those caller gaps in the owning navigation/My Work slice rather than creating Admin operational rights.
- `features/invitations/components/AcceptInvitationPage.tsx`: current accepted project invitations navigate to `view=offices`; Office-member acceptance returns to role startup. New project-member acceptance must select a real workspace/project without exposing a token in storage/referrer/history.
- `ProjectCommandWorkspace`, `ProjectUtilities`, `ProjectHeader`, `ProjectContextSidebar`, `ProjectCompleteDialog`, project tools inspector and shared task inspector: migrate retired view callbacks while retaining completion/review entry points.

Acceptance includes all role landings, permission-denied URLs, old aliases, stale storage, Back/Forward/reload, dirty editors, nested overlay focus, notifications from retained records and invitations into the correct current context. Implement and test replacements before deleting legacy consumers.
