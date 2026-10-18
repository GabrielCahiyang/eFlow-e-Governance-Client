# eFlow empty-state message map

**18 October 2026 · Mapping only · No UI, icon, copy, permission, or database changes**

This maps the messages shown when a list is empty, a search finds nothing, a queue is clear, no record is selected, or a section has no files, members, activity, or setup. It also records related inline placeholders separately so they are not mistaken for full-page empty states.

The quoted example is in **My Work → Assigned work, Leading, Subtasks, and History**, rendered by `FeedbackState` in `PersonalWorkWorkspace`:

> **No work in this view**  
> Assigned tasks and subitems will appear here when they are available to you.

The same branch switches to **No matching work** / **Try a different search or filter.** when search/date/workspace filters apply, with **Clear search and filters**. `FeedbackState` currently supplies no icon. These are two variants of the same branch, not two screens.

## Files and counting

- [Sortable complete inventory](empty-state-map-2026-10-18/inventory.csv): every mapped message occurrence, role scope, tab/context, state category, supporting copy or source expression, renderer, existing visual, source file, and line.
- [Scan decisions](empty-state-map-2026-10-18/scan-decisions.csv): all 570 initial candidates with their inclusion/exclusion decision. Manually found dynamic/positive empty branches are additionally listed in the inventory.
- Scanned **1,227 TypeScript/TSX application files**. Checked the current role outlet, sidebar registry, project-view catalog, accounting destinations, and nested tab renderers against source. Initial text matching was followed by shared-renderer and conditional-branch searches; this is not just a list of strings beginning with “No”.
- Mapped **292 current/conditional occurrences in 161 files**: **192 panel/list/section messages**, **91 inline/secondary messages**, and **9 supporting-copy occurrences**. Another **36 source-only occurrences** are isolated below.
- A repeated message, title, description, or compatibility branch can have multiple records. These counts are **not distinct pages, unique state designs, or live database counts**. Group by source component and branch before any later design work.

## Role scope

**A = Admin · H = Head · M = Member · F = Financial Officer area.** The persisted role for F is `accounting_staff`; its current label is **Accounting Staff**. The old `role-finance` prototype is not the current Financial Officer workspace.

Permission-managed support pages can also appear for H/M/F with explicit grants. Work, review, membership, staffing, budget and governance controls retain their own eligibility checks; appearing in this map does not imply every role may approve or edit them. Admin does not gain operational My Work/project access through this map.

## Role, destination and tab coverage

Every current destination below was checked for app-owned empty messages. “No dedicated message” means the source renders fixed controls, a blank structure, or a library view instead of an app-owned empty-state sentence. It does not mean the tab was skipped.

| Roles | Destination | Tabs / child surfaces checked | Mapping result |
| --- | --- | --- | --- |
| A; granted support actors | All Users | Account list; Pending activation; create/edit account; PDS import review | Accounts do not match; no pending activations; no skills/education rows. |
| A | Locked out accounts | Lockout table and fixed policy controls | “No locked out accounts.” Table default heading is also mapped. |
| A | Role Defaults | Role selector and permission checklist | No dedicated collection-empty sentence; fixed permission editor. |
| A; granted support actors | User Access | User search; unselected user; current access; organization exceptions | No active users; choose a user; no cross-organization exceptions. |
| A; granted support actors | Account Audit | Loaded-event list; Overview; Changed fields; Technical details | No permitted/filtered loaded events; no note, changes or metadata. List is scoped to loaded permitted events, not all database history. |
| A; granted support actors | System Settings | Application settings | Fixed configuration controls; no dedicated empty collection message found. |
| A; granted support actors | Workspace Policy / Email & Integrations | Configuration matrix and search | “No configuration items match.” |
| A; granted support actors | Runtime / AI Health | Endpoint and runtime diagnostics | Missing-origin diagnostic is an inline status, not an empty data list. |
| A; granted support actors | Backup & Export | Discovered public tables; backup-job history; preparation/receipts | No public tables; no jobs in this gateway session. Preparation and receipts are not empty states. |
| H | Workspace Overview | Project progress; Overdue; Due soon; Awaiting review; Needs a lead; Recent task updates | Separate empty projects, task/attention lists, all-tasks-have-leads, and no recent updates. Existing dashboard icons are noted. |
| M/F; personal workspace context for H | Workspace Overview | Active projects; Due today; Overdue work; Needs reassignment; Awaiting review | No active projects / no work in this category. Partial source coverage uses different availability messages. |
| H/M/F | My Work | Assigned work; Leading; Subtasks; History; search/date/workspace/recent filters | The quoted generic message and its filtered variant are shared by all four destinations. |
| M/F; authorized H tools | More work tools | Task workspace; Subtask workflow; Deadline calendar; Task history details; Performance; Work Report | Separate compatible workflow messages are mapped. “Lead workspace” remains removed. Tools are role/permission dependent. |
| H/M/F | Office tasks / Task workspace | List; Kanban; Timeline; Hierarchy; Calendar; Dependencies; Workload; task Activity; assignment/editor/chat; recurring templates | Empty board/column, no dated work, no scheduled tasks, no dependencies, no activity, empty people pickers and templates. View exposure depends on the retained task workspace. |
| A/H/M/F | Inbox | Inbox; Needs action; Updates; unread-only recent updates | No personal reviews, no unread/recent updates, and lack-of-review-access notices are distinguished. |
| H; assigned M/F reviewers | Reviews | Work Plans; Project Tasks; Governance & Approval; Subtasks; Budget; Membership approvals | Each queue's own clear/empty state, filtered task queue, and choose-submission/evidence state are mapped. Budget/membership tabs are conditional. |
| H | Team Supervision | Attention queue; People & workload; Identity & access; member work/operations panels | No attention items, no matching team members, choose a person, no active task/subitem participation. |
| H | Office Team | Active Members; Invitations; search; role/status filters; member detail | No members, no invitations, and filtered-no-results are distinct variants. |
| H | Identity & Access | Available staff; Current access; Protected leadership; scoped exceptions | Empty staff searches, no assigned accounting staff, choose a member, no Head, no exceptions. Missing role holders are inline statuses. |
| H | Team Intelligence | Office health; Member 360; Skills coverage; Monthly contribution | No people, no selected member, no skills, no approved contribution, and no high workload concentration. |
| H | Reports | Office operations; Projects and delivery; Team contributions; Reviews and revisions; Evidence register; Attention and risk register; Task lifecycle history | Shared filtered report-empty state plus contribution-summary fallback. |
| H/M/F with project access | Projects and proposals / portfolio | Project selection; active/archived/favorites; work-plan preparation; waiting for approval; incoming reviews; draft/source/plan editor | Project/draft/review variants and first-program prompts are mapped. |
| H/M/F with project access | Project core views | Main table; Board; Gantt; Calendar; Project Dashboard; Offices | Empty groups, filtered items, subitems, dated work, chart widgets and Offices. Calendar grid can be empty without an app-owned empty sentence; no new sentence is proposed here. |
| H/M/F with project access | Project optional views | Members; Overview; Timeline; Reports; Proposal Context; Activity; Reviews; Budget Overview | Current optional view catalog checked. “No source proposal” and “No financial allocation” can be intentional, not errors. |
| H/M/F with project access | Project people/details | Members/Invitations; Offices directory; Office inspector → Overview / Project team / Invitations | Eligible staff, selected members, invite history, empty Office search and project Office states. Some history is limited by access. |
| H/M/F in work contexts | Task/subitem detail | Overview; Work; Updates; Files; Activity; Review; nested hierarchy; choose people; staffing suggestions | No evidence, attachments, documents, progress, discussion, activity, subitems, contributors or eligible people; no generated staffing results. Review tabs can show existing content/controls without a dedicated additional empty sentence. |
| H | Office Budget | Overview; Annual Budget; Proposal & Task Funding; Funding Requests; Releases & Settlement; Expenses; Petty Cash Vouchers; General Journal; Accounting Trail | All nine view branches checked. Initial setup gate and each available queue/register empty are mapped. |
| F | Accounting | Accounting Overview; Voucher & Cash Releases; Settlements; General Journal; Financial Audit Trail; Office Budget Ledgers | All six destinations checked. Office Budget Ledgers embeds the same nine budget views above. Settlement queue already has a check icon. |
| H/M/F, scope dependent | Personal workspace | Project selection; work/assigned-only; member/access details; task files; project files | No projects, no project selected, no tasks, no general documents, workspace-selector search. Member editor can show controls/zero rows without a dedicated extra empty sentence. |
| A/H/M/F | Shared utilities | Notifications; Messages/conversations; navigation search; Profile; Appearance; Notifications settings; Security; Help | Notification/chat/search empty states mapped. Profile missing summary is mapped. Appearance/notification/security controls and Help content do not have collection-empty messages merely because values are unset. |

## Shared renderers already in the system

| Renderer | Current visual behavior | Why it matters for the later icon pass |
| --- | --- | --- |
| `FeedbackState` | No icon/visual prop or automatic icon | Used by the quoted My Work message and several Inbox queues; also used for errors/success, so a global decorative change would affect other states. |
| `EmptyState` wrapper | Accepts optional `icon`; passes it to Vibe `visual` | Some callers supply none; the fallback description is “There is nothing to display here yet.” |
| `SectionEmpty` | Accepts optional `icon`; wraps Vibe EmptyState | Many review/legacy task screens already supply icons. Missing `description` changes which text occupies the title/description slot. |
| `DataTable` | Vibe EmptyState title “Nothing to show”; caller `emptyMessage`; optional `emptyIcon` | Current Users, Locked accounts and Audit table callers do not supply `emptyIcon`. “No data found” is the reusable default, overridden by these callers. |
| `EmptyWorkspaceState` | Title, description and action; no icon input | Used by project Activity and Reports. |
| `BudgetEmpty` | Dashed card with title/description/action; no visual input | Used across missing budget, approval, funding, release and expense states. |
| `EmptyLine` in BudgetOperationalSignals | Existing `AlertTriangle` | Includes positive/neutral no-release/no-settlement and first-financial-activity cases; this is existing behavior, not a proposed icon choice. |
| Head dashboard local `Empty` | Explicit existing icon | Uses FolderKanban / CalendarClock / CheckCircle2 variants. |
| Local JSX | Varies | A paragraph may share a block with an icon, or merely sit under a header icon. Unclassified surrounding visuals are marked explicitly in the CSV instead of being declared missing. |

## Panel, list and selection-message inventory

Exact copy is retained, including current wording/typos. No replacement copy or new icon choice is proposed. Role/tab scopes in the CSV are authoritative when a row is conditional. Existing icon names below describe current code only. Supporting descriptions can be expressions/variants in the CSV.

### Access management

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-001 | No cross-organization exceptions. Normal role and organization scope applies. | User Access / scoped exceptions | Local text; surrounding visual not independently classified | [OrganizationScopePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/permissions/components/OrganizationScopePanel.tsx:233) |
| ES-003 | No active users match this search. | User Access / scoped exceptions | Local text; surrounding visual not independently classified | [UserAccessTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/permissions/components/UserAccessTab.tsx:315) |
| ES-004 | Choose a user to inspect final access | User Access / scoped exceptions | UserRoundCog (existing) | [UserAccessTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/permissions/components/UserAccessTab.tsx:326) |

### Account Audit

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-006 | No loaded events match. Clear filters to see the loaded set. | Account Audit → loaded 500-event list (filtered / no permitted events) | No emptyIcon supplied by current table callers | [AdminAuditLog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/audit/components/AdminAuditLog.tsx:227) |
| ES-007 | No permitted administrative events. | Account Audit → loaded 500-event list (filtered / no permitted events) | No emptyIcon supplied by current table callers | [AdminAuditLog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/audit/components/AdminAuditLog.tsx:230) |
| ES-009 | No field-level changes were recorded. | Account Audit detail → Changed fields | Local text; surrounding visual not independently classified | [AuditEventDetailContent.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/audit/components/AuditEventDetailContent.tsx:24) |
| ES-010 | No additional metadata was recorded. | Account Audit detail → Technical details | Local text; surrounding visual not independently classified | [AuditEventDetailContent.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/audit/components/AuditEventDetailContent.tsx:29) |

### Admin accounts

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-013 | No locked out accounts. | All Users / Pending activation / account forms | No emptyIcon supplied by current table callers | [LockedAccountsTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/components/user-management/LockedAccountsTab.tsx:75) |
| ES-016 | No pending activations. | All Users / Pending activation / account forms | Local text; surrounding visual not independently classified | [PendingActivationsTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/components/user-management/PendingActivationsTable.tsx:47) |
| ES-017 | No accounts match the current filters | All Users / Pending activation / account forms | No emptyIcon supplied by current table callers | [UsersTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/components/user-management/UsersTab.tsx:432) |

### Admin configuration

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-018 | No configuration items match. | ConfigurationMatrix → Workspace Policy / Email & Integrations (search) | Local text; surrounding visual not independently classified | [ConfigurationMatrix.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/configuration/ConfigurationMatrix.tsx:68) |

### Admin support

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-020 | No public tables were discovered. | Backup & Export → public tables / gateway jobs | Local text; surrounding visual not independently classified | [BackupExportWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/components/data-tools/BackupExportWorkspace.tsx:695) |
| ES-021 | No backup jobs in this gateway session | Backup & Export → public tables / gateway jobs | Local text; surrounding visual not independently classified | [BackupExportWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/administration/components/data-tools/BackupExportWorkspace.tsx:759) |

### Budget and accounting

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-024 | Settlement queue is clear | Accounting → Settlements | CheckCircle2 (existing) | [AccountingSettlementQueue.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/AccountingSettlementQueue.tsx:407) |
| ES-025 | No matching audit events | Accounting Trail / Financial Audit Trail → register / event details | Local text; surrounding visual not independently classified | [AccountingTrailPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/AccountingTrailPanel.tsx:144) |
| ES-028 | No annual budget has been saved for this year. | Annual Budget → saved setup comparison | Local text; surrounding visual not independently classified | [AnnualBudgetSetup.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/AnnualBudgetSetup.tsx:279) |
| ES-029 | Approval inbox is clear | Funding Requests / Reviews → Budget | No empty-state visual supplied | [BudgetApprovalQueue.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetApprovalQueue.tsx:341) |
| ES-030 | No verified expenses yet | Expenses → empty / filters / receipt files | No visual supplied | [BudgetExpensesReport.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetExpensesReport.tsx:94) |
| ES-032 | No expenses match these filters | Expenses → empty / filters / receipt files | No visual supplied | [BudgetExpensesReport.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetExpensesReport.tsx:235) |
| ES-034 | No funded work | Proposal & Task Funding → funded hierarchy | No visual supplied | [BudgetFundingHierarchy.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetFundingHierarchy.tsx:16) |
| ES-035 | Published proposal commitments will appear here. | Overview → proposal commitments / recent financial activity | AlertTriangle (existing) | [BudgetOperationalSignals.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetOperationalSignals.tsx:15) |
| ES-036 | No cash is currently scheduled for release. | Budget Overview → release / settlement / position signals | AlertTriangle (existing) | [BudgetOperationalSignals.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetOperationalSignals.tsx:19) |
| ES-037 | No released cash is awaiting settlement. | Budget Overview → release / settlement / position signals | AlertTriangle (existing) | [BudgetOperationalSignals.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetOperationalSignals.tsx:23) |
| ES-038 | Audited financial actions will appear here. | Overview → proposal commitments / recent financial activity | AlertTriangle (existing) | [BudgetOperationalSignals.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetOperationalSignals.tsx:27) |
| ES-039 | No scheduled release is currently due | Budget Overview → release / settlement / position signals | Local text; surrounding visual not independently classified | [BudgetPositionSummary.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetPositionSummary.tsx:93) |
| ES-040 | No releases or liquidations | Releases & Settlement / Voucher & Cash Releases | No visual supplied | [BudgetReleasesPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetReleasesPanel.tsx:98) |
| ES-041 | No {fiscal year} office budget | Reviews → Budget | No empty-state visual supplied | [BudgetReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetReviewInbox.tsx:75) |
| ES-042 | No sections yet. Add your first section to build this budget. | Annual Budget → budget sections editor | Local text; surrounding visual not independently classified | [BudgetSectionEditor.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/BudgetSectionEditor.tsx:41) |
| ES-044 | No journal entries match | General Journal → register | Local text; surrounding visual not independently classified | [GeneralJournalWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/GeneralJournalWorkspace.tsx:342) |
| ES-047 | No {fiscal year} annual budget yet | Any non-Annual Budget view before setup | No empty-state visual supplied | [OfficeBudgetWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/OfficeBudgetWorkspace.tsx:189) |
| ES-048 | No authorized vouchers in this selection. | Petty Cash Vouchers → verified-only / all | No empty-state visual supplied | [PettyCashVoucherRegister.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/PettyCashVoucherRegister.tsx:11) |
| ES-049 | No settled expenses in this selection. | Petty Cash Vouchers → verified-only / all | No empty-state visual supplied | [PettyCashVoucherRegister.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/PettyCashVoucherRegister.tsx:11) |
| ES-052 | No approved funding for this task | Task/Subitem Overview → cash clearance / task funding | Local text; surrounding visual not independently classified | [WorkBudgetCard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/components/WorkBudgetCard.tsx:328) |

### Files and documents

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-053 | No general documents linked to this task. / No general documents in this project. | Task Files / personal project Project files | Local text; surrounding visual not independently classified | [ProjectFileLibrary.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-files/components/ProjectFileLibrary.tsx:55) |

### Head dashboard

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-054 | No active projects yet | Head Workspace Overview → Project progress (project row / empty panel) | FolderKanban / CalendarClock / CheckCircle2 (variant dependent) | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:35) |
| ES-056 | Every open task has a lead | Needs attention → Needs a lead | CheckCircle2 (existing) | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:39) |
| ES-057 | No overdue tasks | Head Workspace Overview → Needs attention (Overdue / Due soon / Awaiting review) | FolderKanban / CalendarClock / CheckCircle2 (variant dependent) | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:39) |
| ES-058 | No tasks awaiting review | Head Workspace Overview → Needs attention (Overdue / Due soon / Awaiting review) | FolderKanban / CalendarClock / CheckCircle2 (variant dependent) | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:39) |
| ES-059 | No tasks due in the next 7 days | Head Workspace Overview → Needs attention (Overdue / Due soon / Awaiting review) | FolderKanban / CalendarClock / CheckCircle2 (variant dependent) | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:39) |
| ES-060 | No task updates in the past 7 days. | Head Workspace Overview → Recent task updates | Local text; surrounding visual not independently classified | [HeadWorkspaceDashboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard.tsx:44) |

### Head intelligence

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-062 | No attributable progress or review activity yet. | Office health / Member 360 / Skills coverage / Monthly contribution | Local text; surrounding visual not independently classified | [EmployeeIntelligencePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/EmployeeIntelligencePanel.tsx:60) |
| ES-063 | No skills match these filters. | Team Intelligence → Skills coverage | Local text; surrounding visual not independently classified | [SkillCoveragePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/SkillCoveragePanel.tsx:18) |
| ES-066 | No team members available. | Office health / Member 360 / Skills coverage / Monthly contribution | Local text; surrounding visual not independently classified | [TeamHealthOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/TeamHealthOverview.tsx:33) |
| ES-067 | No high workload concentration detected. | Office health / Member 360 / Skills coverage / Monthly contribution | Local text; surrounding visual not independently classified | [TeamHealthOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/TeamHealthOverview.tsx:35) |
| ES-068 | No matching people | Office health / Member 360 / Skills coverage / Monthly contribution | No visual supplied | [TeamIntelligenceWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/TeamIntelligenceWorkspace.tsx:75) |
| ES-070 | Select an member | Office health / Member 360 / Skills coverage / Monthly contribution | No visual supplied | [TeamIntelligenceWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/intelligence/TeamIntelligenceWorkspace.tsx:77) |

### Head intelligence and reports

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-071 | No approved contributions this month yet. | Reports → contribution summary | Local text; surrounding visual not independently classified | [ContributionSummaryCard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/productivity/components/ContributionSummaryCard.tsx:9) |
| ES-072 | No approved contribution for this period | Team Intelligence → Monthly contribution | Trophy (existing) | [MonthlyLeaderboard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/productivity/components/MonthlyLeaderboard.tsx:96) |

### Head people

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-074 | No active Office members | Office Team → Active Members / Invitations | No empty-state visual supplied | [OfficeTeamWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/office-team/components/OfficeTeamWorkspace.tsx:38) |
| ES-075 | No invitations yet | Office Team → Active Members / Invitations | No empty-state visual supplied | [OfficeTeamWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/office-team/components/OfficeTeamWorkspace.tsx:38) |
| ES-076 | No matching results | Office Team → Active Members / Invitations | No empty-state visual supplied | [OfficeTeamWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/office-team/components/OfficeTeamWorkspace.tsx:38) |

### Head reports

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-077 | No report rows match | Seven operational report lenses / contribution summary | BarChart3 (supplied) | [HeadReportsWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reports/components/HeadReportsWorkspace.tsx:434) |

### Head supervision and IAM

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-080 | No office people match this search. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [HeadIAMWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx:275) |
| ES-082 | No active dept members match this search. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [HeadIAMWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx:490) |
| ES-083 | Choose a member to inspect their access | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | UserRoundCog (existing) | [HeadIAMWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx:502) |
| ES-088 | No office people match this search. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [OfficeIdentityAccessPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/OfficeIdentityAccessPanel.tsx:173) |
| ES-089 | No immediate intervention required | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | CircleAlert (existing) | [TeamAttentionQueue.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamAttentionQueue.tsx:39) |
| ES-090 | No team members match this search. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberBoard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberBoard.tsx:43) |
| ES-091 | No team members match this search. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberBoard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberBoard.tsx:85) |
| ES-092 | Select a team member | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberOperationsPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberOperationsPanel.tsx:36) |
| ES-095 | No active task participation. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberOperationsPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberOperationsPanel.tsx:88) |
| ES-096 | No active delegated subtasks. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberOperationsPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberOperationsPanel.tsx:99) |
| ES-097 | Choose a team member | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberWorkPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberWorkPanel.tsx:25) |
| ES-100 | No active task participation. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberWorkPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberWorkPanel.tsx:64) |
| ES-101 | No active delegated subtasks. | Team Supervision → Attention queue / People & workload / Identity & access; Office IAM tabs | Local text; surrounding visual not independently classified | [TeamMemberWorkPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/team-management/components/supervision/TeamMemberWorkPanel.tsx:75) |

### Inbox

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-102 | No review queue under your current access | Inbox / Needs action / Updates | No visual supplied | [ActionCenter.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/action-center/components/ActionCenter.tsx:81) |
| ES-103 | No personal task or subtask reviews pending | Inbox / Needs action / Updates | No visual supplied | [ActionCenter.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/action-center/components/ActionCenter.tsx:86) |
| ES-104 | No recent updates | Inbox / Needs action / Updates | No visual supplied | [UpdatesFeed.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/action-center/components/UpdatesFeed.tsx:29) |
| ES-105 | No unread recent updates | Inbox / Needs action / Updates | No visual supplied | [UpdatesFeed.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/action-center/components/UpdatesFeed.tsx:29) |

### Inbox and announcements

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-106 | No announcements found | Announcements → unread / all | Announcement (supplied) | [AnnouncementCenter.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/announcements/components/center/AnnouncementCenter.tsx:82) |
| ES-107 | You're all caught up! | Announcements → unread / all | Announcement (supplied) | [AnnouncementCenter.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/announcements/components/center/AnnouncementCenter.tsx:82) |

### My Work

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-109 | No matching work | Assigned work / Leading / Subtasks / History | No visual supplied | [PersonalWorkWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/PersonalWorkWorkspace.tsx:182) |
| ES-110 | No work in this view | Assigned work / Leading / Subtasks / History | No visual supplied | [PersonalWorkWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/PersonalWorkWorkspace.tsx:182) |

### My Work tools

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-115 | Your Head has not added a performance profile yet. | More work tools → Performance | No empty-state visual supplied | [EmployeePerformanceView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/Member/EmployeePerformanceView.tsx:183) |
| ES-116 | No subtasks found | Subtask workflow (not the current My Work tab itself) | CheckCircle2 (supplied) | [SubtasksWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/workflow/SubtasksWorkspace.tsx:344) |
| ES-117 | Nothing here. | Deadline calendar / Task history details / Work Report | Local text; surrounding visual not independently classified | [EmployeeDeadlines.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/members/components/core-work/EmployeeDeadlines.tsx:41) |
| ES-118 | Nothing here yet | Deadline calendar / Task history details / Work Report | History (supplied) | [EmployeeTaskHistory.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/members/components/core-work/EmployeeTaskHistory.tsx:58) |
| ES-119 | No tasks in range | Deadline calendar / Task history details / Work Report | FileText (supplied) | [EmployeeWorkReport.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/members/components/core-work/EmployeeWorkReport.tsx:162) |

### Personal workspace

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-120 | No tasks in this project. / No assigned tasks in this project. | Personal project → work / assigned-only | No empty-state visual supplied | [PersonalTaskList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/workspaces/components/PersonalTaskList.tsx:35) |
| ES-121 | No personal projects yet. | Personal project → work / members / files; workspace switcher | Local text; surrounding visual not independently classified | [PersonalWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/workspaces/components/PersonalWorkspace.tsx:34) |
| ES-122 | Select a personal project to view its work and members. | Personal project → work / members / files; workspace switcher | Local text; surrounding visual not independently classified | [PersonalWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/workspaces/components/PersonalWorkspace.tsx:35) |
| ES-123 | No available workspaces. | Personal project → work / members / files; workspace switcher | Local text; surrounding visual not independently classified | [WorkspaceSelector.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/workspaces/components/WorkspaceSelector.tsx:30) |
| ES-124 | No workspaces match your search. | Personal project → work / members / files; workspace switcher | Local text; surrounding visual not independently classified | [WorkspaceSelector.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/workspaces/components/WorkspaceSelector.tsx:30) |

### Planning and import

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-129 | No eligible members are available. | Import proposal PDF → draft / activities / task staffing | Local text; surrounding visual not independently classified | [AssignmentModal.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/proposal-import/components/AssignmentModal.tsx:178) |
| ES-130 | No tasks inside this activity. | Import proposal PDF → draft / activities / task staffing | Local text; surrounding visual not independently classified | [DraftCockpit.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/proposal-import/components/DraftCockpit.tsx:452) |
| ES-131 | Choose a government proposal PDF | Import proposal PDF → draft / activities / task staffing | Local text; surrounding visual not independently classified | [ProposalImport.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/proposal-import/components/ProposalImport.tsx:92) |

### Profile and member details

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-134 | No confirmed professional summary is available. This does not indicate whether a private PDS exists. | Professional profile (own Profile or authorized member inspector) | Local text; surrounding visual not independently classified | [ProfessionalProfilePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/professional-profile/components/ProfessionalProfilePanel.tsx:56) |

### Project core views

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-135 | No supported columns match your search. | Main table → groups / items / subitems / columns | Local text; surrounding visual not independently classified | [AddColumnButton.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-table/components/AddColumnButton.tsx:25) |
| ES-136 | No tasks in this group. | Main table → groups / items / subitems / columns | Local text; surrounding visual not independently classified | [ProjectGroupTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-table/components/ProjectGroupTable.tsx:34) |
| ES-137 | No tasks match these filters. Clear filters to see all project work. | Main table → groups / items / subitems / columns | Local text; surrounding visual not independently classified | [ProjectTableWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-table/components/ProjectTableWorkspace.tsx:94) |
| ES-139 | No subitems yet. | Main table → groups / items / subitems / columns | Local text; surrounding visual not independently classified | [SubitemRows.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-table/components/SubitemRows.tsx:56) |
| ES-140 | No dated work matches this view. Add dates to tasks below or in the Main Table. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectGanttView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectGanttView.tsx:86) |
| ES-141 | No tasks match these filters. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectInsightsView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectInsightsView.tsx:30) |
| ES-142 | No Office work to summarize. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectInsightsView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectInsightsView.tsx:31) |
| ES-144 | No upcoming task deadlines. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectInsightsView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectInsightsView.tsx:33) |
| ES-145 | No active task assignments. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectInsightsView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectInsightsView.tsx:34) |
| ES-146 | No Office work matches these filters. | Gantt / Project Dashboard / Offices | Local text; surrounding visual not independently classified | [ProjectOfficesView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-views/components/ProjectOfficesView.tsx:10) |

### Project detail and optional views

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-147 | No activity matches these filters | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | No visual supplied | [ProjectActivityTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectActivityTab.tsx:255) |
| ES-148 | No Financial Allocation | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Coins (supplied) | [ProjectBudgetTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectBudgetTab.tsx:34) |
| ES-149 | No blockers or overdue items requiring immediate intervention. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectDashboardTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectDashboardTab.tsx:261) |
| ES-150 | No upcoming deadlines scheduled. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectDashboardTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectDashboardTab.tsx:321) |
| ES-151 | No recent activity logged. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectDashboardTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectDashboardTab.tsx:387) |
| ES-153 | No overdue work. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectOverviewTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectOverviewTab.tsx:30) |
| ES-154 | No upcoming deadlines recorded. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectOverviewTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectOverviewTab.tsx:31) |
| ES-155 | No delivery activities recorded yet. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectOverviewTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectOverviewTab.tsx:34) |
| ES-158 | No attention items in the loaded project work. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectOverviewTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectOverviewTab.tsx:41) |
| ES-159 | No recent activity recorded. | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectOverviewTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectOverviewTab.tsx:44) |
| ES-160 | No activities yet | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | No visual supplied | [ProjectPlanInspector.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectPlanInspector.tsx:281) |
| ES-163 | No Originating Proposal | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | FileText (supplied) | [ProjectProposalContextTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectProposalContextTab.tsx:206) |
| ES-166 | No receipt packages yet | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | No visual supplied | [ProjectReportRegisters.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectReportRegisters.tsx:265) |
| ES-168 | No work matches these filters | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | No visual supplied | [ProjectReportsTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectReportsTab.tsx:291) |
| ES-169 | No project reviews are waiting | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | No visual supplied | [ProjectReviewsTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectReviewsTab.tsx:124) |
| ES-170 | No scheduled activities or tasks yet | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectTimelineView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectTimelineView.tsx:427) |
| ES-172 | No tasks | Overview / Timeline / Project Dashboard / Reports / Proposal Context / Activity / Reviews / Budget Overview | Local text; surrounding visual not independently classified | [ProjectWorkTab.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectWorkTab.tsx:121) |

### Project people and invitations

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-173 | No membership approvals pending | Members → Invitations; Reviews → Membership approvals | No visual supplied | [ProjectInvitationApprovalQueue.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-invitations/components/ProjectInvitationApprovalQueue.tsx:49) |
| ES-176 | No invites yet. | Members → Invitations; Reviews → Membership approvals | Local text; surrounding visual not independently classified | [ProjectInvitations.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-invitations/components/ProjectInvitations.tsx:34) |
| ES-177 | No onboarded eligible staff in this Office. Use Invitations below to request Head-approved project membership. No owner is assigned automatically. | Members → selected people / eligible Office staff | Local text; surrounding visual not independently classified | [ProjectMembers.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-members/components/ProjectMembers.tsx:27) |
| ES-179 | No project members match. | Members → selected people / eligible Office staff | Local text; surrounding visual not independently classified | [ProjectMembers.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-members/components/ProjectMembers.tsx:31) |
| ES-180 | No selected members yet. The appointed Office Head chooses existing people for this project. | Members → selected people / eligible Office staff | Local text; surrounding visual not independently classified | [ProjectMembers.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-members/components/ProjectMembers.tsx:31) |
| ES-181 | No active Office members match your search. Clear the search to choose existing staff. If nobody is onboarded, use Head-approved project Invitations in Members. | Offices → directory / inspector → Overview / Project team / Invitations | Local text; surrounding visual not independently classified | [OfficeMembersEditor.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-offices/components/OfficeMembersEditor.tsx:57) |
| ES-182 | No matching Offices | Offices → directory / inspector → Overview / Project team / Invitations | No empty-state visual supplied | [ProjectOfficeDirectory.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-offices/components/ProjectOfficeDirectory.tsx:78) |
| ES-183 | No project Offices yet | Offices → directory / inspector → Overview / Project team / Invitations | No empty-state visual supplied | [ProjectOfficeDirectory.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-offices/components/ProjectOfficeDirectory.tsx:78) |
| ES-184 | No invitation history is available under your current access. | Offices → directory / inspector → Overview / Project team / Invitations | Local text; surrounding visual not independently classified | [ProjectOfficeInspector.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/project-offices/components/ProjectOfficeInspector.tsx:25) |

### Projects portfolio

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-185 | No projects match the selected office. | Project tree / Projects and proposals / portfolio | Local text; surrounding visual not independently classified | [CitywidePlansOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/CitywidePlansOverview.tsx:39) |
| ES-186 | No work plans match the selected office. | Project tree / Projects and proposals / portfolio | Local text; surrounding visual not independently classified | [CitywidePlansOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/CitywidePlansOverview.tsx:42) |
| ES-187 | Star a project for quick access. | Favorites (project context sidebar) | No empty-state visual supplied | [ProjectContextSidebar.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/ProjectContextSidebar.tsx:165) |
| ES-188 | No projects yet | Project tree / Projects and proposals / portfolio | No visual supplied | [ProjectsPortfolioTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/ProjectsPortfolioTable.tsx:79) |
| ES-189 | No projects yet | Project tree / Projects and proposals / portfolio | No visual supplied | [ProjectsPortfolioTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/ProjectsPortfolioTable.tsx:90) |
| ES-192 | Select a project | Project tree / Projects and proposals / portfolio | Local text; surrounding visual not independently classified | [ProjectsWorkspace.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/ProjectsWorkspace.tsx:546) |

### Reviews

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-196 | Inbox zero | Project Tasks | CheckCircle2 (existing) | [ForReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/ForReviewInbox.tsx:328) |
| ES-198 | No matches for “ | Work Plans / Project Tasks / Governance & Approval / Subtasks / Budget / Membership approvals | Local text; surrounding visual not independently classified | [ForReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/ForReviewInbox.tsx:350) |
| ES-199 | Select a submission | Work Plans / Project Tasks / Governance & Approval / Subtasks / Budget / Membership approvals | Search (supplied) | [ForReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/ForReviewInbox.tsx:484) |
| ES-200 | Governance queue clear | Governance & Approval | CheckCircle2 (existing) | [GovernanceReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/GovernanceReviewInbox.tsx:134) |
| ES-204 | No subtask evidence waiting | Work Plans / Project Tasks / Governance & Approval / Subtasks / Budget / Membership approvals | CheckCircle2 (supplied) | [SubtaskReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/SubtaskReviewInbox.tsx:199) |
| ES-205 | Select evidence | Work Plans / Project Tasks / Governance & Approval / Subtasks / Budget / Membership approvals | Search (supplied) | [SubtaskReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/SubtaskReviewInbox.tsx:233) |
| ES-208 | No evidence submission was recorded for this subtask. | Work Plans / Project Tasks / Governance & Approval / Subtasks / Budget / Membership approvals | Local text; surrounding visual not independently classified | [TaskSubtaskEvidenceSection.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/TaskSubtaskEvidenceSection.tsx:117) |
| ES-209 | All work plans reviewed | Work Plans | CheckCircle2 (existing) | [WorkPlanReviewInbox.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/reviews/components/WorkPlanReviewInbox.tsx:133) |

### Shared controls

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-211 | No data found | Reused controls / tables / avatar fallback | No emptyIcon supplied by current table callers | [DataTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/ui/DataTable.tsx:45) |
| ES-212 | Nothing to show | Reused controls / tables / avatar fallback | No emptyIcon supplied by current table callers | [DataTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/ui/DataTable.tsx:164) |

### Shared shell

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-215 | No notifications yet | Notification popover / unread indicator | Local text; surrounding visual not independently classified | [NotificationBell.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/ui/NotificationBell.tsx:313) |
| ES-218 | No matches in your available content. | Navigation search / project tree / foreign Office context | Local text; surrounding visual not independently classified | [NavigationSearchDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/app-shell/components/NavigationSearchDialog.tsx:17) |
| ES-219 | No active projects. | Navigation search / project tree / foreign Office context | Local text; surrounding visual not independently classified | [WorkspaceNavigationPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx:53) |
| ES-220 | No archived projects. | Navigation search / project tree / foreign Office context | Local text; surrounding visual not independently classified | [WorkspaceNavigationPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx:53) |
| ES-221 | Star a project for quick access. | Favorites (workspace navigation tree) | No empty-state visual supplied | [WorkspaceNavigationPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx:53) |
| ES-223 | No messages yet. | Messages → channel list / conversation | Local text; surrounding visual not independently classified | [ActiveChatPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/chat-calls/components/ActiveChatPanel.tsx:366) |
| ES-228 | No chats yet. | Messages → channel list / conversation | Local text; surrounding visual not independently classified | [ChatChannelList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/chat-calls/components/ChatChannelList.tsx:159) |

### Task and subitem detail

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-229 | No activity yet. | Activity | Local text; surrounding visual not independently classified | [TaskActivityTimeline.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/workflow/TaskActivityTimeline.tsx:154) |
| ES-230 | No comments yet. Start the discussion. | Updates / discussion | Local text; surrounding visual not independently classified | [TaskDiscussion.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/workflow/TaskDiscussion.tsx:105) |
| ES-231 | No permitted work changes on this page. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkActivity.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkActivity.tsx:23) |
| ES-233 | No additional eligible project people are available. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkContributorsField.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkContributorsField.tsx:37) |
| ES-234 | No matching project people. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkContributorsField.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkContributorsField.tsx:37) |
| ES-235 | No subitems yet. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkHierarchy.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkHierarchy.tsx:75) |
| ES-236 | No eligible project people are available. Review eligible people in project Members. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkLeadField.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkLeadField.tsx:35) |
| ES-240 | No subitems yet. | Work → hierarchy / lead / contributors; Activity | Local text; surrounding visual not independently classified | [WorkTreeTable.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/nested-work/components/WorkTreeTable.tsx:17) |
| ES-241 | Ask team members to confirm their professional profiles, or select an owner manually in Main table. | Staffing suggestions → no generated results / no eligible confirmed profiles | No empty-state visual supplied | [StaffingDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/staffing/components/StaffingDialog.tsx:30) |
| ES-242 | Generate recommendations to review skills and workload before choosing an owner. | Staffing suggestions → no generated results / no eligible confirmed profiles | No empty-state visual supplied | [StaffingDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/staffing/components/StaffingDialog.tsx:30) |
| ES-245 | No progress updates have been submitted yet. | Subitem Work / Updates / Files / Activity / Review | Local text; surrounding visual not independently classified | [SubtaskProgressHistory.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/subtasks/components/SubtaskProgressHistory.tsx:18) |
| ES-248 | No submission evidence yet. | Overview / Work / Updates / Files / Activity / Review | Local text; surrounding visual not independently classified | [InspectorEvidence.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/task-inspector/components/InspectorEvidence.tsx:21) |
| ES-249 | No authorized workflow attachments yet. | Overview / Work / Updates / Files / Activity / Review | Local text; surrounding visual not independently classified | [InspectorFiles.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/task-inspector/components/InspectorFiles.tsx:17) |
| ES-250 | No progress updates yet. | Overview / Work / Updates / Files / Activity / Review | Local text; surrounding visual not independently classified | [InspectorProgressUpdates.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/task-inspector/components/InspectorProgressUpdates.tsx:10) |
| ES-253 | No eligible members match your search. | Choose people / task members | Local text; surrounding visual not independently classified | [TaskTeamEditorDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx:412) |
| ES-254 | No task members assigned. | Choose people / task members | Local text; surrounding visual not independently classified | [TaskTeamMemberList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/team/TaskTeamMemberList.tsx:15) |

### Task board tools

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-255 | No recurring task templates yet. | Recurring task templates (authorized task tools) | Local text; surrounding visual not independently classified | [RecurringTaskTemplatesPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/RecurringTaskTemplatesPanel.tsx:80) |
| ES-257 | No members match " | Legacy task board assignment picker (for supported older task records) | Local text; surrounding visual not independently classified | [AssignmentModal.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/AssignmentModal.tsx:146) |
| ES-258 | No scheduled tasks in the current scope. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [CalendarBoardView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/CalendarBoardView.tsx:28) |
| ES-259 | No dependencies are recorded for the current scope. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [DependenciesBoardView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/DependenciesBoardView.tsx:22) |
| ES-260 | No tasks yet in this board. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [HierarchyBoardView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/HierarchyBoardView.tsx:107) |
| ES-261 | No tasks | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [KanbanBoardView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/KanbanBoardView.tsx:320) |
| ES-262 | No recorded activity for the current task scope. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [TaskActivityHistoryView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/TaskActivityHistoryView.tsx:76) |
| ES-263 | No team members assigned yet. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [TaskEditorModal.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/TaskEditorModal.tsx:292) |
| ES-265 | No tasks with due dates to display on the timeline. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [TimelineView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/TimelineView.tsx:113) |
| ES-267 | No task records match this view. | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [WorkloadBoardView.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/WorkloadBoardView.tsx:56) |
| ES-268 | No messages yet. Start the conversation! | Office tasks / Task workspace → List / Kanban / Timeline / Hierarchy / Calendar / Dependencies / Workload / Activity | Local text; surrounding visual not independently classified | [TaskChatSection.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/tasks/components/board/task-chat/TaskChatSection.tsx:172) |

### Work plans and governance

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-269 | No open change requests | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [ChangeRequestsPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/ChangeRequestsPanel.tsx:241) |
| ES-271 | No comments yet | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [CollaborationDiscussion.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDiscussion.tsx:123) |
| ES-272 | No work plans in preparation | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationDraftList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDraftList.tsx:59) |
| ES-273 | No work plans waiting for approval | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationDraftList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDraftList.tsx:61) |
| ES-274 | No incoming reviews | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationDraftList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDraftList.tsx:62) |
| ES-276 | No reviews waiting | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationDraftList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDraftList.tsx:108) |
| ES-278 | No drafts | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationDraftList.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationDraftList.tsx:204) |
| ES-281 | Add a Program to start | Work-plan editor → no programs / draft tasks | Layers (existing) | [CollaborationPlanEditPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationPlanEditPanel.tsx:271) |
| ES-282 | No source PDF attached | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | No visual supplied | [CollaborationSourcePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CollaborationSourcePanel.tsx:101) |
| ES-283 | No matching delivery tasks | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [CommittedProposalBoard.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/CommittedProposalBoard.tsx:155) |
| ES-284 | No participating offices are recorded for this plan. | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [DepartmentApprovalMatrix.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/DepartmentApprovalMatrix.tsx:15) |
| ES-285 | No team assigned yet. Assignment is required before publication. | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [StaffingReviewPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/StaffingReviewPanel.tsx:428) |
| ES-286 | No Board resolution or meeting minutes have been recorded yet. | Work plans → preparation / waiting / incoming; draft/source/discussion/change requests/governance | Local text; surrounding visual not independently classified | [GovernanceRecordPanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/governance/GovernanceRecordPanel.tsx:160) |
| ES-287 | Governance activity will appear here. | Governance → unified timeline | No empty-state visual supplied | [GovernanceTimelinePanel.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/interdepartment-collaboration/components/governance/GovernanceTimelinePanel.tsx:29) |

### Work templates

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-288 | No eligible leading tasks | Saved work plans / template library / apply to a task | Local text; surrounding visual not independently classified | [SubtaskTemplateApplyDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/work-templates/components/SubtaskTemplateApplyDialog.tsx:100) |
| ES-289 | No existing subtasks. | Saved work plans / template library / apply to a task | Local text; surrounding visual not independently classified | [SubtaskTemplateApplyDialog.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/work-templates/components/SubtaskTemplateApplyDialog.tsx:124) |
| ES-290 | No templates in this view. | Saved work plans / template library / apply to a task | Local text; surrounding visual not independently classified | [SubtaskTemplateLibrary.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/work-templates/components/SubtaskTemplateLibrary.tsx:167) |

### Workspace overview

| ID | Current message | Location / tab | Existing visual | Source |
| --- | --- | --- | --- | --- |
| ES-291 | No active projects in this workspace. | Member/Accounting/personal-workspace overview → projects / attention | Local text; surrounding visual not independently classified | [WorkspaceOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/WorkspaceOverview.tsx:196) |
| ES-292 | No work in this category. | Member/Accounting/personal-workspace overview → projects / attention | Local text; surrounding visual not independently classified | [WorkspaceOverview.tsx](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/personal-work/components/WorkspaceOverview.tsx:224) |

## Inline placeholders and supporting copy

The CSV also records these as **Inline / secondary** or **Supporting copy for same state**. They are not automatic candidates for a large empty-state panel. Examples include no due date, no contributor, no project description, no cancellation reason, absent receipt files in a register row, missing profile fields, and “Not configured” metric values. A title and its description must not receive separate empty-state visuals simply because they have separate inventory rows.

| Area | Inline/supporting occurrences | Examples |
| --- | --- | --- |
| Access management | 2 | No organization |
| Account Audit | 1 | No note was recorded for this event. |
| Admin accounts | 4 | No skills added yet. Skills help the AI recommend the right member for each task.; No education rows found. |
| Admin configuration | 1 | No verified endpoint origin |
| Budget and accounting | 11 | Not configured; No state transition |
| Head dashboard | 2 | No tasks yet; No due date |
| Head intelligence | 3 | No decisions; Choose a person to inspect their source activity and delivery context. |
| Head people | 1 | No pending action |
| Head supervision and IAM | 11 | No Accounting Staff assigned; No email listed; No organization |
| Inbox and announcements | 1 | There are no unread announcements in your inbox right now. |
| My Work | 1 | No contributors assigned |
| My Work tools | 3 | No strengths have been recorded yet.; No growth areas have been recorded yet.; No additional coaching notes have been shared. |
| Planning and import | 5 | No proposal; Choose a document; No source-named Offices were verified. |
| Profile and member details | 1 | No confirmed summary |
| Project core views | 2 | No due date; No approved task allocation is recorded. |
| Project detail and optional views | 9 | No project purpose has been recorded yet.; No target; No activity recorded |
| Project people and invitations | 3 | No requested skills; No summary provided; No assigned responsibility |
| Projects portfolio | 5 | No project description; No office; Select a project from the left sidebar to open its workspace, or create a new plan to get started. |
| Reviews | 7 | No task submissions are waiting for your review. Other review types remain available above.; No governance decisions or formal approval items require your action at this time.; No contributors |
| Shared controls | 2 | There is nothing to display here yet.; No people assigned |
| Shared shell | 7 | No new notifications; Select a project in this shared Office context, or return to your Office to use Office tools.; none |
| Task and subitem detail | 10 | No contributors; No due date |
| Task board tools | 3 | No members selected; No backup reviewer; No due date |
| Work plans and governance | 5 | No task description recorded.; You're caught up. Work plans waiting for your review will appear here.; No incoming review requests require action. |

## Source-only appendix — keep out of the current-role icon rollout

These files contain copy but were not found in the current role outlet, or their old route is shadowed by the newer route. An export/barrel alone is not proof of an active screen. Nothing was deleted during this map.

| File/component | Evidence and scope |
| --- | --- |
| Old `HeadDashboard` | HeadContent still contains an older dashboard manifest entry, but RoleContent handles the Head dashboard through the current WorkspaceOverview/HeadWorkspaceDashboard before that manifest. |
| `SuperAdmin/DashboardOverview` and DataHealthPanel | Exported old dashboard components; current Admin outlet is account support, not the old operational dashboard. |
| Shared `workflow/ReportsWorkspace` | Retained export; active Head Reports uses HeadReportsWorkspace. |
| `EmployeeMyTasks` / `EmployeeMyProjects` | Old exported screens; current member routes use EmployeeTaskWorkspace and EmployeeProjectsWorkspace. |
| `AdminAnnouncements` / AnnouncementEditor | Retained exports/editor; not listed in the current Admin support outlet. Current operational Announcements uses AnnouncementCenter. |
| `organization/org-tree` pickers/panels | Former Office Structure UI; current people and project-Office workflows use their current feature owners. |
| `ProjectGovernanceTab`, `ProjectPlanTab`, `ProjectTeamTab` | Older project tab implementations; absent from the current ProjectCommandWorkspace tab rendering. Current Timeline still uses ProjectPlanInspector, which is mapped as current. |
| `AdminTaskOversight` / AdminTaskOversightRow | Retained compatibility export; not a current Admin destination. |
| `role-finance`, `role-hrmo`, `role-executive`, `role-legislative`, `role-head/legacy` | Prototype/old role trees were scanned but are not supported current role destinations. CSS “none”, votes/enum “NO”, sample records and prototype-only copy are excluded from the live-role catalog. Financial Officer coverage comes from `role-accounting` and budget components. |

The **36 source-only occurrences** remain filterable in `inventory.csv` by `visibility`. Do not interpret that number as 36 unused pages.

## State boundaries to preserve later

- **Empty data is not a failed read or denied access.** “Budget data unavailable,” “Project coverage is incomplete,” audit read failures, expired invitations, and Access denied are separate states; they were not cataloged as ordinary collection-empty copy.
- Some components use one wrapper for both an empty and an error title (Reports and several audit/workflow panels). The owner’s load/error guards must remain distinguishable.
- “No invitation history is available under your current access” and “No review queue under your current access” are access-context messages, not proof that no records exist.
- “No Financial Allocation” / “No Originating Proposal” can describe a valid manually created or no-budget project. An icon pass must not imply required remediation where the workflow does not require it.
- Calendar grids, fixed forms, numeric zero cards and table headers can be valid without a separate empty panel. No new messages have been invented for them.

## Evidence and limitations

This is a **static source map**, not a claim that every branch was reproduced in a browser or with each live account. Availability varies by permission, project/Office membership, work assignment, record type, filters, financial year and saved optional views. Source line links are a snapshot of the current working tree and may move after edits. Local Graphify was used to locate dependencies; active outlet/caller source was used to judge routing.

Only documentation/CSV artifacts and ignored local scan helpers were written. No icons were selected or added, no messages were rewritten, no app modules were edited, and no database reads/writes were needed. Application build/tests were not rerun for this documentation-only inventory.

Primary routing evidence: [Current role outlet](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/navigation/RoleContent.tsx:1) · [Role destinations](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/components/Layout/coreWorkflowNavigation.tsx:1) · [Admin/support pages](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/navigation/administrativePages.ts:1) · [Current sidebar subpages](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/navigation/sidebarContent.tsx:1) · [Project tab catalog](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/projectViewCatalog.ts:1) · [Project tab renderers](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/projects/components/project-command/ProjectCommandWorkspace.tsx:1) · [Accounting destinations](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/accountingNavigation.ts:1) · [Budget views](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/features/budget/budgetViews.ts:1) · [Supported role names](C:/Users/gabri/OneDrive/Desktop/EflowWeb/src/app/shared/roles.ts:1)
