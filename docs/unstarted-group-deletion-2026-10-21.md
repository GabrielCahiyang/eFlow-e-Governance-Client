# Delete groups containing unstarted work

Hosted target: `ixnfphgjyelhckjwjkdv`.
Deployed migration: `20261020203627_delete_unstarted_project_groups`.

## Behavior

The group menu now offers **Delete group** for empty groups and groups containing only Not started or Pending assignment tasks, including unstarted nested subitems. Assigning people, dates, estimated hours or estimated budgets does not block deletion. The confirmation counts every task and subitem in the group, including tasks hidden by table filters, and explicitly states that the work will be removed.

Tasks use the existing audited soft-delete operation. Subitems and prior history stay stored with their removed parent tasks; deleted task group links are safely rehomed or cleared using the existing empty-group cleanup. A group deletion audit receipt records the removed task IDs. The task list refreshes after the transaction, so project totals and other views update.

The database rechecks the whole group under the existing project/root/descendant locks. Started, submitted, reviewed, archived or funded work still requires moving the relevant tasks out first. If any check fails, nothing in the group is removed. Member and anonymous roles do not gain deletion authority.

The original `delete_empty_project_group` RPC retains its strict empty-only contract for automatic PDF cleanup and existing callers. The new explicit `delete_project_group` RPC checks the active scoped Head, project management authority and every task's existing deletion authority. Its authenticated SECURITY DEFINER advisor warning is intentional and reviewed; anonymous/PUBLIC execution is revoked.

## Acceptance

- Reproduced the screenshot's actual **Check Dynamic** group under the authenticated Head role: two assigned unstarted tasks plus one unstarted subitem were removed successfully, with task facts and subitem history preserved. All changes rolled back; the user's group was left intact.
- `scripts/verify-unstarted-group-deletion.sql` passed on hosted Postgres using rollback-only fixtures: assigned and pending tasks, nested descendants, estimated budget/hour fields, populated default/last group, empty group, audit receipts and history retention. Active task, active grandchild and archived task cases block atomically. Members are denied; automatic import cleanup still rejects populated groups.
- 19 focused editor/task-deletion unit tests passed.
- Four Chromium desktop checks passed: individual task then empty group deletion; Member menu; group creation and empty deletion retry; whole populated group confirmation, cancellation, concurrent server refusal and successful retry.
- Type check passed. Production build passed with existing chunk/import warnings.
