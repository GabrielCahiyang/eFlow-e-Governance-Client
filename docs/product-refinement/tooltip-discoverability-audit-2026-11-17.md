# eFlow tooltip and icon discoverability audit

Date: 17 November 2026, Asia/Singapore. Status: **audit and recommendations only**.

## 1. Recommendation

Use short, consistent Vibe tooltips for controls whose action is represented only by an icon. Prioritize controls used repeatedly in navigation, project tables, chat, editing, and finance. Add missing accessible names before adding tooltip presentation. Keep workflow consequences, validation, permission restrictions, and financial meanings visible where people make decisions. Preserve existing useful tooltips and avoid repeating labels that are already readable.

The notification bell and chat button in the supplied screenshot are examples of browser `title` hints in the current source. eFlow already has additional Vibe tooltips, optional tooltip support in shared menus/popovers, and built-in Vibe IconButton tooltips. The task is consistent coverage and behavior, rather than adding a tooltip to every icon.

### Scope and evidence

- Inspected the working tree at local commit `586bc220`, including existing uncommitted work. Additional workspace edits appeared while this audit was in progress; the final scan includes a per-file SHA-256 manifest and scan timestamp in JSON. No comparison with remote HEAD or hosted acceptance is claimed.
- Scanned **all 796 TSX/JSX files under `src/`**, including **58 feature directories**, shared components, login, and compatibility/legacy surfaces.
- Catalogued **1,403 common button/link/trigger JSX sites**, **121 additional custom/other click sites**, and **712 icon JSX sites**. These are source sites, not counts of rendered buttons or unique interactions. Dynamic lists can render one source site many times.
- The heuristic identified **176 icon-only control candidates**. After accounting for explicit wrappers/props and installed Vibe behavior, **136 candidate sites** remain: **111 without a detected tooltip or native title**, and **25 with a native title only**. These include reusable definitions, nested trigger duplicates, and some older source; they are a triage inventory, not 136 confirmed user-facing defects.
- Found **70 explicit Tooltip component sites**, including **27 chart Tooltip sites**. Also found **96 native HTML title sites**, including iframe titles and ordinary text. Neither figure means that all those sites need replacement.
- Verified installed Vibe IconButton implementation: it uses explicit tooltip content or falls back to `aria-label`, unless `hideTooltip` is set; `disabledReason` can replace that content while disabled. **17 icon-only sites use that built-in mechanism**, some additionally wrapped. Do not add duplicate tooltips to them.
- Used a conservative local import graph to distinguish possible entrypoint paths from source with no detected path. Barrel exports overestimate usage. Route, role, and runtime mounting remain separate verification steps.
- Reviewed the supplied header screenshot. No signed-in browser walkthrough, hover/focus interaction test, touch test, screen-reader test, or hosted data access was performed.

Full coverage, individual candidate locations, existing tooltip sites, native-title sites, and dynamic controls are in the [readable inventory](../../artifacts/ux-audits/tooltip-inventory-2026-11-17.md). The [JSON inventory](../../artifacts/ux-audits/tooltip-inventory-2026-11-17.json) retains snippets and classification evidence. The temporary audit script is `.codex-tmp/audit-tooltip-controls.cjs`.

### Design sources

The local direction is [the eFlow UX Writing Standard](../../eflow_codex_vibe_overhaul_phased/foundation/04_UX_WRITING_STANDARD.md), [Vibe Implementation Standard](../../eflow_codex_vibe_overhaul_phased/foundation/03_VIBE_IMPLEMENTATION_STANDARD.md), and [Visual Quality Bar](../../eflow_codex_vibe_overhaul_phased/foundation/06_VISUAL_QUALITY_BAR.md). The official [monday handbook](https://vibe.monday.com/?path=/docs/foundations-ux-writing-handbook--docs) returned no readable content through the browsing tool; this audit does not claim to have verified its full text. Installed Vibe accessibility metadata and component implementation were inspected directly.

## 2. Current-state ledger

| Status | Evidence | Decision |
|---|---|---|
| DONE IN SOURCE | `WorkspaceTooltip.tsx:7` uses Vibe Tooltip. `ActionMenu.tsx:41` and `WorkspacePopover.tsx:5` support optional tooltip text. | Reuse these supported patterns; avoid a second generic tooltip system. |
| DONE IN SOURCE | `ProjectTaskRow.tsx:60`, `ProjectGroupTable.tsx:40–42`, `AddColumnButton.tsx:12`, and `WorkNodeActionMenu.tsx:16` already supply tooltips. | Preserve task/group actions, expand/collapse, add-column, color, and subtask-action coverage. |
| DONE IN SOURCE | `OwnerAvatarStack.tsx:24`, `PeopleAvatarStack.tsx:17`, calendar navigation, Gantt navigation, organization zoom controls, and task-inspector close controls have tooltip patterns. | Verify their behavior; do not schedule them again as missing. |
| DONE IN SOURCE | Vibe IconButton includes label-derived tooltip behavior, covering examples such as login password visibility and announcement-detail close. | Check actual rendered behavior before proposing changes to Vibe IconButton. |
| DONE BUT NEEDS UX POLISH | Notifications/messages and several older controls rely on native `title`; timing and presentation differ from the shared Vibe pattern. | Migrate useful action hints selectively, preserving accessible names and unread state. |
| SOURCE GAP | Sidebar collapse, workspace options, favorites, column menus, chat actions, rich-text controls, and finance editor controls have confirmed examples without tooltip coverage. | Add short, contextual action hints in a later implementation slice. |
| SOURCE GAP | Several icon-only buttons have neither an explicit name nor visible action text, including call controls and skill add/remove controls. | Correct naming and state semantics; tooltip presentation alone is insufficient. |
| NEEDS RUNTIME VERIFICATION | Shared tooltip DOM associations, keyboard focus/Escape, portal placement, overlay stacking, disabled behavior, and touch equivalents. | Do not declare accessibility compliance from the component name or build output. |

## 3. Prioritized recommendations and exact copy

Priority P1 means a naming gap or a high-frequency ambiguous control. P2 means consistent supplemental help. P3 means evaluate in context, especially older or specialist screens. All entries below are proposals.

| Area / opening path | Source evidence | Recommendation and copy | Priority |
|---|---|---|---|
| Header → Notifications / Messages | `components/ui/NotificationBell.tsx:267`; `features/chat-calls/components/MessagesButton.tsx:8` | Use one Vibe hint for each icon: **Notifications** / **Messages**. Keep unread totals in the badge and accessible name or description; do not announce a count as the only action name. Suppress the hint when its panel/menu is open. | P2 |
| Header → Help / Account | `features/app-shell/components/EflowTopBar.tsx:83`; screenshot | Labels already explain the controls. No redundant **Help** or **Account** tooltip. Add a hint only if a responsive layout actually hides the visible label. The adjacent avatar is not a separate action. | Preserve |
| Navigation → context rail | `features/app-shell/components/ContextRailHeader.tsx:4` | **Collapse sidebar** / **Expand sidebar**, reflecting the next action. Keep the contextual accessible name. | P1 |
| Workspaces → header options / favorite star | `WorkspaceNavigationPanel.tsx:57`; `WorkspaceProjectLinks.tsx:13` | **Workspace options**; **Add to favorites** / **Remove from favorites**. The project name belongs in the accessible name. | P1 |
| Global navigation and labelled destinations | `GlobalNavigation.tsx:15`; `ContextRail.tsx:11` | Preserve visible labels. Do not add a second popup repeating **My Work**, **Workspaces**, or **Inbox** while those labels remain visible. | Preserve |
| Projects → All projects → row ellipsis | `features/projects/components/ProjectsPortfolioTable.tsx:191` | **Project actions**. The row-specific accessible name should retain the project title. This portfolio menu lacks the tooltip already present in the separate project-workspace utilities menu. | P1 |
| Project / subtask table → column ellipsis | `features/project-table/components/TableColumnHeader.tsx:14`; `features/nested-work/components/WorkTableColumnHeader.tsx:40` | **Column options**. Keep the column name in the accessible label. Existing Add column and task/group action tooltips should remain. | P1 |
| Project table → subtask detail icon | `features/project-table/components/SubitemRows.tsx:54` | **Open subtask details**. Match the already-covered task detail icon. | P2 |
| Main Table → resize handle | `components/ui/workspace/TableColumnResizer.tsx:20` | Short hint **Resize column**. Put keyboard instructions in an accessible description or contextual help: **Drag or use arrow keys. Double-click to reset.** Preserve its separator semantics and value attributes. Do not replace the keyboard interaction with hover help. | P2 |
| Project schedule → Gantt bar and endpoints | `features/project-views/components/ProjectGanttView.tsx:79–84` | **Edit task dates**, **Adjust start date**, **Adjust end date**. Keep the date editor reachable without dragging. Existing earlier/today/later toolbar tooltips remain. | P2 |
| Project plan → milestone controls | `features/projects/components/project-command/ProjectPlanInspector.tsx:243`, `:251`, `:652` | Existing Vibe IconButton behavior covers label-derived hints. Preserve **Move … earlier**, **Move … later**, and **Delete …**. Do not add another outer tooltip. | Preserve |
| Task → completion note editor | `components/ui/RichTextEditor.tsx:36`, `:44`, `:52`, `:60` | **Bold**, **Italic**, **Bulleted list**, **Numbered list**. Retain explicit accessible names. Show a shortcut only after confirming the actual editor binding and platform display. | P1 |
| Task / subtask → evidence removal | `components/workflow/SubmitForReviewForm.tsx:131`; `features/work-state/components/WorkExecutionForm.tsx:62` | **Remove attachment**. Keep the filename in the accessible name. No tooltip on the already-labelled upload area or primary submission action. | P2 |
| Subtasks → sequence controls | `features/subtasks/components/sequencing/SubtaskSequenceControls.tsx:20`, `:29–30` | Replace browser-only hints with **Reorder step**, **Move step up**, **Move step down** where appropriate. Keep prerequisite/locked reasons visible when they prevent work. | P2 |
| Task discussion → comment options | `components/workflow/TaskDiscussion.tsx:126` | Add an accessible name and **Comment actions** hint. Preserve its existing menu and handlers. | P1 |
| Messages → conversation toolbar | `features/chat-calls/components/ActiveChatPanel.tsx:166–175`; `ChatChannelList.tsx:69` | **Pin chat** / **Unpin chat**, **Start audio call**, **Start video call**, **Chat details**, **New message**. Preserve menu expanded/pressed state and avoid a tooltip lingering over an opened panel. | P1 |
| Messages → composer / message hover actions | `ActiveChatPanel.tsx:224–247`; `MessageHistory.tsx:66–74` | **Cancel reply**, **Remove image**, **Attach image**, **Send message**, **Add reaction**, **Reply**, **Message actions**, **Close pinned message**. Every hover-revealed action must also appear on keyboard focus; tooltips cannot solve a hidden-action problem by themselves. | P1 |
| Audio/video call → controls | `components/ui/CallModal.tsx:104`, `:111`, `:118`; called from `MessagesContext.tsx:57` and `IncomingCallListener.tsx:54` | Add action names plus hints: **Mute microphone** / **Unmute microphone**, **Turn camera off** / **Turn camera on**, **End call**. Add appropriate toggle state and keep the end-call action distinct. These current buttons lack explicit accessible names. | P1 |
| Office Budget / Accounting → calendar and year arrows | `BudgetReleaseCalendar.tsx:46–48`; `FiscalYearControl.tsx:24`, `:51` | **Previous month**, **Next month**, **Previous fiscal year**, **Next fiscal year**. Retain the year/date in the accessible name or nearby visible context. | P2 |
| Budget / journal / liquidation / funding editors | `BudgetSectionEditor.tsx:186–202`; `JournalAdjustmentDialog.tsx:375`; `CashLiquidationDialog.tsx:108`; `ProjectFundingPanel.tsx:80`; `TaskProjectFunding.tsx:79` | **Move section up**, **Move section down**, **Remove section**, **Remove journal line**, **Remove receipt**, **Remove funding row**. Include the target identity in the accessible name. Required minimum rows and posting restrictions need visible explanations. | P2 |
| Budget request line editors | `ProposalBudgetSection.tsx:56–76`; `TaskBudgetEditor.tsx:84`, `:111`; `BudgetReleaseScheduleEditor.tsx:64` | Short contextual remove hints. Distinguish removing an unsaved row from deleting a saved financial record. Tooltip wording must not imply an accounting reversal. | P2 |
| Finance values, dependency blockers, reviewer state | `ProjectActualExpenses.tsx:80–81`; `PrerequisiteCell.tsx:47–49`; `SubtaskReviewerBadge.tsx:31` | Keep status, authorization limits, pending approval, and the meaning of amounts visible. Tooltips may elaborate but must not be the only way to learn that an amount is partial or work is blocked. Do not display unauthorized names in a hint. | P1 content rule |
| Administration → create/edit user → skills | `CreateUserModal.tsx:423`, `:444`; `EditUserModal.tsx:308`, `:329` | Add explicit names and **Add skill** / **Remove skill** hints. Include the skill name in each removal label. These are confirmed icon-only naming gaps. | P1 |
| Import / work-plan assignment → close, clear, remove person | `features/proposal-import/components/AssignmentModal.tsx:113`, `:133`, `:157`; `features/tasks/components/board/AssignmentModal.tsx:105`, `:129` | **Close assignments**, **Clear search**, **Remove person**; use a person-specific accessible name. Preserve the independent lead-selection rule and its existing state. | P1 |
| Imported draft task → enabled control | `features/proposal-import/components/DraftTaskRow.tsx:80` | Prefer checkbox/toggle semantics with visible/accessible **Include task**. Explain excluded state in the row. A tooltip alone is inadequate for the currently unnamed checkbox-like button. | P1 |
| Work templates → close / remove step | `SubtaskTemplateApplyDialog.tsx:93`, `:159`; `SubtaskTemplateEditor.tsx:97`, `:201` | Add names and **Close template**, **Remove step** hints. Provide a visible reason when the last step cannot be removed. | P1 |
| Office Team / project Office / invitation inspectors | `InvitationTable.tsx:84`; `OfficeMemberInspector.tsx:42`; `ProjectOfficeInspector.tsx:22`; `InviteMemberDialog.tsx:60` | **Invitation actions**, **Close member details**, **Close office details**, **Remove invitation row**. Preserve separate account, Office membership, project membership, and invitation authority. | P2 |
| Organization tree → undo toast / people removal | `UndoNotifications.tsx:38`; `GovernanceRosterPanel.tsx:341` | Name the close/remove actions, such as **Dismiss message** and **Remove person**. Existing organization zoom hints remain. Do not hide the Undo action in a tooltip. | P1 |
| Help assistant / live guidance → icon controls | `HelpAssistantDialog.tsx:85–86`; `HelpLiveView.tsx:30–31`; `GuidedTourCard.tsx:46` | **Dictate question** / **Finish dictation**, **Send question**, **Mute spoken replies** / **Enable spoken replies**, **Pause live help** / **Resume live help**, **Exit walkthrough**. Keep browser-support or permission limitations available outside disabled-button hover. | P2 |
| Shared dialogs, drawers, toast dismiss controls | `components/ui/dialog.tsx:77`; `Toast.tsx:77`; `ReportsWorkspace.tsx:781` | Use concise contextual close hints where the action is icon-only. Existing screen-reader text such as the dialog's **Close** must remain; lack of a tooltip does not mean it has no accessible name. Ensure portal content stays inside the correct overlay interaction boundary. | P2 |
| People and truncated text | `OwnerAvatarStack.tsx:24–41`; `PeopleAvatarStack.tsx:17`; `WorkPeopleSummary.tsx:17`; `WorkspaceSelector.tsx:33` | Preserve existing person-name hints. Reveal the full authorized text when genuinely truncated. Provide a click/tap details alternative for essential identity. Do not repeat an already-readable name or description on every row. | P2 conditional |
| Charts and specialist legacy screens | Recharts Tooltip sites; sources without detected entry paths in inventory | Chart data hints need their own accessible-data review. Do not wrap chart tooltips in button tooltips. Confirm supported role/route reachability before spending implementation effort on legacy source. | P3 |

Paths in this table are relative to `src/app/` unless stated otherwise; the inventory supplies clickable absolute file links and individual source lines.

## 4. Proposed tooltip interaction and writing standard

1. **Purpose:** identify an unfamiliar icon action or supply brief secondary context. Do not use tooltips as the only label, validation message, financial explanation, approval consequence, or disabled reason.
2. **Content:** sentence case, usually two to five words, no final punctuation for short action labels. Describe the next action: **Unpin chat** when already pinned. Use **Subtask** in new user-facing copy; preserve persisted names and historical evidence.
3. **Implementation:** use installed Vibe Tooltip, existing `WorkspaceTooltip`, `ActionMenu.tooltip`, or `WorkspacePopover.tooltip` according to the host component. Prefer Vibe IconButton's existing tooltip support when the control is already a Vibe IconButton. Do not globally auto-wrap all buttons or swap icon libraries as part of a tooltip pass.
4. **Timing:** propose the Vibe default show delay of 300 ms for consistent new coverage; reconcile the existing workspace helper's 150 ms deliberately during implementation. Keep hover discovery calm in dense tables. This is a product recommendation, not a WCAG timing requirement.
5. **Keyboard and semantics:** show useful hints on focus as well as hover, dismiss with Escape, retain trigger focus, and ensure the tooltip description is associated with its trigger. Inspect the actual DOM; `WorkspaceTooltip` currently adds `role="tooltip"` to its content but does not explicitly assign an ID/description link in its own source. This is a verification item, not a proven runtime failure.
6. **Pointer and overlays:** keep content hoverable and present long enough to read, allow viewport-aware positioning, and avoid obscuring the active menu or dialog. Suppress hints while a related menu/popover is open. Avoid nested tooltips or a native title plus a custom tooltip on the same action.
7. **Touch:** essential action names and guidance must remain available through visible labels or an opened menu/sheet. Do not require hover or a long press to understand how to complete work.
8. **Disabled controls:** do not assume a disabled button receives focus or pointer events. Explain the limitation in its local workflow context; preserve the disabled guard. Add supplemental hover help only if it does not become the sole explanation or create misleading focus behavior.
9. **Privacy:** derive text only from records already authorized for the current actor. Do not expose hidden collaborators, restricted dependencies, financial values, UUIDs, or backend terms through tooltip strings.

These interaction recommendations follow [W3C's tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) and [WCAG 2.2 guidance on content appearing on hover or focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html). The APG tooltip pattern itself is marked work in progress. WCAG's guidance requires custom hover/focus content to be dismissible, hoverable, and persistent as applicable; native browser title rendering has an exception and is not automatically a WCAG 1.4.13 failure.

## 5. Role and workflow impact

- **All roles:** consistent shell, account, help, notification, message, close, and search-clear discoverability. Preserve readable navigation labels.
- **Head / Member / contextual leads:** task, subtask, project, people, review, evidence, and assignment hints explain existing authorized actions. No new execution or review authority.
- **Accounting Staff / authorized financial actors:** budget and posting controls retain Office/FY, row constraints, approval stages, and financial meaning. No service, posting, or financial-state changes.
- **Admin:** account, skills, permission controls, organization, audit, and data tools retain their current support permissions. Existing Vibe role/access tooltips need behavior verification, not a policy rewrite.
- **Specialist and legacy surfaces:** inventory coverage does not certify a supported navigation path. Resolve the existing caller and permission boundary before implementation.
- **Mobile companion:** this audit covers the Web repository and responsive Web. It is not an audit of a separate native Mobile checkout.

## 6. Suggested implementation slices and acceptance

| Slice | Scope | Acceptance evidence needed |
|---|---|---|
| 1 | Missing accessible names: calls, skills, assignment controls, templates, draft inclusion | Named controls, correct toggle/checkbox state, keyboard operation, unchanged actions and guards. |
| 2 | Shared header/navigation/menu and tooltip behavior | One hint per icon, keyboard focus/Escape, correct trigger relationship, menu handoff, unread state, no duplicate IconButton hints. |
| 3 | Main Table, subtasks, formatting, chat and evidence | Correct target labels, hover/focus parity, no clipped hints, no intercepting row clicks, no layout or drag regressions. |
| 4 | Budget/accounting, Office management, help, remaining dialogs | Visible restrictions and financial context retained; disabled controls and overlay layers verified. |
| 5 | Conditional truncation and specialist/legacy coverage | Confirmed role/route reachability, authorized text only, full information reachable by touch, no tooltip spam. |

For each approved visible slice: check 1600px and 1366px desktop, tablet and narrow mobile; light/dark; zoom and text scaling; keyboard; reduced motion; menu/dialog layering; and representative screen-reader output. Keep row selection, popover focus return, dirty-form guards, and drag/resize behavior unchanged. Run `npm run check`, affected interaction tests, `npm test`, `npm run build`, and configured affected browser smoke tests before declaring implementation complete.

**Verification status:** repository scan completed; representative source findings manually inspected; installed Vibe behavior inspected. Browser interaction, screen reader, device/touch, and hosted acceptance **NOT TESTED**. No passing application-test result is claimed for this audit.

## 7. Handoff boundary

The user explicitly selected **Audit with recommendations only**. No application source, permissions, APIs, database, Git history, or deployment was changed for this audit. The report, generated inventories, and temporary audit helper are the only new work. All implementation slices above remain proposals.
