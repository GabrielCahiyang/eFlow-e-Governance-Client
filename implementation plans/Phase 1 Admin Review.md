# Phase 1 Admin review

Phase 1 consolidates Admin and the legacy Super Admin identity. It remains implemented after the user's requested Phase 2 reversal. See `Phase 2 Rollback Review.md` for the database rollback needed to match the restored Phase 1 application.

## Open the local application

The frontend is running at http://127.0.0.1:5174 and the gateway at port 8322. Sign in with the existing administrative account, or choose **Usage scenarios → Admin** on the development login screen. Refresh an already-open application tab.

On desktop, hover over the sidebar to expand it. On a phone, open navigation before choosing a destination.

| Navigate to | Review |
| --- | --- |
| User Management → All Users | Administrative accounts are visible with the Admin role badge. Create user offers Admin, Head, Assistant Head, Accounting Staff, and Employee. Edit a leadership account to inspect management access. Own-account deletion/deactivation and last-active-Admin role/lifecycle changes are protected. Admin individual-access editing is disabled because its core authority is immutable. |
| User Management → Role Defaults | One Admin column, with all permissions enabled and locked. Other roles retain configurable defaults. |
| User Management → User Access | Inspect individual permissions and organisation scope for non-Admin accounts. Admin accounts are excluded from the override editor. |
| Org Structure | Administration still reaches the organisation tree; Admin accounts remain excluded from Head/Assistant Head candidates. |
| Data Tools → Backup & Export | Admin reaches the existing export workspace; the normal recent-sign-in requirement remains. |
| Plans & Projects | Citywide oversight remains read-only. Department Heads and Assistant Heads retain their normal operational workflows. |

Existing personal names are preserved. A legacy account whose actual Full Name is “Super Admin” retains that name; its access-role label is Admin.

## Database deployment status

The initial Phase 1 review preceded deployment. A later read-only inventory during Phase 2 reversal confirmed the connected database now has one Admin profile and no Super Admin profiles, with the Phase 1 definition archives present. Phase 1 remains applied. Phase 2 catalogue tables are also present until the user runs the separately provided Phase 2 rollback.

Current local navigation can be reviewed with that administrative account. Do not reapply the combined Phase 1 + Phase 2 script; use the dedicated Phase 2 rollback to restore the database to Phase 1.

The migration archives prior profile/override, permission, function, and policy state; logs the identity conversion; canonicalizes profiles to Admin; consolidates protected authority; and installs last-active-Admin protection. It preserves legacy helper signatures, review routing, self-edit restrictions, and project/task oversight guards. No Auth credentials or user IDs are changed.

The migration transforms the function and policy definitions present on its target database, instead of restoring older migration versions. Review those archived definitions and rehearse on a target-database clone before production rollout. The local rehearsal uses PostgreSQL in PGlite and covers sequential enforcement; it does not simulate concurrent sessions or the full deployed Supabase schema.

Item/Employee Status maintenance, direct final-Item user creation, expense accounts, project cost flow, organisation retirement, and annual budget corrections belong to later phases.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 151 files, 523 tests passed |
| `npm run build` | Passed; Rollup reported circular-chunk and bundle-size warnings |
| `server/.venv/Scripts/python.exe -m unittest discover -s server/tests` | 17 tests passed |
| `node scripts/verify-admin-unification-sql.mjs` | 36 assertions passed, including applying the migration twice |
| Playwright `admin-mobile-dialogs.spec.ts` | Both phone smoke tests passed |
| Playwright `admin-unification.spec.ts` | Both administrative profile representations passed |

The SQL rehearsal reads no environment credentials and never connects to Supabase. To install its isolated test runtime on another checkout, run:

```powershell
npm install --prefix tmp/phase1-sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.8
node scripts/verify-admin-unification-sql.mjs
```

The new `admin-unification.spec.ts` covers navigation and immutable Admin controls for both profile-role representations. Its ordinary Admin browser case adapts the legacy development account's profile response without modifying live records; actual database permissions for both categories are verified in the isolated SQL rehearsal.
