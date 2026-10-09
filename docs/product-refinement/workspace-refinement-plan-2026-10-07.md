# eFlow workspace refinement — phased implementation plan

Prepared **7 October 2026 (Asia/Singapore)** against repository commit `d13714628ba19f09f1226812f10bffb17bdcb854`.

**Roadmap status:** R0's source audit and contract freeze is delivered in the [R0 scope/contracts package](r0-scope-contracts/README.md), with [verification receipt](r0-scope-contracts/delivery.md). R1 is implemented and verified locally in the [foundation delivery receipt](r1-foundation-delivery.md). R2 is implemented and verified locally in the [navigation delivery receipt](r2-navigation-delivery.md). R3 is implemented and verified locally in the [workspace delivery receipt](r3-workspace-delivery.md), with an additive migration prepared but not applied. R4 is implemented and verified locally in the [project refinement receipt](r4-project-delivery.md). R5 is implemented and verified locally in the [table refinement receipt](r5-table-delivery.md). R6 is implemented and verified locally in the [inspector receipt](r6-inspector-delivery.md), with an additive file-library migration prepared but not applied. R7 is implemented and verified locally in the [Members/hierarchy receipt](r7-members-hierarchy-delivery.md), with an additive migration prepared but not applied. R8 is implemented and verified locally in the [project invitation receipt](r8-invitations-delivery.md), with an additive migration prepared but not applied; verified-sender and genuine mailbox acceptance remain open. R9 is implemented and verified locally in the [access lifecycle receipt](r9-access-delivery.md), with an additive migration prepared but not applied. R10 is implemented and verified locally in the [work refinement receipt](r10-work-delivery.md). R11 is implemented and verified locally in the [Reports/Activity receipt](r11-reports-activity-delivery.md), with an additive Activity migration prepared but not applied. R12 is implemented and verified locally in the [Admin/configuration receipt](r12-admin-delivery.md), with an additive presentation-settings migration and gateway endpoint prepared but not deployed. R13 local release verification and rollout preparation are implemented in the [release receipt](r13-release-delivery.md); full release acceptance remains open. R0 changes documentation; R1 changes shared UI presentation/scrolling; R2 changes navigation/proposal discovery; R3 adds separate personal workspace authority and scoped work while preserving Office contracts; R4 simplifies project presentation and retains lifecycle prerequisites; R5 adds compact table defaults, supported column discovery and persisted date-save closing; R6 focuses the inspector and adds an authorized private project library; R7 adds project Members, selected-person staffing and bounded delegated work with checked server authority. None of these deliveries deploys, sends invitations, configures providers or certifies hosted acceptance. The pasted request and four attached screenshots define this refinement scope. Earlier briefs and delivery documents are baseline evidence, not additional instructions to execute.

The phase IDs **R0–R13** belong to this new refinement program. They do not renumber or overwrite the historical Phase 1–18 plans, receipts, or acceptance status.

## 1. Intended result and planning assumptions

The result is a simpler workspace experience using eFlow's existing Figtree, teal, Vibe, semantic tokens, and shared controls: a persistent workspace sidebar; compact editable task tables; Updates, Files, and Activity in task details; project-scoped people and invitations; clear sharing permissions; consistent Reports, My Work, Overview, and Admin Center; and predictable scrolling.

These interpretations make the requested behavior concrete. The delivered [R0 decisions and authority register](r0-scope-contracts/decisions-and-authority.md) freezes their target defaults for dependent implementation:

| Wording in the request | Proposed implementation contract |
| --- | --- |
| Due date should be gone after saving | Close the date **picker** after a successful save. Keep the saved date visible in the cell. Failed saves retain the picker, draft, and error. |
| Rename Effort | Use **Estimated hours**, because the persisted value is `estimated_hours`. Retain the internal column ID and API field. |
| Remove Planning, Drafts, Waiting for approval | Remove those sidebar sections/destinations. Keep the project lifecycle status **Planning**, existing records, dirty-draft protection, and required work/finance review rules. The requested pre-send invitation approval remains in Members/Invitations. |
| Remove Team Members | Remove the sidebar section. Project-specific membership remains available through the new Members view and retained Project Offices workflow. |
| A loop of subitems | Support nested subitems with contextual leads and delegation down a tree. Reject cycles and self-parenting. Set a tested depth/scale limit; do not promise unlimited recursion. |
| Invite outside the system | An authorized owner creates an invitation **request**; the responsible Head approves before an invitation is dispatched. Approval does not itself complete onboarding or assign the person. |
| Job Order, OJT, or other types | Treat engagement type as membership metadata, separate from account role and project permissions. Define configurable labels and access-end rules. |
| Account expires when project ends | End the temporary member's access to that project on completion/archive or the configured end date. Preserve their identity, authorship, and unrelated memberships. Global account deactivation is a separate explicit administrative action. |
| Upload or insert files for global use | Proposed meaning: reusable files within the authorized project/workspace. Confirm the sharing boundary before implementing a library; never expose private PDS or restricted evidence through it. |
| Share link with viewing/editing role | Head-controlled, authenticated access grants with explicit Viewer/Project member permissions. A copied URL alone does not confer access. |
| Remove Home | Move the authorized Office/workspace summary into **Workspace Overview**. Keep project Overview distinct. Choose appropriate Admin/Accounting landing destinations. |
| Everything configurable in Admin Center | Build a finite setting-to-runtime-consumer inventory. Expose effective controls and redacted integration diagnostics; define backend work for new controls rather than presenting saved but ineffective settings. |

The screenshots are interaction references:

- **Image 1:** Owner people picker, selected people, and an Invite by email action. The pictured Auto-assign feature is outside this request.
- **Image 2:** Searchable, icon-led Add column catalogue. Use supported eFlow fields; the screenshot does not authorize adding Formula, Connect boards, AI extraction, or arbitrary custom field types.
- **Image 3:** Compact group header, disclosure, editable name, color, and task/subitem counts. Keep meaningful group names; remove redundant metadata from the task inspector.
- **Image 4:** Workspace switcher, recents/current workspace, search, collapse, overflow, and adjacent add control. Keep eFlow's own navigation and design system.

## 2. Verified baseline and important gaps

Graphify's summary was read once and focused queries identified the shell, table, project-view, membership, and administration clusters. Its report stamps `a16d36e0`, which predates this plan's source commit; current source, migrations, tests, and the dated live addendum were therefore inspected directly. The graph is a navigation aid, not permission or deployment proof. No graph rebuild is needed for this documentation-only change.

| Area | Current source evidence | Consequence for the plan |
| --- | --- | --- |
| Workspace/sidebar | `features/app-shell/EflowAppShell.tsx`, `components/WorkspaceNavigationPanel.tsx`, project `ProjectContextSidebar.tsx` | The workspace label comes from the user's Office. No independent persisted personal workspace model was found. Office tools and the project host change/unmount when leaving Projects. |
| Table | `features/project-table/components/TimelineCell.tsx`, `hooks/usePlanningEditor.ts`, `types.ts`, `hooks/useTableLayout.ts` | Saving dates leaves the picker open. All nine optional columns are initially visible. A toolbar visibility checklist exists; a trailing Add column catalogue does not. |
| Inspector/files | `features/task-inspector/components/TaskInspector.tsx`, task discussion/progress/submission services | Overview/Activity/Discussion/Evidence and conditional Review exist. Comments and workflow attachments exist; a general reusable file library is new work. |
| Ownership | `features/tasks/selectors/teamMembership.ts`, Phase 6 SQL guards | Existing Task Leads have contextual contribution and subtask authority. Shared task owner/employee-team changes are responsible-Office-Head controlled. Delegated subitem lead promotion and recursive hierarchy are new capabilities. |
| Invitations | `server/routers/invitations.py`, `server/invitations/service.py`, `features/invitations/types.ts` | Current Head-created invitations dispatch immediately. Owner requests requiring pre-send Head approval, engagement types, and project access expiry are missing. |
| Membership | `features/project-offices/selectors.ts`, `components/OfficeMembersEditor.tsx`, Phase 6 `phase6_set_members` | Project Office selection exists, but lead-Office eligibility also admits active Office personnel. Removal is blocked for unfinished assigned work. Requested project-only membership and confirmed automatic unassignment need explicit policy/API changes. |
| Sharing/lifecycle | project `ProjectUtilities.tsx`, `ProjectCompleteDialog.tsx`, `services/projectLifecycleService.ts` | Share copies a normal URL without a role grant. Completion validation and archive blockers exist. Required readiness/evidence actions must remain reachable after standalone view removal. |
| Activity | `ProjectActivityTab.tsx`, `services/projectActivityService.ts`, `selectors/projectCommandSelectors.ts` | The UI renders the loaded merged feed without paging/print. Audit loading caps at 250 and errors become an empty list. UI paging alone cannot provide complete history. |
| Reports | project `ProjectReportsTab.tsx`, `features/reports/components/HeadReportsWorkspace.tsx`, workflow `ReportsWorkspace.tsx` | Existing exports, financial summaries, evidence, and receipts must survive visual changes across both project and Office surfaces. |
| Admin | `features/administration/components/AdministrationWorkspace.tsx`, `components/SuperAdmin/SystemSettings.tsx` | People, Offices, Roles & Access, Audit, System, and Backup exist. Some saved settings lack demonstrated runtime consumers. Email uses server environment configuration, not browser settings. |

**Controlling hosted baseline:** [Phase 6.5 live addendum, 7 October 2026](../phase65-live-deployment-2026-10-07.md). Phase 6.5 is installed on **`ixnfphgjyelhckjwjkdv`**. Genuine invitation-expiration acceptance and stable cross-Office browser acceptance remain open. External email delivery and public frontend/gateway hosting are not certified. Current Task Lead contribution/subtask behavior is verified; this does not grant general shared-task management. Older rehearsal destinations and older G2 descriptions must not be treated as current completion evidence.

## 3. Phase order and dependencies

Each phase is split into small vertical slices. A presentation slice may finish before a backend-dependent capability in the same phase, but the phase cannot be called complete while a required capability remains undelivered.

| Phase | Outcome | Depends on | Change class |
| --- | --- | --- | --- |
| R0 | Scope, authority, data, and navigation contracts | Current source/addendum | Planning and baseline |
| R1 | Shared visual and scrolling foundation | R0 | UI |
| R2 | Persistent workspace sidebar and simplified navigation | R0–R1 | UI/navigation |
| R3 | Persisted Office/personal workspace separation | R0; R2 composition | Schema/API/authorization + UI |
| R4 | Project Overview/header/view simplification | R1–R2 | UI; retained lifecycle contracts |
| R5 | Compact task table and inline editing polish | R1; R4 project context | UI |
| R6 | Updates, Files, Activity task inspector | R1; R5 table integration; R3 before personal/workspace library scope | UI; storage/API for reusable library |
| R7 | Project Members and delegated nested work | R0; R4–R6 integration | Schema/API/authorization + UI |
| R8 | Head-approved external invitations and reliable onboarding | R0; R7 membership contract; R3 before personal-workspace invitations | Schema/API/authorization + provider setup |
| R9 | Role-based sharing, removal, and access lifecycle | R7–R8; R3 for personal scope | Schema/API/authorization + UI |
| R10 | My Work and workspace Overview redesign | R1–R4; R6 inspector; R7/R9 for final descendant/access acceptance | UI; R7 integration for descendants |
| R11 | Reports redesign and paginated printable Activity | R1; R4/R6 scope; R7 for descendant acceptance | UI + paginated history contract |
| R12 | Admin Center and effective configuration | R0–R1; R8/R9 contracts | UI + approved configuration APIs |
| R13 | Integrated acceptance and controlled rollout | All required preceding phases | Verification/release |

After R0/R1, R2 and R5 preparation can proceed alongside backend contract design for R3/R7/R8. R10/R11/R12 presentation work can proceed in parallel after shared controls stabilize. Do not enable a creation, delegation, sharing, or invitation action before its server contract passes.

## R0 — Freeze scope and capability contracts

**Goal:** Make removals, replacements, and new authority explicit before changing callers or persistence.

**Delivery:** [R0 package](r0-scope-contracts/README.md), contract version `r0-v1`, source-audited 7 October 2026. Its decision, navigation, data/API, settings/surface and phase/test registers satisfy the R0 scope. Target policies are frozen; new UI/backend capabilities remain owned by their later phases.

**Implementation slices**

1. Record current navigation entries, project view IDs/aliases, persisted tabs, guided tours, notification links, account-role access, and service callers. Map every removed destination to a retained authorized destination.
2. Freeze proposed contracts for personal workspaces; project membership; contextual Task/Subitem Leads; invitation request approval; engagement type/end date; Viewer/member links; nested completion; and reusable files.
3. Define a role/action matrix for Admin, Head, Accounting Staff, Member, Task Lead, Subitem Lead, Observer, inactive/expired users, responsible Office, collaborating Office, and unrelated projects. Account roles remain unchanged.
4. Inventory current system settings and legacy visual surfaces across retained views. Record each setting's storage, actual consumer, permission, validation, audit, restart requirement, and owner.
5. Identify retained readiness actions, work review, evidence review, and financial blockers. Decide their replacement entry points before removing old views.

**Frozen contract choices:** See R0 D06–D21 for depth-8 nesting, descendant-only delegation/root Head appointment, separate descendant/manual progress, review ownership, personal scope and sponsoring Head, project-only reusable files, 7-day share redemption with 1–30-day bounds, temporary/permanent access, engagement labels and effective administrative controls. Physical schemas, concrete API implementations and supported scale still require their owning-phase proofs; these policies are not claims of installed backend capabilities.

**Acceptance:** A complete current-to-target route/view map; role/action allow-deny matrix; storage/API change inventory; bounded per-phase source/test list; no request item without an owning phase. Existing Office/financial rules are separated from explicitly requested new capabilities.

## R1 — Design consistency and scrolling foundation

**Goal:** Establish reusable styling and predictable layout before individual overhauls.

**Delivery:** [R1 foundation receipt](r1-foundation-delivery.md), implemented locally 7 October 2026. Shared semantic styling, Vibe help/name adapters, scroll ownership and retained-surface adapters are delivered with unit/browser regression evidence. Later-phase navigation removals, feature redesigns and hosted acceptance retain their original ownership.

**Implementation slices**

1. Extend existing `foundation-tokens.css`, `workspace-foundation.css`, Vibe theme adapters, and shared workspace primitives. Reuse Figtree, teal identity, semantic surfaces/status colors, layer tokens, focus patterns, and loading/empty/error states.
2. Adopt Vibe Tooltip conventions for Add column, avatars, workspace actions, and icon-led sections. Supply keyboard-accessible labels and touch alternatives; essential explanations must also be visible without hover.
3. Trace shell → role content → project view and sidebar height ownership. Define one intentional active-content vertical scroller, a separate sidebar scroller, and local horizontal table scrolling. Correct nested height/padding/min-height issues per layout; remove artificial bottom space.
4. Correct centralized project status/schedule presentation, including On track beside Planning, in light/dark/system themes. Avoid forcing black text over colored badges or relying on color alone.
5. Inventory and migrate remaining legacy generic UI in retained reports, inspectors, project views, My Work, administration, and other audited surfaces using the same adapters.

**Source anchors:** `features/app-shell/eflowAppShell.css`, `features/navigation/RoleContent.tsx`, `features/projects/components/projectsVibe.css`, `styles/foundation-tokens.css`, `styles/workspace-foundation.css`, `shared/vibe/`, `components/ui/workspace/`, project `presentation/projectPresentation.tsx`.

**Acceptance:** At 320, 390, 768, 1024, and 1440 px, each retained view and sidebar reaches its final real content without clipping, page-wide horizontal overflow, or unused viewport padding. Verify long content, long names, empty states, keyboard focus, nested popovers, dialogs, 200% zoom, reduced motion, and badge contrast in both themes.

## R2 — Persistent workspace sidebar and navigation cleanup

**Goal:** Make the sidebar behave like the fourth reference image while preserving supported destinations.

**Delivery:** [R2 navigation receipt](r2-navigation-delivery.md), implemented locally 7 October 2026. Persistent Office/project navigation, section controls, scoped preferences, contextual proposal actions, navigation retirement and role/history compatibility are delivered with unit and Chromium regression evidence. R3 workspace persistence and R10 content redesign retain their ownership.

**Implementation slices**

1. Replace Current context/LEDIPO/Workspaces explanatory copy with an explicit **LEDIPO Workspace** selector. Add workspace search, overflow menu, and collapse `<<`/restore controls. Clearly distinguish search from the workspace selector.
2. Keep Office tools, Favorites, Projects, and Archived projects in a persistent workspace panel independent of the selected page. Use icon-led disclosure buttons. Projects starts expanded; clicking Tasks changes its highlight while Office tools remains expanded.
3. Add the adjacent `+` section chooser: show/hide supported sections, place newly added sections below existing ones, and preserve their subitems. Keep workspace creation as an explicit selector/menu action so the two add functions are not ambiguous.
4. Remove sidebar Planning/Drafts/Waiting for approval and Team Members; remove the global Home and Search items, including mobile variants. Workspace search remains available. Move required team/invitation actions into their authorized replacement homes.
5. Remove the Make yourself at home/Getting Started progress card. Preserve invitation onboarding, required profile completion, help, and first-run functionality that the request does not remove.
6. Update landing pages, old Home/search URLs, browser history, guided tours, notification destinations, and preferences. Scope disclosure/favorites/section visibility per user and workspace; do not leak selected project context between workspaces.

**Source anchors:** `features/app-shell/EflowAppShell.tsx`, `components/GlobalNavigation.tsx`, `MobileNavigationBar.tsx`, `WorkspaceNavigationPanel.tsx`, `features/navigation/`, `components/Layout/coreWorkflowNavigation.tsx`, project `ProjectContextSidebar.tsx`, `navigationPreferences.ts`, `features/onboarding/components/OnboardingWorkspace.tsx`.

**Acceptance:** Desktop/mobile contain no removed menu entries or banner. Office tools and the project tree persist across Tasks/Reports and project selection. Collapse/restore, search, section add/hide, favorites, refresh, Back/Forward, dirty navigation, and role-specific landing work. Until R3 passes, the selector lists only real supported contexts and does not present an ineffective personal-workspace creation action.

## R3 — Real personal workspaces and project isolation

**Goal:** Let a user maintain personal projects outside LEDIPO without treating a display filter as an access boundary.

**Delivery:** [R3 workspace receipt](r3-workspace-delivery.md), implemented and verified locally 7–8 October 2026, with [schema/API/backfill/rollback review](r3-workspace-schema.md). The local backend gate passes disposable authenticated PostgreSQL tests; personal creation, membership/review/closeout, selector, scoped routes/caches and Office compatibility are delivered. The additive migration and genuine hosted acceptance remain pending. R6 files, R8 sponsored external invitations and R9 sharing/access terms retain their owning phases.

**Implementation slices**

1. Design an additive workspace identity, owner/membership, workspace kind, and project-placement model. Link Office workspaces to canonical Offices without mutating Office affiliation. Define exactly one authoritative placement rule and how explicitly shared projects appear.
2. Backfill existing Office projects deterministically. Preserve IDs, tasks, Office responsibility, evidence, grants, and integrations. Specify safe handling for missing/multiple Office relationships and rollback before migration.
3. Implement server-scoped list/create/select/membership operations and RLS. A personal workspace owner is a contextual authority, not an Office Head or new global account role. Define personal project creation and review capabilities explicitly; keep Office governance/finance behavior compatible.
4. Integrate available workspaces, current selection, recents, My workspaces, search, and Create workspace into R2. Make name/owner/type clear during project creation so unrelated projects cannot silently enter LEDIPO.
5. Scope routes, caches, queries, realtime subscriptions, favorites, table preferences, and selected projects by workspace. Clear stale content during switching and membership revocation.

**Acceptance:** A personal project stays out of the LEDIPO project tree unless explicitly shared under the approved contract. Unrelated users cannot enumerate/read/write it through UI, REST/RPC, files, or realtime. Switching/reload retains the correct workspace without stale rows. Existing Office projects and shared-Office workflows behave as before. Creation failures leave no partial workspace/project membership.

**Backend gate:** Reviewed additive schema/API/RLS and backfill tests. Office-context naming in R2 is not completion of R3. Personal review/closeout behavior must be specified and tested rather than inheriting Head privileges accidentally.

## R4 — Project header, Overview, and retained views

**Delivery:** [R4 project refinement receipt](r4-project-delivery.md), implemented and verified locally 8 October 2026. Compact header/participants, redesigned Overview, retired-view migration, shared completion availability and retained plan reviews/activation are delivered with unit and Chromium regression evidence. Existing database/service authority and hosted acceptance status are unchanged.

**Goal:** Remove clutter while preserving necessary project operations.

**Implementation slices**

1. Delete the entire header strip containing Project Offices, Readiness & closeout, and its explanatory text. Keep Project Offices reachable through its retained view/context action.
2. Replace the joined-Office/contributor/name sentence with profile avatars, initials fallback, overflow count, and Vibe name tooltips on hover/focus. Show an accessible textual description and useful empty/loading/error state.
3. Redesign project Overview around purpose, progress, upcoming/overdue work, responsible people, and existing authorized summary facts. Reuse R1 patterns; avoid repeating table controls or a large readiness banner.
4. Remove **Workload & Team, Readiness & closeout, Approval Status, Evidence Register, and Decision History** from tab bars, Add view, overflow, render branches, saved view preferences, and old URL aliases. Add Members in R7. Initially migrate retired links to existing Overview/Activity/Offices or authorized task review; use Members/Files destinations only after their phases deliver them. Do not expose new authority through redirects.
5. Give every Mark project complete entry the same availability calculation and visible reason as Archive. Disable completion while known blockers, loading, or failed validation make it unavailable. Keep the Head-only completion modal, fetch fresh authoritative blockers when opened, and enforce them server-side.
6. Relocate required Head readiness checks/resolution into the retained completion modal or compact Project settings workflow. Keep an authorized **View completion requirements**/Project settings action enabled even while Complete is disabled, so the Head can resolve blockers. Evidence/work approval remains reachable through authorized task review; decision/audit history remains in Activity. Removing tabs must not strand prerequisites.

**Source anchors:** project `ProjectHeader.tsx`, `ProjectParticipants.tsx`, `ProjectOverviewTab.tsx`, `projectViewCatalog.ts`, `ProjectViewTabBar.tsx`, `ProjectCommandWorkspace.tsx`, `ProjectContextSidebar.tsx`, `ProjectUtilities.tsx`, `ProjectCompleteDialog.tsx`.

**Acceptance:** Removed labels do not reappear through stored tabs or deep links. Avatar names are available by keyboard. All completion entry points show accurate reasons; eligible completion still works; directly opened modal refuses unauthorized or blocked completion. Archives, evidence, reviews, cash/governance obligations, and existing data remain intact.

## R5 — Compact task table and editing behavior

**Goal:** Apply the first three screenshot patterns to eFlow's supported task data.

**Implementation slices**

1. Close Timeline/Due date editing only after a successful persisted save, restoring focus to the cell. Use an explicit date-editor success policy rather than changing shared number/dependency editors unintentionally. Preserve start/end/dependency validation, pending protection, and failed drafts.
2. Rename Effort to **Estimated hours** across headers, accessible names, group summaries, tooltips, and relevant import/edit copy. Keep `effort` preference identity and `estimated_hours` payload unchanged.
3. For users without an explicit saved layout, default to **Task, Owner, Status, Due date, Priority**. Preserve saved visibility/width preferences; offer an explicit Reset to compact defaults action. Avoid stretching a short table just to fill the viewport.
4. Add a trailing table-header `+` with **Add column** tooltip, accessible name, and searchable icon catalogue. List currently hidden supported fields: Office, Owner, Status, Priority, Timeline/Due date, Estimated hours, Dependencies, Budget estimate, Progress. Mark already visible fields appropriately and explain when all are visible. Synchronize visibility across groups and retain the toolbar customization path.
5. Refine group headers with collapse, editable title, color, task and subitem counts. Keep existing group operations and task/subitem inline creation. Integrate R7's owner picker when its capability contract is ready.

**Source anchors:** `features/project-table/types.ts`, `components/TimelineCell.tsx`, `hooks/usePlanningEditor.ts`, `columnLayout.ts`, `hooks/useTableLayout.ts`, `TableToolbar.tsx`, `ProjectGroupTable.tsx`, `ProjectTaskCells.tsx`, `SubitemRows.tsx`.

**Acceptance:** Successful date save closes once and preserves the date after reload; denial/network failure retains edits; duplicate submit produces one attempt. Compact defaults and existing layouts both work. Add column supports mouse/keyboard and never offers unsupported types. Retain sticky task actions, resizing, filtering, sorting, blur/Shift+Enter creation, failed draft retention, empty groups, and local horizontal scrolling.

## R6 — Task inspector: Updates, Files, Activity

**Goal:** Make task details focused and useful without losing execution/review controls.

**Delivery:** [R6 inspector receipt](r6-inspector-delivery.md), implemented and verified locally 8 October 2026, with [reviewed project file contract](r6-files-contract.md). Three primary tabs, expandable Details, contextual review, workflow evidence and the private project library pass local unit, Chromium and disposable SQL gates. Existing inspector origins and personal scope remain covered. R3/R6 additive migrations and genuine hosted Storage/session acceptance remain pending; recursive work hierarchy retains R7 ownership.

**Implementation slices**

1. Simplify the header to the task title and necessary actions. Move repeated To Do/high/Office/description metadata into a compact expandable Details section. Keep status, priority, schedule, Office, team, subitems, dependencies, budget, progress, submission, and authorized lifecycle controls reachable.
2. Replace the primary Overview/Discussion/Evidence arrangement with **Updates**, **Files**, and **Activity**. Updates reuses comments/discussion, mentions where supported, and relevant progress updates. Activity preserves chronological immutable task history. Review remains available to eligible reviewers through a contextual action/panel or existing review destination.
3. Build Files first over existing authorized progress/submission attachments, including subtask evidence, showing their source, uploader, date, and workflow restrictions. Current comments are text-only. Preserve private signed access and immutable approved evidence.
4. Add standalone uploads and reusable project-file insertion only after a file-metadata/storage contract exists; comment attachments, if included, also require this new workflow. Define visibility, file size/type limits, duplicate/retry behavior, provenance, deletion authority, and the difference between general documents and formal evidence. Reuse uploads without making one file public or altering submitted evidence.
5. Preserve shared inspector behavior across table, board, calendar, timeline, reports, My Work, and subitem callers: originating view/selection, deep links, focus return, nested panels, and dirty guards.

**Source anchors:** `features/task-inspector/components/TaskInspector.tsx`, `InspectorHeader.tsx`, `InspectorSummary.tsx`, `InspectorTeam.tsx`, `InspectorEvidence.tsx`, workflow `TaskDiscussion.tsx`, `TaskActivityTimeline.tsx`, `ProgressUpdateForm.tsx`, `SubmitForReviewForm.tsx`, reviews `TaskReviewPanel.tsx`, `services/taskDiscussionService.ts`.

**Acceptance:** Existing comments, history, files, submissions, and authorized review actions remain usable under each actor role and archived state. New files cannot bypass project/storage permissions; private PDS never appears. Closing/navigating respects unsaved changes; upload retry does not duplicate a successful object or metadata row. No redundant inspector tabs remain.

## R7 — Project Members and nested lead delegation

**Delivery:** [R7 Members/hierarchy receipt](r7-members-hierarchy-delivery.md), implemented and verified locally 8 October 2026, with [membership/hierarchy contract](r7-members-hierarchy-contract.md). Members, narrow contributor rights, depth-8 delegation, current independent reviews, descendant adapters and compatibility pass unit, Chromium and disposable SQL gates. R3/R6/R7 additive migrations remain unapplied; genuine hosted/session/Storage acceptance remains pending. R8 invitations and R9 integrated sharing/removal/renewal retain their owning phases.

**Goal:** Allow project-scoped staffing and delegated work while defining the new authority precisely.

**Implementation slices**

1. Add **Members** to Add view as a project-specific people page: selected members, Office, engagement type, contextual responsibility, access state, and permitted member actions. Keep Project Offices for Office participation/responsibility; both surfaces use one membership source instead of separate rosters.
2. Change Head selection of own-Office personnel to affect only the selected project. Resolve the existing lead-Office eligibility exception explicitly in UI and server policy; safely backfill/preserve current assigned people before enforcing project membership.
3. Add empty-Office guidance: if no eligible staff are onboarded, show Add existing member/Invite member according to authority and explain why assignment is unavailable. Do not create a fake owner or silently assign the Head. Apply to LEDIPO and every Office.
4. Add an owner picker on tasks and subitems using selected-person chips, eligible project people, clear lead/member affordances, and R8's Invite by email action. Support the requested owner/lead adding eligible members to their controlled work. Preserve existing contribution and subtask rights while delivering an explicit narrow server change for previously Head-only team edits.
5. Extend flat subitems into a parent-child tree under one project/root task. Add contextual Subitem Lead assignment and delegation to descendants. A child lead may organize its branch, never an ancestor, sibling branch, other Office, or unrelated project. Proposed default: the Head appoints the root Task Lead; that lead appoints child leads. Any root-lead self-replacement rule must be explicit in R0.
6. Define and implement cycle/depth guards, sibling ordering, reparenting permissions, ancestor deadline constraints, dependency semantics, progress aggregation, submission/review responsibilities, subtree deletion, and completion/archive checks. Extend reports, My Work, activity, imports, templates, and notifications that currently assume flat subitems.

**Source anchors:** `features/project-offices/`, `features/tasks/selectors/teamMembership.ts`, task inspector `InspectorTeam.tsx`, `TaskInspector.tsx`, `services/subtaskService.ts`, `features/project-table/components/SubitemRows.tsx`; Phase 6 SQL and existing subtask execution/sequence guards.

**Acceptance:** Head selection adds a person to the current project only. Eligible owners/leads can staff their branch; unauthorized actors and cross-Office branches are denied through direct APIs. Nested leads work through several levels up to the declared limit; self-parent/cycle/depth overflow is rejected. Rollups, deadlines, reviews, reports, and completion include descendants. Removing/revoking a lead cannot leave stale delegated privileges. Existing flat tasks/subitems retain IDs and behavior.

**Backend gate:** Versioned additive hierarchy/staffing APIs and migrations, compatibility adapters for flat consumers, genuine allow-deny tests, and migration/backfill proof. Do not widen a combined Head guard to include a Lead for all owner/Office/project fields.

## R8 — Approved invitations, email delivery, and onboarding

**Status:** Implemented and verified locally; see the [R8 receipt](r8-invitations-delivery.md). Migration and verified-sender/genuine mailbox acceptance remain open. R9 is the next implementation phase.

**Goal:** Let owners propose external people, let Heads approve first, and make creation/delivery/onboarding outcomes clear.

**Implementation slices**

1. Reuse existing Invite member form content in the Owner picker, adding requested skill/professional-summary information, engagement type, project/node scope, and access-end terms. Keep optional PDS private and optional unless a defined onboarding rule requires it.
2. Add an invitation-request state machine: **Pending Head approval → Approved/Rejected → Invitation created → Delivery attempted → Accepted/onboarding → Active membership**, with explicit expiry/revocation/failure states. Approval is by the responsible appointed Office Head and is checked again before dispatch/acceptance. A proposal creates no external email/token/access grant before approval.
3. Place the Head approval queue in project Members/Invitations and route actionable notices through existing authorized Inbox mechanisms. This remains after the Planning/Waiting for approval sidebar removal.
4. Reuse existing successful-row exclusion, resend cooldown, token rotation, revocation, email matching, acceptance idempotency, PDS attachment/extraction/manual recovery. Reuse form/retry/PDS components, but create a distinct project-member acceptance contract: the existing Office-member acceptance path establishes global Office affiliation and must not be used unchanged for temporary project-only access. Existing-account invitations preserve their identity, Office affiliation, and account role. Project membership activation remains separate from task/subitem assignment. Do not promise confirmed delivery when only provider acceptance is known.
5. Replace ambiguous mixed success copy with separate per-person states: Request submitted; Invitation created; Email accepted by provider/Failed; PDS attached/Processing/Failed; Onboarding pending/Complete. Provide targeted retry from Invitations without recreating or resending successful rows.
6. Resolve sender configuration through a verified sending domain and server environment. The source's rehearsal-recipient restriction is real; keep an actionable explanation until configuration is fixed. Inventory eFlow Resend mail, notification SMTP, and Supabase Auth SMTP separately, with correct public URLs/redirects. Keep all provider credentials server-side.
7. Add controlled end-to-end delivery/onboarding acceptance after configuration: non-test-recipient delivery, correct recipient identity, link acceptance, project membership, optional skill/PDS flow, expired/revoked links, and recovery after partial failure.

**Source anchors:** `features/invitations/components/InviteMemberDialog.tsx`, `types.ts`, `features/office-team/components/InvitationTable.tsx`, `features/professional-profile/components/ProfessionalProfilePanel.tsx`, `server/routers/invitations.py`, `server/invitations/service.py`, `server/services/email_delivery.py`, `server/routers/notifications.py`.

**External configuration evidence:** Resend requires a verified owned sending domain; [Resend verified-domain documentation](https://resend.com/docs/dashboard/domains/introduction). Supabase's default Auth SMTP restricts recipients and is unsuitable for production delivery; [Supabase custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp). These are distinct from eFlow's application invitation service. Recheck current provider documentation before implementation/configuration.

**Acceptance:** Owner request makes zero email/grant operations before Head approval. Rejection, revoked Head authority, changed project, duplicate approval, or stale request cannot dispatch. Mixed batch retries skip successful rows and identify delivery versus PDS failures. Genuine received email and acceptance are required to claim delivery success; use supported expiration rather than backdating history. Skills/type are retained without granting extra role authority.

## R9 — Sharing, member removal, and temporary access lifecycle

**Goal:** Make joining, removing, and ending project access enforceable and understandable.

**Delivery:** [R9 access lifecycle receipt](r9-access-delivery.md), implemented and verified locally 8 October 2026. Recipient-bound sharing, complete reviewed atomic removal, temporary expiry and explicit renewal are delivered under the [access contract](r9-access-contract.md). The migration remains unapplied; genuine hosted session/Storage/concurrency acceptance remains open.

**Implementation slices**

1. Replace copy-only Share project with a Head-only grant workflow. Specify **Viewer** (read-only permitted project content) and **Project member** (eligible task editing/contribution), with an explicit permission summary, expiry, recipient restrictions, and revoke controls. Editor membership does not grant Head/review/finance authority. An authenticated, valid grant is required when opening the link.
2. The project Lead Head manages sharing; each participating Office Head manages their own Office personnel. Define personal-workspace sharing authority separately under R3. Reflect this matrix in UI and server checks.
3. Add Head removal in Project Offices/Members with a complete impact preview: assigned tasks, nested subitems, lead appointments, and active work. Explain that confirmed removal unassigns that person and clears delegated authority. A sole Task/Subitem Lead is removed as requested; mark affected unfinished work as requiring reassignment and prevent invalid execution until reassigned. Require a replacement only for genuinely mandatory workspace/Office ownership, not as a revival of the current assigned-work removal refusal.
4. Replace the current unfinished-work removal refusal with a reviewed transactional operation: verify a current impact fingerprint, unassign affected work, revoke branch/project membership and grants as appropriate, preserve historical authorship/evidence, and append audit events. Cancellation performs zero writes; concurrent new assignments require a fresh review; failure rolls the operation back.
5. Add engagement/access terms for permanent members, Job Order, OJT, and other approved types. End temporary project grants at the agreed end date or project completion/archive; keep historical records and other active projects/accounts. Define permanent-member archive read access and restoration/reapproval behavior explicitly.
6. Enforce expired/removed access in queries, mutations, signed file creation, realtime, and server operations. Define previously issued signed-URL lifetime/revocation limits and realtime/cache cleanup; a hidden row is not revocation. Reject pending invite acceptance/share redemption after the applicable project access period ends.

**Source anchors:** project `ProjectUtilities.tsx`, `services/projectLifecycleService.ts`, `features/project-offices/services/staffingAuthority.ts`, `OfficeMembersEditor.tsx`, `features/invitations/`, Phase 6 member-selection guards and Phase 7 lifecycle checks.

**Acceptance:** Only the appointed authorized Head can grant/revoke Office-project sharing. Viewer cannot edit via UI or direct API; member edits remain task-scoped. Cancellation changes nothing; confirmed removal unassigns every affected current task/descendant atomically, including work outside the loaded page. Date expiry/completion/archive removes temporary project access, including active sessions, without deactivating unrelated account/workspace memberships. History remains attributable; restore follows the agreed reapproval contract.

## R10 — My Work and workspace Overview

**Delivery:** [R10 work refinement receipt](r10-work-delivery.md), implemented and verified locally 8 October 2026, with [aggregation, date and access contract](r10-work-discovery-contract.md). Four My Work destinations, cross-workspace authorized discovery, R7 descendants, R9 refresh, contextual retained tools and scoped Workspace Overview are delivered. No new migration or hosted acceptance is claimed.

**Goal:** Replace duplicated personal navigation with a clear working surface and move the removed Home summary into the workspace.

**Implementation slices**

1. Make My Work's primary destinations **Assigned work, Leading, Subtasks, History**. Use All my work/Today/This week/Overdue as filters instead of more sidebar destinations. Reuse existing assignment, contribution, effective-lead, and recently-completed selectors.
2. Use consistent toolbar, compact list/table, status, empty/loading/error, and contextual task inspector patterns. Include Office/workspace/project context where needed so similarly named tasks remain distinct.
3. Retain relevant personal deadlines, reports/performance, execution, review, and history functionality through contextual actions/filters. Keep pending invitation approval in authorized Inbox/Members rather than mixing it with completed work.
4. Redesign **Workspace Overview** using the existing authorized Office/dashboard sources: active projects, due/overdue work, personal work links, and actionable notices. Keep **Project Overview** scoped to one project. Personal-workspace Overview uses only its authorized content.
5. Define cross-workspace My Work aggregation explicitly and respect active grants/expiry. Integrate R7 descendants and R9 removal so stale tasks disappear from actionable lists while permitted History remains accurate.

**Source anchors:** `features/personal-work/components/PersonalWorkWorkspace.tsx`, `selectors.ts`, `features/navigation/`, existing Head/Member dashboard sources, project `ProjectOverviewTab.tsx`.

**Acceptance:** All retained work is discoverable under the correct role and filter; contribution/lead/assignment semantics do not drift. Dates use the defined user/workspace timezone. Nested subitems open the correct inspector. Home deep links resolve safely; Overview has real scoped totals and no Getting Started card. Dirty forms, Back/Forward, revoked access, and partial-source errors remain handled.

## R11 — Reports and paginated, printable Activity

**Delivery:** [R11 Reports/Activity receipt](r11-reports-activity-delivery.md), implemented and verified locally 8 October 2026, with [report ownership and server/print contract](r11-reports-activity-contract.md). Shared analytical surfaces, checked complete reads, real merged-history pagination, frozen snapshots and full/current-page printing are delivered. The additive migration remains unapplied; hosted RLS/transport, retention and representative-volume acceptance remain open.

**Goal:** Apply eFlow's design system to the remaining analytical surfaces and make Activity usable beyond the loaded sample.

**Implementation slices**

1. Redesign project Reports, report inspectors, Office/Head reports, and other retained report surfaces with shared headers, filters, cards, dense tables, typography, statuses, and loading/error states. Inventory any remaining generic UI and give each retained surface an owner.
2. Preserve every authorized report lens, row, hierarchy, date/project/Office filter, total, financial distinction, evidence/receipt link, CSV/PDF export, and drill-through. Missing facts remain unavailable, not fabricated zero.
3. Add a paginated Activity data contract with deterministic ordering and stable source/event identity. Account for the merged audit/status/progress/submission sources; remove the silent latest-250 ceiling for complete-history workflows and distinguish read failures from no activity.
4. Add filter/search/type/date controls, a proposed default page size of 25, page navigation or cursor-backed Previous/Next, counts only when known, page reset/clamping, loading/error/retry, and deterministic behavior when new events arrive. Avoid duplicate events from multiple sources.
5. Add Print with explicit scope: default **all authorized events matching current filters/date range**, optional Current page. Fetch the complete selected scope before printing and report incomplete/failed sources. Include project/workspace, filters, generated time, consistent timestamps, repeated headers, and page numbers; exclude app navigation from print.

**Source anchors:** project `ProjectReportsTab.tsx`, `ProjectToolsInspector.tsx`, `ProjectActivityTab.tsx`, `services/projectActivityService.ts`, `selectors/projectCommandSelectors.ts`, `features/team-management/services/teamWorkflowFactsService.ts`, `features/reports/components/HeadReportsWorkspace.tsx`, workflow `ReportsWorkspace.tsx`.

**Acceptance:** Exported report totals match the filtered authorized screen and baseline accounting semantics. More than 250 Activity events are reachable; equal-time events have stable ordering; pagination/filtering/concurrent inserts do not skip or duplicate facts. Print count matches the declared scope and includes older pages. Permissions, file privacy, archived read-only behavior, long tables, and end-of-view scrolling pass.

**Backend gate:** Complete history requires real server/query paging and clear error/completeness contracts. Slicing the existing local array is only a presentation increment, not final acceptance.

## R12 — Admin Center and effective configuration

**Delivery:** [R12 Admin/configuration receipt](r12-admin-delivery.md), implemented and verified locally 8 October 2026, with [consumer inventory and configuration contract](r12-configuration-contract.md). Nine categories, validated effective branding, read-only dormant/operator policy, redacted delivery diagnostics and checked latest-500 audit coverage pass local unit, gateway, PostgreSQL and Chromium gates. The additive migration and gateway endpoint remain undeployed; genuine hosted/provider acceptance and integrated R13 rollout remain open.

**Goal:** Give eFlow administrators a coherent takeover console with honest, effective controls.

**Implementation slices**

1. Reorganize the existing administration feature into consistent categories: **People & onboarding; Offices & leadership; Roles & permissions; Workspaces & project access policy; Application settings; Email & integrations; Runtime/AI health; Audit; Backup & export**. Inventory current functionality first and keep actual feature ownership/public APIs.
2. Redesign category navigation, headers, filters, tables, detail panels, forms, confirmation, and responsive layouts using R1. Preserve account inspection/editing, individual grants, self/last-Admin protections, Head appointment constraints, read-only operational inspection, unsaved changes, and backup safeguards.
3. Build a configuration matrix for organization/branding, timezone/date behavior, session controls, engagement types/access-end defaults, workspace creation policy, invitation defaults, notifications, file limits/retention, reports/export, runtime/AI, audit, and backup. For each item identify whether it is an existing effective control, a dormant setting requiring implementation, a proposed new capability, or an operator-managed integration.
4. Wire approved settings to real runtime consumers with server validation, capability checks, audit, pending/failure states, and clear restart/session-refresh effects. Do not claim that saving timezone or session timeout already changes runtime behavior merely because the form persists them.
5. Expose redacted sender/domain/SMTP/redirect health and actionable delivery diagnostics for R8. Keep Resend application invitations, notification SMTP, and Supabase Auth SMTP separate. Configuration secrets stay in protected server/provider configuration; no credentials in frontend `system_config` or browser responses.
6. Make global audit coverage/count/truncation explicit. The current audit reader is distinct from project Activity and has its own latest-500/error limitations; define an additive global paging/error contract if full-history administration is promised. Preserve secret redaction, reauthentication, uncertain-result handling, and backup/export permissions.

**Source anchors:** `features/administration/components/AdministrationWorkspace.tsx`, `administrationWorkspace.css`, `components/user-management/`, `features/organization/`, `features/audit/`, `components/SuperAdmin/SystemSettings.tsx`, `lib/supabaseService.ts`, administration `components/data-tools/BackupExportWorkspace.tsx`.

**Acceptance:** Every advertised setting has a demonstrated consumer and tested effect, or an explicit operator/read-only status. Admin can configure only permitted platform functions and does not inherit Office staffing/review/financial authority. Redacted health explains delivery problems without exposing keys. Validation, audit, rollback, dirty forms, account protections, and backup safeguards pass in desktop/mobile layouts.

## R13 — Regression, acceptance, and rollout

**Delivery:** [R13 local release verification](r13-release-delivery.md) and [candidate/rollout contract](r13-release-contract.md) implement the cumulative SQL, exact-candidate browser/artifact, performance and recovery gates. Full release acceptance remains open until the recorded performance, genuine hosted/provider, accessibility, CI/hosting and backup/rollback gates are resolved. No hosted rollout is claimed.

**Goal:** Verify the complete requested experience and its server boundaries before release.

**Implementation slices**

1. For every implementation vertical slice run `npm run check`, `npm test`, `npm run build`, and affected configured Playwright smoke tests. Add/update meaningful regressions for changed interactions, navigation, selectors, and authorization. Refresh Graphify after structural application changes; inspect extraction warnings. Documentation/CSS-only edits do not require a Graphify rebuild; CSS implementation slices still run the application checks/build. This planning-only document does not require running application suites.
2. Validate new backend capabilities using disposable local PostgreSQL with synthetic identities, gateway tests, and genuine authenticated allow-deny checks. A mocked browser response or service-role read does not prove RLS.
3. Exercise integrated flows: workspace switching → project table → nested lead assignment → external invitation request → Head approval → received email/onboarding → scoped member work → viewer share → member removal → completion/archive → access termination.
4. Repeat role/context coverage, deep links/history, stale permissions, pending/duplicate writes, lost responses, failed refresh after success, partial-source reads, keyboard/focus, viewport/scroll behavior, print, light/dark contrast, and accessibility. Retain sanitized receipts and avoid recording invitation tokens/private PDS.
5. Recheck the existing Phase 18 filtering regression and supported task scale using comparable measurements. This plan's UI simplification does not automatically close the prior performance gate. Include nested-subitem and large-history workloads.
6. Deploy only reviewed artifacts through the repository's release workflow. Hosted target remains **`ixnfphgjyelhckjwjkdv`**. Inspect the current ledger; populate an isolated migration workspace from live history; preserve deployed timestamps; apply only reviewed pending migrations. Never push the historical migration folder or repair live history to match it.
7. Preserve backups, prior frontend/gateway artifacts, compatibility contracts, and an additive rollback/forward-fix path. Disable new entry points if needed while keeping data/evidence/audits intact; never roll back by widening permissions or dropping accepted records.

**Existing regression starting points**

| Area | Existing tests to extend/select |
| --- | --- |
| Shell/layout | Unit `navigationV2.test.tsx`, `navigationUrl.test.ts`, `navigationActionAlerts.test.ts`, `workspaceFoundation.test.tsx`; E2E `navigation-v2.spec.ts`, `phase18-surfaces.spec.ts` |
| Project/table | Unit `phase10ProjectWorkspace.test.tsx`, `phase11Editors.test.tsx`, `phase11TableLayout.test.tsx`; E2E `phase10-project-workspace.spec.ts`, `phase11-main-table.spec.ts`, `project-workspace-controls.spec.ts` |
| Inspector/My Work | Unit `phase12InspectorDrafts.test.tsx`, `phase12Evidence.test.tsx`, `phase13PersonalWork.test.ts`; E2E `phase12-shared-inspector.spec.ts`, `phase13-personal-work.spec.ts` |
| People/invitations/lifecycle | Unit `phase14InvitationDrafts.test.tsx`, `phase14InvitationManagement.test.tsx`, `projectLifecycle.test.tsx`, `projectLifecycleService.test.ts`; E2E `phase2-invitations.spec.ts`, `phase65-office-identities.spec.ts`, `phase14-people-collaboration.spec.ts`, `phase15-ai-governance.spec.ts`; existing authority SQL/gateway suites |
| Reports/Admin | Unit `reportFormatting.test.ts`, `auditPresentation.test.ts`, `adminAccountProtection.test.ts`; E2E `admin-unification.spec.ts`, `foundation-admin-directory.spec.ts`, `admin-mobile-dialogs.spec.ts`, `phase16-support-finance.spec.ts` |
| Release/safety | Existing `phase17-safety.spec.ts`, `phase18-release.spec.ts`, `phase18-measurements.spec.ts`, `phase18-rollback.spec.ts`; current [acceptance checklist](acceptance-test-checklist.md) |

**New regression work:** personal workspace isolation; recursive ownership/depth/cycles/rollups; pre-send approval; project-scoped engagement expiry; transactional unassignment; enforceable Viewer/member sharing; general-file storage; complete paginated history/print; effective-setting consumers. The linked R3–R12 receipts and R13 delivery now record local SQL/gateway/unit/browser coverage for these additions. They do not certify the genuine hosted chain or its unresolved gates.

**Completion:** Required per-phase outcomes and positive/negative cases pass on the candidate. Required unresolved capabilities remain open; they are not closed by a redesigned disabled control. Full release also needs actual hosted email/storage/API acceptance, performance/accessibility results, matching frontend/gateway artifacts, and rollback receipts. Actual native app work is outside this request.

## 4. Request coverage checklist

Use this as the implementation tracker. No checkbox is marked complete by creating this plan.

| ID | Requested change | Owning phases |
| --- | --- | --- |
| 01 | Close due-date editor after saving | R5 |
| 02 | Rename Effort clearly | R5 |
| 03 | Remove Planning, Drafts, Waiting for approval sidebar surfaces | R0, R2 |
| 04 | Resolve configured test-recipient/verified-sender restriction | R8, R12 |
| 05 | Clear invitation-created/successful-row/retry outcomes | R8 |
| 06 | Owners/leads add members; subitems delegate and have leads | R7 |
| 07 | Owner-column external invite with Head approval, skills, engagement type | R7–R8 |
| 08 | Temporary access ends when project completes/archives | R9 |
| 09 | Add project Members through Add view | R7 |
| 10 | Validate/give guidance when an Office has no onboarded staff | R7–R8 |
| 11 | Trailing `+`, searchable icon catalogue, Add column/Vibe tooltips, compact defaults | R1, R5 |
| 12 | Simplify task detail metadata; Updates, Files/upload/reuse, Activity | R6 |
| 13 | Remove Project Offices/Readiness header container and statement | R4 |
| 14 | Replace participant sentence/names with avatars and name tooltips | R1, R4 |
| 15 | Head-only share with explicit Viewer/member permissions | R9 |
| 16 | Reports and all retained generic UI use current design system | R1, R11, R12 |
| 17 | Paginated, printable Activity | R11 |
| 18 | Remove Workload & Team | R4 |
| 19 | All retained views/sidebar scroll fully without unused bottom area | R1, R13 |
| 20 | Remove Readiness & closeout, Approval Status, Evidence Register, Decision History views | R4 |
| 21 | Completion availability reason; keep validation modal | R4, R9 |
| 22 | Remove Make yourself at home/Getting Started progress card | R2 |
| 23 | Readable On track/status presentation beside Planning | R1, R4 |
| 24 | Head removal confirms assignments and unassigns affected task/subtask work | R9 |
| 25 | Office tools disclosure persists while selected item highlights | R2 |
| 26 | Remove sidebar Team Members alongside Planning | R2; replacement R7 |
| 27 | LEDIPO Workspace selector, collapse, search, overflow, section add/show/hide, icons, expanded Projects | R2 |
| 28 | Select/create personal workspace separately from LEDIPO | R3 |
| 29 | Remove global Search menu item | R2 |
| 30 | Head selection of own Office members affects current project only | R7 |
| 31 | Overhaul My Work and its subitems | R10 |
| 32 | Remove Home; provide redesigned workspace Overview | R2, R10 |
| 33 | Overhaul Admin Center and configurable eFlow takeover controls | R0, R12 |

## 5. Shared implementation boundaries

- New application work stays under `src/app/features/<feature>/`; reusable domain-neutral controls stay in `src/app/components/ui/`, and cross-feature adapters in `src/app/shared/`. Import other features through their small public `index.ts` API.
- The explicitly requested removals/redesigns supersede old presentation decisions. Preserve all unrelated workflows, account roles, financial separation, PDS privacy, evidence history, and server authority. Retire legacy files only after repository searches establish no remaining consumers.
- UI slices do not change schemas/RLS/Python payloads incidentally. The new capability phases above name their backend work explicitly and preserve/version public contracts for existing callers.
- Head/Lead authority comes from current authenticated scope, never user-editable metadata, an email address, or a UI-only button check. Reevaluate it on consequential operations.
- A pending request, provider acceptance, delivered mail, verified onboarding, and active project membership are separate facts. Successful writes followed by a refresh/PDS/delivery failure must not be recreated blindly.
- Preserve the [current live addendum](../phase65-live-deployment-2026-10-07.md), historical receipts, and [existing performance issue](phase18-performance-issue.md). Preparing this plan changes none of their acceptance status.

**Roadmap deliverable:** One source-grounded roadmap covering the full pasted request, with phases, dependencies, implementation slices, permission/data boundaries, acceptance criteria, and a complete request tracker. R0 is delivered as the linked contract package; R1/R2/R3/R4/R5/R6/R7/R8/R9/R10/R11/R12 are implemented and verified locally in their receipts; R13 local release verification and rollout preparation are implemented in the linked receipt, while full acceptance/rollout remains open. R8 verified-sender and genuine non-test delivery/onboarding acceptance remain open. R3, R6, R7, R8, R9, R11 and R12 reviewed additive migrations have not been applied; the R12 configuration-health gateway endpoint is not deployed. These local deliveries change none of the historical/live acceptance status.
