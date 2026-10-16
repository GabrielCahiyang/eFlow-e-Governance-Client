# Task lead and contributors fix — 2026-10-17

Target: `ixnfphgjyelhckjwjkdv`. Entry point: project task board → task people cell → Task lead and contributors.

The first Lead appointment wrote the assigned person without moving the task out of `pending_assignment`, violating `tasks_assignment_consistent`. Separately, contributor controls used the stored task's missing Lead even after an eligible Lead was selected in the form. A confirmed database rejection also left the saved request locked and displayed a misleading saving message.

Migration `20261016195402_fix_initial_task_team_assignment.sql` updates the initial appointment and its status to `todo` atomically. It temporarily enables the existing status-write guard within the authorized command and restores its prior value. Existing appointment checks, project membership checks, permissions, receipts, other task statuses, and function ACL/configuration are preserved. All 31 existing live migration entries were copied into an isolated workspace before deployment; historical timestamps and live ledger entries were not changed.

The picker now allows contributors alongside an eligible first Lead when the fresh server capability permits that appointment. It still respects access denials and read-only states. Confirmed failed saves retain an editable draft; uncertain outcomes retain the original request for safe retry. The confirmation uses a short appointment question and shows subtask reassignment details only when existing subtask Leads would be cleared. Invitation wording is simplified and placed in a collapsible section.

Verification:

- Reproduced the original constraint failure through the actual authenticated Head checked-command workflow. After deployment, the same workflow saved Crisostomo as Lead with Gabriel on the team and set the task to `todo`. The successful verification was rolled back in a subtransaction, leaving the user's task tree unchanged.
- Focused staffing, people-field, and appointment regression tests passed, including first Lead plus contributor, preserved access denial, editable confirmed failures, and unchanged request identity for uncertain retries.
- A disposable PostgreSQL test reproduces the old constraint failure, verifies the migrated assignment, checks guard restoration and enforcement, and preserves an existing `in_progress` status.
- `npm run check` and `npm run build` passed. Two affected Playwright tests passed, covering first appointment on desktop and phone and an existing Lead transfer with subtask impact.
- Desktop and 390px phone screenshots were inspected; controls and save actions remain within the dialog.

Original function SQL, the isolated migration workspace, and layout screenshots remain ignored under `.codex-tmp/task-team-fix/`. No actual task appointment was retained from verification.
