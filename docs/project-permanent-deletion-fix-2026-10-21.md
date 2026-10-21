# Head project deletion

Hosted target: `ixnfphgjyelhckjwjkdv`.
Deployed migration: `20261020202421_authorized_project_deletion_cleanup`.

## Confirmed failure

The Head's deletion of `sssss` failed inside `eflow_r7.guard_operation_write` while the deletion RPC cleared task links. The project contained ten visible tasks and one soft-deleted task. Soft-deleted work intentionally fails the ordinary current-work access check, so retaining that row prevented deletion of the entire project.

## Correction

The existing deletion RPC validates the active Head, project management scope, exact title and deletion reason before opening a private transaction-scoped cleanup context. Only that context permits the two task guards to clear project, milestone and group links. The predicate compares every other task field (except the existing update timestamp), so it cannot authorize changes to task content, staffing, status or evidence. Ordinary work edits retain their existing guards. The context is removed on success and rolls back on failure; browser roles have no permission to create it or call its predicate. RLS deliberately has no policies on this private context table.

The RPC also takes the existing project advisory lock before its row lock, fails closed for inactive or missing profiles and retains the deletion audit receipt. No public API signature or frontend interaction changed.

## Acceptance

- Reproduced the original exact failure using the Head's identity; all changes rolled back.
- Retried the same project after deployment, including deferred constraints: deletion succeeded; all changes rolled back. The actual project was left for the user to confirm.
- `scripts/verify-project-permanent-deletion.sql` passed against hosted Postgres under the authenticated execution role: Head deletion succeeds; active and soft-deleted tasks retain their facts; operational links clear; project groups and member containers disappear; audit history and deletion receipt remain. Invalid confirmation, short reason, Member and anonymous requests fail. Direct deleted-task detachment and client access to cleanup authority remain blocked. Fixtures roll back.
- Advisor inspection reports the expected informational no-policy finding for the private, inaccessible context table. It also flags the existing authenticated SECURITY DEFINER deletion RPC; that guarded public entry point is intentional, and its active-Head/scope checks were verified above. No new public helper or client-accessible cleanup table was introduced.
- Frontend compatibility: `npm run check` passed; 19 focused project lifecycle/workspace unit tests passed; the Chromium lifecycle-dialog smoke test passed; production build passed (existing chunk-size/import warnings).

Existing guest-membership foreign-key behavior and unrelated project lifecycle rules were not changed.
