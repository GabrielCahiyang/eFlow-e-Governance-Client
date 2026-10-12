# Workspace context rails, switcher and nested subitems — source audit and proposed correction

Date: 2026-10-13, Asia/Singapore. Repository: C:/Users/james/projects/eflow-e-Governance-Project.

Status: **Source audit/proposal; application implementation awaits approval.** This follows the user's instruction to first provide the source-level cause, architecture, sequence and regression plan, then implement the approved correction. Reference screenshots establish presentation goals; they do not authorize additional monday.com modules, authority changes or deployment.

Baseline: clean working tree at HEAD `412c778b9769b955d22f884fde07a5817fced7f3` before this new report. The older NW9.7 validator verified its protected/output hashes before failing its historical HEAD assertion (`51f323d...` expected); the checkout has since been committed. Its historical manifest is unchanged. No branch switch, reset, commit, application-code, migration, hosted-data, account or invitation change occurred in this audit.

## Actual causes and affected components

| Concern | Actual source-level cause | Existing affected sources |
|---|---|---|
| Generic Subitems block | `SubitemRows` places the supported path inside a spanning table cell and `pt-nested-work`, then composes `TaskSubtasksWidget → WorkTree → WorkHierarchy → WorkTreeTable/WorkTreeMobileList`. `WorkTree` always adds a separate heading, help text, leaf-review summary and toolbar. The renderer has its own density/width rules rather than Main Table cell styles. Creation is behind Task work actions; there is no bottom add row in this supported renderer. | [SubitemRows](../../src/app/features/project-table/components/SubitemRows.tsx), [TaskSubtasksWidget](../../src/app/features/subtasks/components/TaskSubtasksWidget.tsx), [WorkTree](../../src/app/features/nested-work/components/WorkTree.tsx), [WorkHierarchy](../../src/app/features/nested-work/components/WorkHierarchy.tsx), [WorkTreeTable](../../src/app/features/nested-work/components/WorkTreeTable.tsx), [projectTable.css](../../src/app/features/project-table/projectTable.css), [tableLayout.css](../../src/app/features/project-table/tableLayout.css), [nestedWork.css](../../src/app/features/nested-work/nestedWork.css). |
| Duplicate workspaces | `WorkspaceSelector.groups` independently renders recent IDs, owned workspaces and non-owned workspaces. Recent IDs are never subtracted from the latter lists. One authorized Office therefore appears in Recent and Available. The current item already has `aria-current`/selected background, but no visible check/current marker. | [WorkspaceSelector](../../src/app/features/workspaces/components/WorkspaceSelector.tsx), [workspaces.css](../../src/app/features/workspaces/workspaces.css), [workspaceLocation](../../src/app/features/workspaces/workspaceLocation.ts). |
| Search/utility styling | `TextInput` applies a component focus ring while `globals.css` adds a focus-visible outline. The dropdown utility buttons do not have an explicit shared icon/text flex layout, so the Plus icon can appear on a separate line. Source contains one Create workspace button, not two separate create actions. | [FormField/TextInput](../../src/app/components/ui/FormField.tsx), [global focus rule](../../src/styles/globals.css), WorkspaceSelector/workspaces.css above. |
| Header positioning and misleading plus | `WorkspaceNavigationPanel` puts the selector first, with a Plus that opens **show/hide workspace sections**, not workspace creation. Search, overflow and collapse are together underneath. There is no top Workspace heading row. | [WorkspaceNavigationPanel](../../src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx), [navigationV2.css](../../src/app/features/app-shell/navigationV2.css). |
| Context leakage | `ProductivitySidebar` derives the correct group, but always mounts `WorkspaceNavigationPanel`. That component always renders its workspace header and appends `preference.value.sections` after its optional group-specific items. My Work and Inbox therefore still show workspace content. The defect is in composition, not the data API. | [ProductivitySidebar](../../src/app/features/app-shell/components/ProductivitySidebar.tsx), WorkspaceNavigationPanel above, [presentationNavigation](../../src/app/features/navigation/presentationNavigation.ts). |
| Return-to-context behavior | `selectGroup` prefers personal_work/inbox/projects, so returning normally chooses a default rather than the last accepted subdestination/project. Workspace display preferences are account/workspace scoped, but shared across primary groups. Inbox's Needs action/Updates selection is local component state, not a routed page. | ProductivitySidebar above, [useRoleNavigationState](../../src/app/features/navigation/useRoleNavigationState.ts), [navigationUrl](../../src/app/features/navigation/navigationUrl.ts), [workspacePanelPreferences](../../src/app/features/app-shell/workspacePanelPreferences.ts), [ActionCenter](../../src/app/features/action-center/components/ActionCenter.tsx). |

## Proposed context-rail architecture

Keep `GlobalNavigation` persistent. Extend the existing navigation feature's group mapping into the single authorized context descriptor: **current route → primary group → context composition and supported pages**. Retain `useRoleNavigationState`/navigationUrl as the route authority; do not add separate active-primary state.

Proposed NEW app-shell components (absent before this audit): `ContextRail`, `ContextRailHeader`, `MyWorkContextRail`, `InboxContextRail`. Refactor existing WorkspaceNavigationPanel into the Workspaces-only composition; keep any compatibility export until searches prove callers migrated. Other existing authorized groups (Accounting, Admin Center, Profile/Settings) use their own descriptor/content without inheriting workspace sections.

| Primary group | Context content | Supported current routes/pages |
|---|---|---|
| Workspaces | Workspace header/selector/create/search; Office or Workspace tools; Favorites, Projects, Archived projects. | Existing overview/projects and role-authorized Office destinations. Project deep links retain workspace/project/view/plans context. |
| My Work | One My Work header, Assigned work, Leading, Subtasks, History. | Existing `/my-work?page=...` pages. Legacy task/leading/subtask/history URLs and Work tools remain reachable and retain their existing content; no forced data-scope conversion. |
| Inbox | One Inbox header; Needs action and Updates; existing authorized Reviews and Announcements destinations. | Existing `/inbox`, `/reviews`, `/announcements`. Add validated Inbox page aliases for its two already-supported categories; legacy `page=Inbox` resolves to Needs action. |
| Other authorized groups | Their existing authorized pages and appropriate context header. | Existing Accounting/support/settings URLs unchanged. |

Make Inbox category selection URL-owned through the existing page contract and pass it from RoleContent to ActionCenter; remove competing local category state once migrated. Retain existing notification DOM anchors/focus restoration and review decision owners. Hide unsupported Reviews/Announcements entries according to current permissions; do not invent destinations for symmetry.

Store only last **accepted, authorized** destinations as display preferences keyed by authenticated account and primary group; scope workspace/project memories to their workspace. Validate pages, permissions and current project membership before restoration. Direct URL, Back/Forward and refresh take precedence. Denied/removed memories fall back to a valid destination. Preserve existing workspace/favorite/disclosure preferences. Keep Workspaces collapse preferences; add independent group collapse preferences for other rails without rewriting old keys. Do not store a second navigation authority.

My Work's existing `PersonalWorkWorkspace → useWorkFeed(userId) → loadWorkFeed(userId)` call remains unscoped. Its Office/personal aggregation must not receive the selected workspace as a new filter. Workspace selection may be retained internally while another context is displayed. Preserve existing Office switching needed by Office-specific routes.

## Workspace header and dropdown

Header hierarchy:

1. **Workspace** at left; overflow and collapse at right.
2. Strong active workspace selector at left; **Create workspace** Plus button at right, with an accessible label/tooltip.
3. Separate Search workspace trigger.
4. Divider, then existing authorized navigation groups.

Move show/hide section controls into the existing overflow actions. This preserves their functionality while giving the adjacent Plus the requested create meaning. Keep desktop collapse and mobile dismissal as separate behaviors.

Proposed NEW workspaces components/helper: `WorkspaceSwitcherControls` owns one creation dialog/handler shared by the header Plus and dropdown action; `workspaceChoices` derives unique visible records. Reuse existing WorkspaceSelector, WorkspaceCreateDialog, workspaceState.select/refresh and guarded writeWorkspaceLocation. No new workspace service or creation API.

Dropdown structure: labeled search → unique workspace list → divider → **+ Create workspace** → secondary **Refresh workspaces**. Render each workspace ID once. Show a visible checkmark/current marker plus `aria-current`. For five or fewer authorized choices, use one **Workspaces** section. For a larger list, Recent is optional only when it is a nonempty proper subset; subtract those IDs from the remaining list. During search, use a single filtered Workspaces list. Intersect stored recent IDs with currently authorized records and deduplicate; preserve the existing account-keyed recent/current storage contract and five-ID bound.

Use explicit flex utility rows, shared padding/height/hover tokens and a scoped single focus-ring treatment on this search input. Do not change all form controls globally. Preserve loading/error/empty states, focus return, Escape/Tab/arrow behavior and guarded context selection. A single workspace must not create redundant sections.

## Main Table subitems

Add a presentation-only `project-table` mode to the existing public TaskSubtasksWidget/WorkTree composition and pass it through WorkHierarchy. Refactor existing WorkTreeTable to support Main Table surface/density tokens and a footer affordance; proposed NEW `InlineWorkCreateRow` is a small nested-work presentation component. No new controller, copy of authority rules or direct database writer.

In this mode, keep the spanning child-table container under the parent task, with a compact indentation/connector and optional tinted group edge. Remove the repeated generic heading/help/leaf-summary wrapper from this table surface. Render native compact table rows with **Subitem, Lead, Contributors, Status, Due date, Progress, Actions**. Reuse existing WorkPeopleSummary, node status/date/progress presenters, WorkNodeActionMenu, disclosure controls and exact canonical IDs. Do not introduce financial/monday-specific columns or edit controls that bypass existing forms.

The root table footer contains **+ Add subitem** only when the current root's `create_child` capability is allowed. For nested branches, authorized child creation stays available in the existing row action menu, with a compact branch add row where the expanded child section is shown. Root and branch add must address `parent:null` versus the actual canonical parent ID respectively. Both invoke the existing guarded create editor, checked command/impact flow and draft recovery. Any initial inline title editor is a presentation of that same create draft, not a new legacy create API.

Keep bounded depth-eight traversal, ordering from the complete snapshot, prerequisites, historical context, collapsed state, exact-ID Inspector/Review callbacks and focus recovery. At narrow widths retain a horizontally scrollable nested table with reachable title/actions; preserve existing accessible mobile rendering outside Main Table. Cap visible indentation and retain full accessible paths without repeating them on every row. Errors/retry/recovered drafts remain visible when relevant, without permanent helper copy. Align excluded/proven-missing legacy table styling with the same surface while retaining its existing authority/API rules. Denied/expired/ordinary failures never trigger fallback.

## Capability verification and mismatches

These are **existing local server/source contracts**, not new role grants. Every allowed cell remains subject to current actor/root/project/Office/revision, membership, lifecycle, history/financial impact, depth, sequence, readOnly and fresh-controller checks. The server rechecks each command.

| Actor in the responsible Office | Root add row | Child creation/branch structure | People changes | Work updates |
|---|---|---|---|---|
| Eligible responsible Head | When root create_child allows it. | Within that Office's permitted task/branches, subject to individual capabilities. | Can appoint root Lead and govern eligible branch people. | Only where independently entitled to execute; Head status alone is not assignment. |
| Eligible Task Lead | When root create_child allows it. | Under the assigned task/allowed descendants. | Contributors and descendant appointments; replacing root Lead remains Head authority. | Assigned/appointed node execution only; no automatic execution of every descendant. |
| Eligible Subitem Lead | No root add by that appointment alone. | Own permitted branch/descendants; no ancestor or sibling authority. | Own/descendant contributors; own replacement requires an eligible ancestor/Task Lead/Head. | Own-Lead execution remains allowed even without worker-array membership, subject to prerequisites/state. |
| Contributor without another appointment | No. | No structural authority from contribution alone. | No staffing authority from contribution alone. | Assigned work only, subject to execute/submit and sequencing/review gates. |

Inspected operation_capabilities, manage/head, operation safety, checked commands and own-Lead execution corrections. Existing UI uses selectRootWorkCapability/selectNodeWorkCapability rather than broad role flags. **No server-authority mismatch identified in this inspected canonical path.** The missing visible add row is a discoverability mismatch. Root add must not be shown to a Subitem Lead merely because that person can add below their own node. Assigning Contributors and appointing Lead are separate capabilities; do not use the presence of either as permission for both.

The current adjacent header Plus is a verified interaction mismatch (section visibility instead of create). Context leakage, duplicated choices and competing Inbox category state are verified presentation/state problems. Existing tests do not establish the requested context isolation: the R2 tests focus on preserving workspace navigation across Office Tasks/Reports. Add new isolation tests rather than weakening that coverage.

Confirmed Office reviewer routing, submission ownership/history, personal independent review, evidence/Storage security and financial totals remain unchanged. No SQL/RLS/migration/API change is proposed. Live installation/acceptance remains a separate gate; local disposable SQL cannot prove deployment.

## Implementation sequence after approval

1. Capture the current checkout/baseline. Add route-to-context and deduplicated-workspace selectors plus regression tests for the reported defects, retaining existing route/public-export contracts.
2. Split primary/context compositions, make Inbox's existing categories use the route owner, and implement validated per-context restoration/collapse. Verify deep links, refresh, Back/Forward, dirty guards, permission/account/loading transitions and global My Work scope before styling further.
3. Refactor workspace header and dropdown; share existing create workflow across the two entry points, relocate section toggles, fix scoped focus/utility styling and current selection indication.
4. Implement Main Table subitem presentation mode and authorized root/branch inline add affordances through the existing hierarchy/controller/editor. Preserve standard Inspector/board presentations and excluded/missing-install compatibility.
5. Run required repository checks, SQL authority regressions and affected browser suites on the final build. Refresh local Graphify only after structural edits. Inspect screenshots in light/dark at 320, 390, 768 and 1440px; include keyboard/focus, independent scrolling and long labels. Produce a local handoff; no commit/deploy/hosted/account changes unless separately requested.

## Regression plan and audit evidence

Unit coverage: navigationV2, workspaceRefinementNavigation, navigationUrl, workspace membership/isolation, existing workspace switcher/create tests, nestedWorkCapabilities, nestedWorkHierarchy, projectSubitems and canonical entrance/draft tests. Add tests for one/small/large/recent/stale/search workspace sets, visible current choice, both create entry points, isolated group DOM and category URL synchronization.

Browser coverage: navigation-v2, workspace-refinement-r2/r3, phase3-project-table, phase12-shared-inspector, phase13-personal-work, phase5-project-import and workspace-refinement-r7. Verify the eleven requested navigation scenarios and Head/Task Lead/Subitem Lead/Contributor visibility, creation, staffing, structure and execution. Include responsible versus foreign Office Head, observer/expired/inactive accounts, actor switches, locked/history-bearing branches, depth eight, no-worker-array own Lead, empty tree, denied/offline/missing installation and uncertain retry. Assert zero unauthorized writes and unchanged complete sibling/parent IDs.

Audit commands (application code unchanged):

- `git status --short`: clean before this report; `git log -1 --format="%h %s"`: current HEAD shown above.
- `node test-results/nw97-document-check.mjs`: historical HEAD assertion failed after all protected/output hash checks passed; no old receipt or test was modified to force a pass.
- `npm.cmd run graph:query -- "How does the application shell choose the primary group and secondary context navigation, and how do project-table SubitemRows reach canonical hierarchy actions?"`: exit 0; bounded heuristic output, then actual source inspection. No graph refresh for this documentation-only audit.
- `npm.cmd test -- --run tests/unit/navigationV2.test.tsx tests/unit/workspaceRefinementNavigation.test.tsx tests/unit/nestedWorkHierarchy.test.tsx tests/unit/projectSubitems.test.tsx tests/unit/nestedWorkCapabilities.test.ts --maxWorkers=2`: exit 0; 5 files / 120 tests, 69.94s; ignored test-results/ui-context-audit-unit.log. These prove existing baseline contracts, not the unimplemented redesign.
- `npm.cmd run verify:nw-correction`: exit 0; 5,149 assertions, disposable database only, ignored test-results/ui-context-audit-sql.log. Covers branch/membership/own-Lead execution, review, history, financial guards and checked commands; native multi-session and genuine JWT/Storage transport remain separate gates.

Full check/test/build and browser acceptance are implementation gates, not claimed complete by this planning audit. The only deliverable changed here is this NEW report. Approval is requested because the user's final instruction explicitly says to implement the **approved correction** after the initial source-level deliverables.
