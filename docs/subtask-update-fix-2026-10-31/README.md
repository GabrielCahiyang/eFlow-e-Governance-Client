# Subtask work update and Assigned work refresh — October 31, 2026

## Cause and fix

The work-update uploader used `subtasks/{id}/updates/{file}`. The deployed evidence path parser only accepts `progress` or a submission UUID in that position. The restrictive Storage policy therefore rejected the attachment before `save_subtask_work_update` ran. The client now uses the supported `progress` path. No Storage policy or execution permission was weakened.

Assigned work listens for `eflow:work-updated`, but confirmed canonical work-tree commands did not emit that event. They now emit it after a verified mutation receipt, including child staffing changes. Failed or unverified saves do not announce a change. The existing feed reloads from its authorized source rather than applying an optimistic assignment locally.

Subtask update/completion forms no longer classify a confirmed write as failed just because the subsequent inspector refresh rejects. The refresh owner retains its read error; the work form clears its committed draft and emits the existing feed-update signal. Genuine write failures continue to retain the draft. Error-panel specificity now keeps the red error presentation inside work pages.

## Verification

- Live permission reproduction under Crisostomo's authenticated role: the old path is denied; `progress` is allowed.
- Seven rollback-only database assertions passed: authenticated storage metadata insert, work update, attachment linkage, the canonical Assigned work tree's new status, and unchanged independent completion restrictions. No test writes were retained.
- 43 focused tests passed across attachment routing, failed-upload behavior, successful-save/failed-refresh behavior, Assigned work refresh, verified command events, direct completion and checked work commands.
- The database check inserts synthetic Storage metadata in a rolled-back transaction. It does not claim an actual browser file upload test. Browser verification remains with the user.
- No migration was required.
- TypeScript, production build and whitespace checks passed. Existing large-chunk build warnings remain.
