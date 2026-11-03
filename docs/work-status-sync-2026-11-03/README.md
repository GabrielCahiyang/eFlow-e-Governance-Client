# Work status synchronization — 3 November 2026

Target: `ixnfphgjyelhckjwjkdv`. This change fixes status persistence and automatic refresh across Office work views, including **My Work → Leading**.

## Bugs and fixes

| Bug | Fix |
| --- | --- |
| A text-only task update left the task at Not started because the server expected a positive percentage. | The checked update operation starts work without a percentage. The Task Lead can also resume returned work; contributors cannot resume it on the Lead's behalf. |
| Starting or completing a subtask left its parent at Not started. | The existing rollup starts an untouched parent when actual subtask work exists. Merely planning subtasks does not start it. The parent remains In progress until its Lead submits it for review. |
| Main table and My Work could keep an old status after another screen/account saved work. | Shared Realtime invalidation triggers fresh authorized reads. Local committed work events do the same. Focus and 15-second polling remain as recovery when Realtime is unavailable. No manual Refresh is required for the normal path. |
| A change arriving during an in-flight task/subtask/tree read could be lost. | Queue another read after the pending read. Stale actor/scope responses cannot replace the current account's data. |
| My Work combined an older task list with a newer tree snapshot. | Use the newer root status consistently for the displayed row, inspector task, actionability and History placement. This also covers personal-project rows. |
| Leading hid review-pending work because it was no longer actionable. | Keep it visible as Awaiting approval, read-only. Approved/completed work moves to History. |
| Background refresh made existing My Work/subtask lists flash a loader. | Keep loaded rows visible while refreshing quietly. Initial loads and genuine read failures retain explicit feedback. |
| Multiple updates in one transaction could have identical timestamps and select an older blocker. | New work updates use `clock_timestamp()` so latest-update ordering follows the actual insert order. |
| The legacy Subtasks notification entry and project workflow analytics refreshed through different paths. | Subscribe both to the same work invalidation source. Reject older analytics responses when a newer read has started. |

## Screen and caller audit

| Entry/view | Source checked | Evidence |
| --- | --- | --- |
| Project Main table and expanded subtasks | Shared task cache; shared subtask subscription; nested tree | Desktop browser checks for Head, Accounting and Member |
| Office task List/Board, project Board/Gantt/Calendar/Dashboard | Existing task hooks use the same task cache; project workflow facts now also receive work invalidation | Source/caller audit; common cache regression tests |
| My Work Assigned work / Leading / Subtasks / History | Shared work feed, office/personal row builders and destination selectors | Role refresh unit checks; desktop Leading/Subtasks/History scenarios |
| Open task/subtask Work page | Shared task source and root-scoped tree invalidation; queued refresh after pending work | Draft recovery and refresh tests |
| Legacy Subtasks notification entry | `SubtasksWorkspace`, checked reads and shared work invalidation | Notification focus/access/draft regression tests |

Source review is not a claim that every Board, Gantt and Calendar interaction received a separate live browser walkthrough. The browser scenarios use authorized API/Realtime fixtures; the installed SQL checks separately exercise the real database role rules.

## Live deployment and existing-data repair

Migration: `20261102192953_work_status_lifecycle_sync.sql`.

SHA-256: `d92f995fbc0a45cccae7b1c1c931ad22bd5346410df2d8ece9c386a1e7ddf1ca`.

An isolated migration workspace was populated from the 73 existing live migrations. Only this delta was applied, with a verified backup and dry run. Function deployment changed none of the 117 checked data tables. No schemas, RLS policies, grants or API signatures were changed. See [deployment receipt](DEPLOYMENT_RECEIPT.json) and [preflight](DEPLOYMENT_PREFLIGHT.json).

Verified backup: `C:/Users/gabri/AppData/Local/eFlow/deployment-backups/20261102T192941Z-phaseoffice-budget-main`.

Two existing tasks had completed subtasks but a stale parent status:

- Customer Service Seminar Venue Cleanup — `21d99fdf-aed8-48c4-b956-284d196f1bdd`.
- Customer Service Seminar Venue Reservation — `e594c65c-f539-408c-9c65-1299a2b7eb3c`.

After a rollback-only preview, their statuses were repaired from `todo` to `in_progress` through the checked rollup. Only `status` and `updated_at` changed on those tasks. Completed subtasks, submissions, approvals, budgets, cash, accounts and credentials were preserved. All 114 other checked tables were unchanged. Status history and audit entries identify System, without impersonating a user. See [repair receipt](REPAIR_RECEIPT.json).

Head Cheryl, Task Lead/Accounting Gabriel and Member Crisostomo each read back both corrected tasks with completed-subtask counts intact under their real database identities. See [role readback](LIVE_READBACK.json).

## Validation

- Candidate and installed database checks: **17 passed**, inside rollback-only transactions. Checks include text-only starts, subtask starts/completion, all three role reads, blocker visibility, returned-work permissions, pending-review preservation, one-time audit history and deferred financial/lifecycle guards. The two existing stale-task repair previews are included in these 17 checks. See [installed checks](INSTALLED_CHECKS.json).
- Desktop Chromium at 1440 × 1000: all three role scenarios passed. Simulated server Realtime changes update the main table and expanded subtask, then Leading, Subtasks and History, without Refresh. Includes In progress → Stuck → In progress → Completed, pending approval visibility and approved History placement.
- Focused unit checks: **82 passed across 11 files**, verified in separate batches/file reruns. This includes 28 checks in the final seven-file batch; 13 notification entry checks, 28 draft-recovery checks and the task-focus check in the preceding run; and 12 retained-service checks in their standalone rerun. They cover shared channel cleanup/coalescing, changes during pending reads, authorized cache reads, current tree status, pending-review visibility, quiet feed refresh, retained drafts and account reset. One overloaded earlier draft-recovery run timed out; that exact file subsequently passed all 28 checks without increasing its timeout.
- TypeScript and production build passed. Build retains the existing mixed static/dynamic import and large-chunk warnings.
- Graphify update completed; the existing four partial parser warnings remain. Generated graph data stays local.
- Security advisory categories/counts remain unchanged: [advisory receipt](SECURITY_ADVISORS.json). Existing notices are outside this status fix; no security policy was relaxed.

The initial full `npm test` run completed with **2,240 passing and 22 failing tests**, across 382 test files (367 passing files, 15 failing). This was not a green repository-wide release gate. It included old UI expectations (for example, a `75%` progress label, old menu names/column order and an old funding form label), timing failures during the parallel run, and four status-change compatibility failures: one test still prohibited a Realtime subscription, and three retained service tests exercised browser refresh without `window`. The status-related compatibility failures were corrected and included in the focused rerun. The remaining broader failures were not silently removed or treated as proof of passing functionality.

Hosted Realtime publication was checked directly: `tasks`, `subtasks` and `subtask_progress_updates` are published. The shared channel subscribes only to these tables. Personal-project work receives committed local updates and automatic focus/15-second refresh; its tables were not added to the publication as part of this fix.

## Desktop screenshots

These are fixture-based browser evidence, not screenshots of changed live financial records:

- [Head — Leading awaiting approval](leading-awaiting-approval-head.png).
- [Accounting — Leading awaiting approval](leading-awaiting-approval-accounting_staff.png).
- [Member — Leading awaiting approval](leading-awaiting-approval-member.png).

## Behavior retained

Starting work does not approve or complete its parent. Parent task review remains with the configured Project Lead and independent Head fallback. Completing every subtask still requires the Task Lead's explicit parent submission. Dependency, project activation, evidence and financial guards continue to apply. Percentage input is not required to start work or refresh status.
