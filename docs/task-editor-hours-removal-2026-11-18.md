# Task editor refinement and estimated-hours retirement

Implemented locally for Web on 2026-11-18. The destructive SQL migration is **prepared, not applied**. No Web or gateway deployment was performed for this change. Mobile was inspected as the workflow reference and was not modified.

Web removes estimated hours/days from task forms, task and subtask inspection, table columns and summaries, import review, collaboration revision editing, analytics, staffing recommendations, and task mutation payloads. Existing saved table preferences discard the retired column. Reviewed imports use an explicit task-field allowlist, including when reading an older saved draft.

Workload displays now use active-task and overdue-deadline facts without calculating remaining duration or requesting missing estimates. New monthly contribution calculations use approved tasks and priority for delivery and award no duration-based speed points. Actual recorded cycle and review times remain available. Closed historical snapshots are retained.

Task and subtask editors explain that start dates and prerequisites cannot change once work has started. Server-confirmed field permissions still control editing. The due-date reason is immediately below the date, appears only for an actual date change, and disappears when the date is restored. Started root tasks require the existing supervising authority and reason. Office subtasks retain the installed server requirement for a reason on any due-date correction. A start-only pre-start subtask edit no longer needs a due-date reason once the pending migration is installed. Timestamp-form root deadlines are compared using the editor's Philippine calendar date so a title-only correction does not falsely require a schedule reason.

The Cancel task action, callbacks, confirmation flow and unused cancellation service/export were removed from Web. Deletion remains restricted to untouched work under the existing backend checks; it does not replace cancellation for started work. Historical cancelled statuses remain readable. Financial allocation cancellation is a separate workflow and is retained.

## Activity records

Existing authoritative activity paths remain in use. Root-task saves go through `phase3_patch_task` or `edit_selected_project_task`; `eflow_work_edit.record_task_details` records committed field deltas and the due-date reason. Subtasks go through checked work commands, which store before/after snapshots in `work_tree_events`; the live `eflow_r7.snapshot` includes priority, start date, prerequisites and `due_date_change_reason`. The Web activity presenters already consume these recorded values. No activity is fabricated before a successful database write, and old audit entries are not rewritten.

## Pending SQL

File: `supabase/migrations/20261118142306_remove_task_estimated_hours.sql`.

The file was generated with the Supabase CLI in the isolated workspace containing the current hosted migration history. It is based on read-only inspection of `ixnfphgjyelhckjwjkdv`. The only live schema column for estimated hours was `public.tasks.estimated_hours`; no subtask hours column was present. Catalog dependencies showed its default and no dependent view.

The migration verifies fingerprints of all 12 affected hosted functions before changing anything, removes hours references from 11 functions, narrows the subtask due-date-reason handling in the twelfth, preserves function owners, ACLs, security modes and settings, and drops the column with `RESTRICT`. Any function drift, missing replacement anchor, unexpected dependency or privilege change aborts the transaction. It does not alter RLS or apply grants. Historical migrations, signed receipts, audit records and closed monthly snapshots remain intact.

This permanently deletes the task hours column and its stored values. Back up the database before deployment. Coordinate the compatible Web, Python gateway and Mobile releases; current Mobile builds still reference the column, and the old hosted import function requires an hours value. Finish or explicitly re-review pending imports before switching their contract. Do not apply this migration while incompatible clients or gateway versions are still active. For deployment, fetch the latest hosted migration history into an isolated workspace and add only this reviewed pending file; never push the repository's historical migration folder or repair hosted history to match it.

## Verification

- `npm run check` and `npm run build` passed. Existing circular-chunk and bundle-size warnings remain.
- Affected unit suites passed after updating retired-field expectations and stale UI selectors; the additional detail-service regression passed all 6 cases. No full test-suite run was performed.
- Disposable PGlite tests applied the migration to the captured hosted function definitions, verified column/data handling and unchanged permissions, exercised collaboration materiality and the migrated task-activity trigger, and verified rollback on function drift. This is not a full hosted-schema acceptance run.
- Python deadline-workload tests passed (2 cases); modified Python modules compiled successfully.
- Chromium smoke checks passed for creation/blocker behavior plus task and subtask edit notices, disabled planning fields, conditional reason visibility, and reason placement at a 390px viewport. All backend requests were intercepted; no real work records were changed.
- Graphify refreshed successfully; its extractor reported partial parsing for five existing TypeScript files. The resulting graph was retained without forcing a smaller extraction. Actual source, type checking and build were used for correctness.
