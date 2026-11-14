# Source audit and meeting delta — 11 November 2026

This document is a **dated source checkpoint**. Always re-read the latest `main` of each repo before acting.

- Mobile: `https://github.com/GabrielCahiyang/eFlow-e-Governance-ClientMobile`, `53d4d794fcb4303ee4a0a11fc4cb164b4ac402b9` (committed November 10 UTC).
- Web: `https://github.com/GabrielCahiyang/eFlow-e-Governance-Client`, `4ff217b84e3e8128555ffc87f0514253cd576399` (committed November 10 UTC).
- Latest Mobile catch-up QA: `docs/mobile-redesign/M7-personal-qa.md`, section **Subtasks, project tables and role priorities**; build 41 reported 274 tests / 84 suites, TypeScript, Android+iOS Hermes exports, Android emulator cold launch. The report explicitly marks physical signed-in verification and iOS device validation untested.
- Existing design foundations: `docs/mobile-redesign/design-system.md`.

## Meeting decision matrix

| Meeting revision | Observed in latest Mobile source | Design expectation and remaining work |
| --- | --- | --- |
| Rename Subitem → Subtask | **Implemented in affected mobile UI** | Audit remaining labels, accessibility names, loading/error/empty strings, notifications and deep links. Do **not** rename database tables, RPCs, or historical evidence. |
| Task start date | **Displayed** in `tasks/TaskDetailsScreen.tsx` and `projects/ProjectTableCells.tsx` | Validate date presentation and empty values. `Task.startDate` is mapped in `core/web/.../taskMapper.ts`. |
| Add Subtask start date, default today | **BLOCKED** | `WorkEditorSheet.tsx` reports unavailable; no canonical start-date fields/commands in Office + Personal subtask flows. Needs safe backend migration/contract reviewed separately. Avoid fake local-only field. |
| Default Subtask Lead = Task Lead | **Implemented conditional default** in `tasks/branchInspector.ts`, `WorkEditorSheet.tsx` | Only eligible directory members can be preselected. Product refinement: for *nested* creation, use nearest eligible parent lead if approved by business rules, else root lead; never assign invalid staff. |
| Inline Subtask Activity | **Implemented** `tasks/WorkTreePanel.tsx` + redesigned `OfficeSubitemActivity.tsx` | Activity is immediately visible and chronological. Audit event merging, duplication, author/date/evidence correctness, paging and screen-reader order. |
| Item-completion percentage | **Implemented as display semantics** `app/shared/completion.ts`, `tasks/branchInspector.ts`, `projects/ProjectScreen.tsx`, `dashboard/OverviewScreen.tsx` | Project = completed root tasks / required root tasks; task/subtask = completed direct children / direct children; leaf status fallback. Clarify whether denominator includes cancelled/ineligible items; never count pending review as completed. |
| Project Main table: no Office, add Budget/Actual expense | **Implemented** in `projects/ProjectTableCells.tsx`, `projectTaskFinance.ts` | Approved root allocations and settled authorized cash expenses only; show `—` when unavailable; avoid confusing released cash with expense. Verify source totals vs Web and visibility by role. |
| Projects page as compact table | **Implemented** `projects/ProjectsScreen.tsx`, shared row in `ProjectTableCells.tsx` | Columns Project, Status, Type. Ensure tight/mobile-resilient widths, row focus, separate favorite target and screen-reader labels. |
| Role-specific Home instead of Recently visited | **Implemented** `dashboard/OverviewScreen.tsx`, `HomeAttentionCard.tsx` | Head: up to 3 current projects, on-hold/active priority, percent/status. Member: up to 3 assigned priorities, overdue/due today. Ensure one-tap exact destination and workspace filtering. |
| Contributor changes require nearest Lead acceptance | **BLOCKED** | Mobile blocks some direct execution in `tasks/branchInspector.ts`, `WorkTreePanel.tsx`, `WorkEditorSheet.tsx`. Backend does not yet stage all contributor changes for authorized nearest-lead decision and atomic accepted application. Never treat UI denial as completed review workflow. |
| Evidence explicitly optional | **Implemented** `tasks/EvidencePicker.tsx` | Verify actually optional by server policy for each flow; if a specific action requires evidence, label accurately. Completion note differs by task/subtask flow. |
| “Submit finished work” → “Mark as complete” | **Implemented** `TaskDetailsScreen.tsx` | Action text may start submission/review; subsequent receipt must say **Awaiting approval** until approved. Avoid false completion. |
| Notifications remove Assigned decisions | **Implemented** `notifications/ActionInbox.tsx` | Inbox All/Unread updates, separate **Reviews** route in More. Protect exact route/financial IDs and unread semantics. |
| Overlapping Approve button | **Fixed in source** `tasks/TaskReviewPanel.tsx` | Stacked full-width actions. Must verify physically at 360dp, long labels, 200% font and keyboard. |
| Accounting no Home; Accounting main nav; useful More | **Implemented** `navigation/mobileScope.ts`, `MoreScreen.tsx` | Accounting is a main tab; More includes Reviews, Messages, Announcements, authorized Office petty cash, Account/settings. Do not duplicate a dashboard without a defined accounting job. |

## Technical map (paths relative to Mobile repo)

### UI and interaction

- `src/app/features/tasks/TaskDetailsScreen.tsx`: root details, completion action, start date, views.
- `src/app/features/tasks/WorkTreePanel.tsx`: node summary and contextual actions, automatic activity, child navigation.
- `src/app/features/tasks/OfficeSubitemActivity.tsx`: chronological activity, evidence and review history.
- `src/app/features/tasks/WorkEditorSheet.tsx`: Subtask form/draft, due date, lead selection; unsupported start date.
- `src/app/features/tasks/branchInspector.ts`: lead default, contributor guard, direct-child completion, work capability.
- `src/app/features/tasks/TaskEvidenceSheet.tsx`, `EvidencePicker.tsx`, `SubtaskCompletionSheet.tsx`: evidence and completion copy, drafts.
- `src/app/features/tasks/TaskReviewPanel.tsx`: independent review and cash-clearance checks.
- `src/app/features/projects/ProjectsScreen.tsx`, `ProjectTableCells.tsx`, `ProjectScreen.tsx`, `projectTaskFinance.ts`: compact directory, pinned task table, status and finance values.
- `src/app/features/dashboard/OverviewScreen.tsx`, `HomeAttentionCard.tsx`: role-aware Home.
- `src/app/features/notifications/ActionInbox.tsx`, `src/app/features/navigation/MoreScreen.tsx`, `mobileScope.ts`: Inbox/Reviews/Accounting navigation.

### Shared contracts

- `src/core/web/app/features/nested-work/types.ts`, `types/editor.ts`, `services/workTreeService.ts`, `selectors/capabilities.ts`, `selectors/editorDraft.ts`: nested work protocols.
- Web Supabase migrations and backend commands are authoritative for role, schedule, approval, journal and spending rules.
- Existing `r7_work_command` / `nw_work_command` use due date, not the missing canonical Subtask start date.
- Existing `save_subtask_work_update` can apply a work update immediately; this is **incompatible with a new universal contributor pending-review requirement** until a server staging contract exists.

## Source-of-truth caution

This last source review was read-only. No repo, Supabase, production fixture, Git branch, migration or deployment was changed. New commits supersede these source observations. Do not use component code as proof of an end-to-end authorized flow; prefer approved two-account device sessions and server receipts.
