# Project and Employee Analytics — 3 November 2026

Implemented the approved role overviews and merged employee analytics workspace in EflowWeb.

## Where to find it

| Account | First screen after login | Detailed workspace |
| --- | --- | --- |
| Head | Office overview: graphical project delivery and team workload | Workspace → Analytics |
| Member | My work overview: deadlines, returned work, approval waiting and personal actions | Open My Work; existing Assigned work, Leading, Subtasks and History remain |
| Accounting | Accounting Overview: financial queues and cash charts | Existing releases, settlements and budget destinations remain |

Projects now have an **Analytics** view alongside **Main table**, Board, Gantt, Calendar and the existing Project Dashboard. Analytics is a permanent view and survives a URL reload.

Old Team Supervision and Team Intelligence links resolve into the unified workspace. The sidebar presents one Analytics entry. Office Team remains available as an existing destination.

## One employee workspace

The Head's Analytics workspace contains:

1. **Overview:** status donut, project completion, team workload, completion trend, typical completion time, deadline reliability and attention records.
2. **Project analytics:** filters plus detailed Projects, People and Tasks tables.
3. **Employee analytics:** the same employee selection connects delivery comparisons, work assignments, reassignment controls and Employee 360. Existing coaching notes and employee development information remain available.
4. **Workload & health:** workload pressure, overdue work, blockers, stalled work and review waiting, with an attention queue. Multiple risk flags on one work item do not inflate its unique at-risk count. This is work health, not a medical or personal-health assessment.
5. **Skills coverage:** stored employee skills and manager-confirmed development tags, continuity coverage and gaps. Viewing this does not change skills used by AI assignment.
6. **Monthly contribution:** existing recognition and contribution history, with context rather than an unsupported productivity score.
7. **Team access:** Accounts & invitations and Identity & access, preserving their existing actions and permissions.

Employee 360 and coaching are still gated by Team Intelligence permission. Supervision and access controls retain their existing permission gates. Dirty coaching notes are protected when changing tabs or people. A Member cannot mount department employee analytics.

## Useful details in the tables

- **Projects:** lead, timeline, filtered task counts, completion, work in progress, approval waiting, overdue/blocked counts, and full project funding totals: authorized, allocated, released and spent.
- **People:** tasks led versus contributed to, active/completed counts, dated on-time and late submissions, current overdue work, median completion time, timed sample count, approval waiting and returns for changes.
- **Tasks:** project, lead/contributors, current status, colored deadline, recorded start/first submission/final approval, overdue days, unresolved prerequisites and allocated task funding.
- Filters: project, person, status, deadline range, overdue only and text search. Invalid date ranges show a red error and suppress misleading results.
- Chart legends and bars open the corresponding table or records. Tables load 25 rows at a time; project funding snapshots are shared between task rows and fetched only for visible rows, with three concurrent project reads at most.

## Metric definitions and limits

- Task status and project completion count each **parent task once**. Subtasks remain separate execution records. Archived and cancelled tasks are excluded from delivery comparisons.
- A completed task is a recorded completed status. Analytics completion percentages are calculated counts, not the retired manually entered task-progress percentage.
- **Typical completion time:** median recorded start → first submission for completed tasks led by that person. It excludes approval waiting and has a visible sample denominator. Missing timestamps produce “Not enough data,” never an invented duration based on last edit time.
- **Approval waiting:** recorded submission → decision intervals, presented separately from execution time.
- **Late submissions:** first submission after its task deadline. A reviewer approving late does not make an on-time submission late. Current overdue unfinished work is shown separately.
- **Weekly completions:** eight rolling seven-day periods ending today in Philippine time, based on recorded approval/completion history. Completed records without a recorded completion date do not get a fabricated chart date.
- Date filters refer to **task deadlines**. Project funding values remain full project totals even when task filters are narrowed; the screen says so.
- Workload includes lead-owned active tasks, contributor counts and estimated hours. Speed is not a fair standalone employee ranking; workload, samples and revision context remain visible.
- Blocked prerequisites use actual dependency records. Unavailable prerequisites are flagged without inventing their completion or exposing inaccessible titles.
- Read failures hide department comparisons and charts, instead of representing missing records as zero.

## Accounting and Member overview

Accounting charts distinguish settled spending, returned cash and outstanding advances. Available budget includes only active leaf accounts; it subtracts holds and the server's protected amount (or the canonical maximum of committed/spent when unavailable), rather than charging spending twice. Scheduled availability releases stay separate from physical cash release. Retired account schedules are excluded.

Office petty cash is a separate snapshot and launcher. Its fund does not get added to project or task budgets. Malformed/unavailable totals display an error rather than fabricated balances. Existing release and settlement actions are unchanged.

The Member overview contains root-task status and office-task completion history, Today/Upcoming/Overdue/Changes requested/Awaiting approval lists, chart drilldowns, projects the person leads, and their own receipt/liquidation action counts. Project leadership does not grant a system Head role. Existing work inspectors open the actual work record.

## Backend and data preservation

No schema, RLS, RPC payload, API endpoint, permanent role, account, password or workflow record was changed for this implementation. No invitation email was sent. Reads use existing authenticated adapters and database policies. The hosted target remains `ixnfphgjyelhckjwjkdv`.

Read-only authenticated-role SQL checks on the three existing account identities each returned two visible tasks and four history records. There were zero visible submissions and updates at check time. Consequently this dataset cannot yet produce a meaningful timed-completion comparison. Normal recorded work will populate it; demo statistics were not inserted into the live database.

Browser screenshots use intercepted synthetic test responses, not live financial transactions. This keeps visual/navigation tests repeatable without altering demonstration records. See the gallery and validation logs alongside this report.

## Bugs caught while implementing

| Problem | Fix |
| --- | --- |
| Current Head was absent from an otherwise valid one-person employee roster | Unified workspace explicitly includes the current user in the authorized directory |
| Project Analytics URL silently restored Main table | Added Analytics to validated project-view URL context and a regression test |
| Analytics destinations duplicated the sidebar | Consolidated presentation into one entry while preserving legacy route aliases and Office Team |
| Account totals could charge committed spending twice | Canonical protected amount / max(committed, spent), active leaves only; tested with nonzero financial examples |
| Retired release schedules could appear as pending Accounting work | Pending release counts and schedule use active leaf accounts |
| Legacy employee activity still printed the retired progress percentage | Activity now presents the recorded update, blocker and next step |
| Employee tab navigation could discard unsaved coaching edits | Registered the coaching draft with the existing navigation guard |
| A person with several attention flags could inflate the at-risk count | Count unique work records rather than risk flags |
| Employee 360 squeezed its labels based on viewport width instead of panel width | Panel-width-aware metric and coaching layout |
| Clicking active workload also listed completed tasks | Workload drilldown explicitly filters unfinished work |
| Returned and unassigned root tasks were missing from Member status legend | Added both status groups and retained drilldown to their records |

## Verification

Validation results and any unrelated suite failures are recorded in VALIDATION.md. Screenshots are in GALLERY.html. This report distinguishes automated fixture checks from read-only hosted checks; it does not claim an end-to-end financial write or invitation acceptance test.
