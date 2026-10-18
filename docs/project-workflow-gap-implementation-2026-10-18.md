# Project workflow audit implementation — 18 October 2026

User-authorized implementation of `eFlow_Full_Workflow_and_UI_Gap_Audit_2026-10-18.md`, revision 1.1. The attached audit remains unchanged. Its ZIP findings were checked against the current source before editing.

## Implemented decisions

| Audit findings | Result |
| --- | --- |
| WF-01–06, WF-14 | Persistent **+ New** separates creation from All projects / Saved work plans / Proposal review. Office Projects lands on a real, access-filtered portfolio using `ProjectsPortfolioTable`, with search, status, lead Office and sorting. It no longer automatically opens the first project. The standalone sidebar callback opens the same index. |
| WF-07–08, WF-20, WF-25 | Board, Gantt, Calendar, Dashboard, Offices and optional project views expose **+ Task** in project context. Main Table retains New task and inline creation. Every entry uses `CreateWorkDialog` and `createWorkspaceTask`; the selected group is a real project group, independently of Board status lanes. A project with no groups guides the Head to create one first. |
| WF-09 | The two menu items calling the same AI/document dialog became one truthful **Plan tasks with AI / document** entry. File import and brief generation remain in that existing dialog. |
| WF-10–11 | Project metadata management uses current appointed owning-Office Head facts rather than treating any proposal link as management authority. Existing task-level permissions remain separate. Entitled Heads viewing another Office get a disabled New action with an explanation. Closed projects retain their existing read-only guards. |
| WF-12 | Project task details and completion-blocker task details use the existing page inspector with Overview / Work / Updates / Files / Activity / Review. The source view stays mounted and hidden, preserving its filters, and focus returns on close. Quick forms and confirmations remain dialogs. |
| WF-13, WF-26 | Settings and completion requirements have visible project actions. The existing small settings dialog, dirty guard, validation and lifecycle confirmations are retained. |
| WF-15–16, WF-19 | Explicit project/index/work-plan URLs restore their context. Work plans now have `proposal` and `proposalView` display parameters. Creation receipts bridge realtime list latency. Unavailable notification targets remain unconsumed, show a notice, and do not automatically replay on each refresh; another click can retry. Project notifications do not depend on successful work-plan loading. |
| WF-18 | Replaced the invisible editor-tab stack with one current project/plan/index context. Returning to All projects cannot unexpectedly select a previously opened editor. Browser Back/Forward still restores explicit URLs and project views. |
| WF-21 | Loading, failed project reads with Retry, truly empty portfolio, filtered-empty portfolio and no task groups have distinct states. |
| WF-22–23 | Add view explains that layouts share existing tasks. Optional-view close is a separate real button outside the tab; overflow close actions remain keyboard accessible. |
| WF-24 | New personal workspaces use `Asia/Manila` internally. No timezone control was restored and existing saved timezone records were not rewritten. |
| WF-27 | README now describes the current Admin, Head, Member and Financial Officer roles and actual project entry points. |
| WF-28 | Source review confirms the four supported roles dispatch to the current role/shared route owners. Unsupported accounts already exit before the default branch. Replaced its misleading “Content coming soon” text. This is not a claim that every production route was exercised in a browser. |
| WF-29 | **+ Add people** goes directly to an in-page, own-Office picker; Members uses the same picker. Successful quick creation guides to this optional step, with Skip for now. It preserves the new project ID if staffing fails. The existing `OfficeMembersEditor` supplies search, checked saves, impact confirmation, conflict checks and retained retries. No legacy `project_members` write, second creation API, account invitation or task assignment was introduced. An opened draft stays visible but disabled if authority changes. |

WF-17 remains an intentional compatibility boundary: `ProjectContextSidebar` still has a standalone `ProjectsWorkspace` fallback and lifecycle/presentation test consumers. It was not deleted or presented as unused. The normal shell uses the shared navigation and real portfolio. `ProposalPortfolio` has no active route caller; its selectors still have regression consumers, so no speculative selector or historical workflow removal was mixed into this change.

## Hosted authority check

Read-only MCP inspection targeted **`ixnfphgjyelhckjwjkdv`** only. Inspected the deployed `can_manage_project`, `can_manage_collaboration_project`, `can_create_scoped_work`, `phase3_create_task`, `eflow_phase6.head`, `phase6_set_members`, and R7/R9 membership wrappers/implementations, plus relevant task triggers.

The current database remains the mutation authority. The new people entry reuses current own-Office staffing preflight and canonical checked RPCs; it does not widen RLS or treat UI controls as authorization. No schema, policy, migration history, Python endpoint or database records were changed for this audit implementation.

The chosen creation flow is **Create → optional Add people**, not a claimed atomic create-and-staff transaction. No project is recreated when a team save is retried. Governed participation remains in its existing approval workflow.

## Verification boundary

The new browser tests use intercepted synthetic records, not hosted personal data. They cover repeat creation, refresh and index history, canonical Board-to-table task identity, task page return, direct staffing with a denied save and identical checked retry, own-Office candidate filtering, and Member/Financial Officer/Admin read-only creation controls. Portfolio screenshots cover 1440, 768, 390 and 320 pixels; people screenshots cover 1440, 390 and 320 pixels.

The existing project-control smoke tests also cover portal menus, focus return, Board/Table filter retention, mobile first-column actions and overflow view closing. Full live multi-Office acceptance, simultaneous real-client conflicts, email delivery and the audit's repository-wide click worksheet are not claimed by these fixtures. Existing canonical membership unit tests cover conflict detection, authority loss, pending writes, removal blockers and saved-result refresh retries.

## Command results

- `npm run check`: passed on the final source.
- `npm run build`: passed; existing chunk-size and mixed-import warnings remain.
- Six affected unit files: **62 passed**. Includes the new portfolio/route/staffing tests, canonical membership guard tests, view navigation, notification lifecycle and navigation contract parity.
- Members compatibility and audit timeout triage: **11 passed** after updating the changed Members entry assertion. The audit test passed without changing its implementation or timeout.
- Final Chromium run against the production build: **13 passed** in one run, including all new project workflow scenarios, the existing project controls and the Phase 10 identity/settings/lifecycle/history tests.
- Required full unit run: **1,927 passed, 20 failed, 1,947 total**. Eighteen failures match the previous failure list (Admin registry and nested-work/staffing/notification coverage). The two additional failures were the changed Members assertion and a 5-second audit-page timeout; both passed on the focused rerun. This is **not** a claim of a green full suite or a fresh full rerun after those two resolved results.
- Graphify refreshed successfully. Four existing partial-extraction warnings remain in guided-tours, productivity, ProjectTaskRow and work-templates; the generated map was retained.

[Machine-readable verification summary](project-workflow/2026-10-18/verification-summary.json).

## Visual evidence

- [Portfolio at 1440px](project-workflow/2026-10-18/all-projects-1440.png), [390px](project-workflow/2026-10-18/all-projects-390.png), [320px](project-workflow/2026-10-18/all-projects-320.png).
- [In-page people picker at 390px](project-workflow/2026-10-18/add-people-390.png).
- [Project task page](project-workflow/2026-10-18/project-task-page.png).
