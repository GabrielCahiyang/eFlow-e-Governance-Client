# Phase 2 rollback

The application has been reverted to Phase 1. Admin identity, full administrative access, protected permissions, account lifecycle checks, and last-active-Admin protection remain. Employee Status and Item maintenance, custom-Item routing, catalogue metadata, and direct final-Item user creation were removed. User creation uses the earlier role and leadership workflow again.

## Apply the database reversal

Open `supabase/migrations/20261003000003_revert_phase_2.sql`, copy the entire file, and run it in **Supabase > SQL Editor > New query**, using the **postgres** role. The file executes in a single transaction.

The agent performed only read-only inventory against the connected database. It found 11 Items, 4 Employee Statuses, and these profile counts: Admin 1, Head 7, Assistant Head 3, Employee 6, Accounting Staff 1. No profiles used custom Items. The reversal SQL has **not been applied to that database by the agent**.

The SQL:

- Retains all user/Auth accounts, completed leadership appointments, built-in permissions, individual overrides, audit events, and Phase 1 archives.
- Restores the function definitions saved before Phase 2, including Phase 1's Admin conversion for `has_permission`.
- Restores the Phase 1 role constraint and immediate leadership integrity trigger.
- Removes Phase 2's catalogue tables, assignment function, added capability guards, restrictive policies, and foreign keys.
- Saves catalogue rows and unused custom permission defaults in `public.phase2_rollback_archive`, readable only by Admin in the application roles. The original definition backup is retained.
- Stops without committing if a user has since been assigned a custom Item, an original permission-function backup is missing, or an unexpected dependency prevents removal. It does not choose replacement roles or use `CASCADE`.

The original forward migrations are retained as deployment history. The former combined manual deployment file was retired so it cannot accidentally re-enable Phase 2. If you use Supabase CLI migration tracking, keep this reversal after the two original Phase 2 migrations; manual SQL Editor execution does not register migration history automatically.

## Review the restored app

Open http://127.0.0.1:5174, sign in as Admin, and refresh any existing tab after applying the rollback.

- **User Management > All Users**: fixed role selectors; Admin may manage higher-level accounts; own-account and last-active-Admin protection remain.
- **User Management > Role Defaults**: fixed built-in role columns and locked Admin permissions.
- **User Management > User Access**: individual permissions for non-Admin accounts.

Items, Employee Status, and Item Permissions are no longer navigation destinations. Expense-account, organisation hierarchy, annual-budget, and project cost phases remain untouched.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 151 files, 523 tests passed |
| `npm run build` | Passed; existing circular-chunk and bundle-size warnings remain |
| Gateway unit tests | 17 tests passed |
| Phase 1 SQL rehearsal | 36 assertions passed |
| Phase 2 rollback rehearsal | 28 assertions passed |
| Admin browser and phone smoke tests | All 4 passed |

The isolated rollback rehearsal (`node scripts/verify-phase2-rollback-sql.mjs`) passed 28 assertions. It compares restored function definitions with their exact Phase 1 definitions, checks retained accounts and archived data, confirms catalogue APIs and guards are removed, rejects users with custom Items, exercises Admin-only archive access and last-active-Admin protection, and runs the rollback twice.

This rehearsal uses the disposable PGlite runtime from Phase 1 and never reads credentials or connects to Supabase. It is not a full clone of the deployed database or a simultaneous-client test.
