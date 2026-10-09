# R1 — Design consistency and scrolling foundation

Implemented locally on **7 October 2026 (Asia/Singapore)** against the R0 `r0-v1` contracts. This receipt covers the shared UI foundation; later navigation, table, inspector, report and Admin reorganizations retain their R2–R12 ownership. This is not a deployment or hosted acceptance receipt.

## Delivered changes

| R1 slice | Implementation and consumers |
| --- | --- |
| Shared foundation | Existing Figtree/teal tokens remain canonical. Added responsive content padding and the Info status tone; mapped Vibe layout/hover/canvas aliases to those same tokens. Shared workspace headers/actions wrap long content. Existing loading/empty/error and retry controls remain available. |
| Tooltips and accessible names | `WorkspaceTooltip` uses Vibe's focus/Escape handling and portal placement. `ActionMenu` and `WorkspacePopover` accept optional supplemental help while preserving native/Radix trigger refs, keyboard activation and focus return. Project Columns and actions use these adapters. `PeopleAvatarStack` supplies focusable named avatars and a visible People button that opens every name on click/tap, including overflow/missing identities. `ProjectParticipants` consumes it and retains source errors, retry, Office/contributor counts and identity warnings. |
| Height and scroll ownership | The shell's `main.eflow-app-shell__workspace` owns active-content vertical scrolling, including the retained onboarding banner. Role frames no longer allocate another viewport/scroller beneath it. Workspace navigation retains its separate vertical scroller. Project wrappers use natural height, shared padding and visible scrollbars; tables and Gantt keep horizontal scrolling locally. The mobile Gantt height cap is removed. Overview's grid shrinks correctly and its activity columns have a focusable local horizontal region. |
| Status/schedule contrast | Central project lifecycle/schedule/status labels retain their existing meanings and ARIA text. Vibe Label receives semantic foreground/background pairs for Info, Positive, Warning, Negative and Neutral. The hardcoded black-on-colored-label override is retired. Planning and On track remain distinct and readable in both resolved themes. |
| Retained generic surfaces | Tokenized project creation, context, tabs, Overview, calendar/timeline, tools-inspector, project-view and table neutral surfaces and controls. Extended existing neutral compatibility adapters into portaled inspectors. Dark input/neutral compatibility uses the teal foundation instead of a separate navy palette. Office/workflow Reports and Backup use shared page spacing; Admin frames no longer add padding outside their existing header/panels. My Work, review, team and other retained role surfaces inherit the same shell/control/neutral adapters. |

## Surface and caller inventory

| Surface | Current navigation/caller | R1 adapter/ownership; later phase |
| --- | --- | --- |
| Shell and desktop/mobile sidebar | `EflowAppShell` → `RoleContent`; `WorkspaceNavigationPanel` project portal | One active workspace scroller plus existing navigation scroller. Destinations/visibility unchanged; R2 owns navigation removal/persistence. |
| All project views | Head/Member/Accounting Projects → `ProjectsWorkspace` → `ProjectCommandWorkspace`; view catalog and existing aliases | Project shell, status, neutral/tab styling; local table/Gantt/Overview horizontal lanes. Existing core and optional views retained; R4/R5 own their redesign. |
| People and project actions | `ProjectCommandWorkspace` → `ProjectParticipants` / `ProjectUtilities` | Shared avatar/name/help adapters, existing actions/identity failure handling. No new membership or sharing authority; R7/R9 own those contracts. |
| Task and report inspectors | Project/table/Board/My Work → shared `InspectorPanel`; project tools inspector | Existing overlay layers, modal body scroller and dirty/focus protections retained. Portaled neutral styles now match the foundation; R6/R11 own content redesign. |
| Office/workflow/project Reports | Head Reports; employee/workflow report callers; project Reports/tool inspector | Shared spacing, table/control/theme adapters; all current exports and facts preserved. R11 owns report reorganization and paginated history. |
| My Work, Inbox, role/support surfaces | `RoleContent`, Head/Member/Accounting role routers | Shared shell, control states and neutral compatibility. Existing role/navigation checks retained; R10 owns My Work/Overview reorganization. |
| Admin Center, forms and Backup | Admin and explicitly granted support destinations → `AdministrationWorkspace` | Existing workspace header/tabs/form adapters; single outer padding owner and consistent portaled neutrals. R12 owns category/configuration work. |

No schema, RLS, migration, Python endpoint, service return value, account role, permissions, API payload, financial/evidence workflow or hosted configuration was changed. Existing sidebar destinations, readiness/lifecycle controls, onboarding and project views remain reachable. Original R0 and historical/live receipts are preserved.

## Verification

- `npm run check`: passed.
- `npm test`: passed, 215 files / 844 tests, including four new shared-presentation regression cases.
- `npm run build`: passed. Existing Vite static/dynamic import overlap and large shared-chunk warnings remain; this phase does not close the performance gate.
- Chromium browser regression: **82 distinct cases passed across separate runs**. The 57 existing compatibility cases in `design-system-foundation`, `phase10-project-workspace`, `phase18-surfaces`, `navigation-v2`, `foundation-admin-directory`, `admin-mobile-dialogs`, `phase12-shared-inspector`, and `phase13-personal-work` passed. The 11 `phase16-support-finance` cases passed separately. The final R1/project-controls run passed all 14 cases (11 new R1 cases plus three existing project-control cases).
- New R1 coverage: 320/390/768/1024/1440 px; shared-control light/dark/system resolution and actual project views in light/dark; 30 tasks/projects and long titles; contained horizontal scrolling; no nested active-view vertical scrollers; final content reachability; avatar/Columns focus, Escape and click/tap alternatives; 200% zoom-equivalent viewport; reduced motion. Existing selected suites cover dialogs, nested pickers, loading/empty/read failures, denied writes, draft retention, cancellation, focus return, role visibility, deep links and history.
- The Admin directory smoke now follows the already-existing dirty-form confirmation: Keep editing retains the failed draft, Discard closes it, and focus returns to Create user. The application guard is unchanged.
- The initial new scroll matrix exposed Overview minimum-width overflow and Gantt height/resize-handle overflow on phones. Both were corrected and the final matrix passed at every required width. Final browser verification used a dedicated stable frontend server, without source edits during the run.
- `npm run graph:update`: completed, 7,494 nodes. Reviewed warnings: 37 unsupported-extension files skipped and four existing TypeScript parser limitations (`guided-tours/index.ts`, `productivity/index.ts`, `ProjectTaskRow.tsx`, `work-templates/index.ts`). No deletion or forced smaller graph.

Browser records are synthetic and backend requests are intercepted. These tests establish local presentation/workflow regression evidence, not genuine hosted RLS, provider delivery or production scale acceptance. Firefox/WebKit and an actual hosted/operator acceptance run are outside this local receipt. The existing performance gate and Phase 6.5 open acceptance items remain open.

## Retained visual evidence

Representative synthetic records, visually inspected after rendering:

- [320 px, light shared controls](r1-foundation-evidence/r1-320-light-controls.png)
- [390 px, dark shared controls](r1-foundation-evidence/r1-390-dark-controls.png)
- [1440 px, dark shared controls](r1-foundation-evidence/r1-1440-dark-controls.png)
- [1440 px, system theme and final real content](r1-foundation-evidence/r1-1440-system.png)
- [Actual project Overview, dark](r1-foundation-evidence/r1-project-overview-dark.png)
- [Actual project Gantt, dark, final task row](r1-foundation-evidence/r1-project-gantt-dark.png)
