# Task dates and deletion — 2026-10-17

Hosted target: `ixnfphgjyelhckjwjkdv`.

## Dates

The project table date popover and Gantt/Calendar date dialog now disable past calendar days, allow today, reject a due date before the start date, and reject elapsed due times. A task's existing historical start date can remain when its deadline changes. The optional time field accepts hours and minutes; clearing it saves 11:59 PM. Existing explicit timezone suffixes are preserved. Clearing a due date also clears its time. Editing a rejected draft clears stale errors. On phones the timeline editor stays within the viewport and scrolls when necessary.

`20261016202126_validate_task_due_dates.sql` adds matching validation to the existing `phase3_patch_task` RPC without changing its parameters, return value, access checks, field allowlist, or invoker privileges. The database uses Philippine calendar days, normalizes date-only deadlines to `23:59:00+08:00`, and stores the same value in `deadline` and `due_date`. Gantt/Calendar drag changes also pass the shared date validation before their existing schedule confirmation.

## Deletion

The project task row menu was missing the existing task deletion workflow. It now provides **Delete task** to the authorized Head, confirms the selected title, rechecks access and task freshness, and calls the existing audited `soft_delete_task` command. It does not delete the project. Cancellation performs no write; repeated or uncertain writes remain protected by the shared reviewed-mutation flow.

The supplied group screenshot contains the task “Check 1”, so its group is not empty yet. Its disabled action now explains that tasks must be moved or deleted first. A genuinely empty group could also be blocked by hidden soft-deleted task records and the retained group foreign key. The new authenticated `delete_empty_project_group` command checks the existing project-management and scoped-work permissions, locks the project and group, protects the default group and closed projects, and rejects all remaining undeleted tasks, including archived ones. It moves only deleted task records to the same project's default group before removing the empty group. Task history and project links remain intact.

Deployed migrations:

- `20261016202238_delete_empty_project_groups.sql`
- `20261016202406_allow_deleted_task_group_cleanup.sql`

The latter preserves the existing private work guard and adds a narrow allowance for authorized default-group movement of deleted records. Every other field except the normal update timestamp must remain identical. Anonymous users cannot execute the new RPC; members cannot pass its Head checks. Existing function ACLs, security attributes and all 32 pre-existing migration versions/names remain unchanged. Deployment used an isolated workspace populated from live migration statements, and repository filenames match the actual deployed timestamps.

## Verification

- Actual authenticated Head RPC checks rejected past dates, saved today's deadline at 11:59 PM, and preserved an explicit due time. Verification changes were rolled back and the task record compared equal afterward.
- Actual Head checks deleted both a staffed and unassigned task, blocked nonempty group deletion, removed the empty group after deletion, and retained the deleted task record in the default group. All test mutations were rolled back; original task and group rows were compared afterward.
- Anonymous/member group cleanup was denied and default group deletion was blocked.
- Date, planning-editor and deletion-hook regression coverage checks typed-value bypasses, optional time, calendar bounds, historical starts, cancellation, repeated deletion, and permission changes during confirmation.
- The date browser test passed on desktop and 390px phone, including default time, explicit time and persistence after reload. Three deletion browser checks passed for Head task/group deletion, cancellation, member visibility, and group denial/retry.
- Type checking and the production build passed. Security advisors were checked after deployment. Relevant unit tests passed: five date tests, thirteen planning-editor tests, and three deletion-hook tests.

Original function definitions, isolated live-history migrations and verification material remain ignored under `.codex-tmp/date-delete-fix/`. No actual user task or group was removed during verification.
