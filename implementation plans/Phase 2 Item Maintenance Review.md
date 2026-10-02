# Phase 2 Item maintenance review

**Historical review: Phase 2 application changes have since been reverted at the user's request. Do not use the deployment instructions below to re-enable Phase 2. See `Phase 2 Rollback Review.md` for current status and reversal SQL.**

Phase 2 adds Employee Status maintenance, Items with free-text Title and Role, configurable permissions, and account creation directly in the final Item. Work stops here for review. Phases 3-9 have not started.

## Open and navigate

Open http://127.0.0.1:5174. The gateway is running on port 8322. Sign in with the existing administrative account, or select **Usage scenarios > Admin** on the development login screen. Refresh an already-open tab. Hover over the desktop sidebar to expand navigation; use the menu on a phone.

| Navigate to | What to review |
| --- | --- |
| User Management > Employee Status | Add, search, rename, retire, activate, and delete unreferenced statuses. The initial values are Job Order, Casual, and Regular/Permanent. |
| User Management > Items | Add or edit Title and Role as free text and select Employee Status. Renaming retains the same user assignments and permissions. |
| User Management > Item Permissions | Configure page and action permissions for each Item. New custom Items start with no permissions. Admin authority remains enabled and locked. |
| User Management > All Users > Create user | Select the final Item, including Admin, Head, Assistant Head, accounting, or a custom Item. Head/Assistant Head creation also appoints the selected organisation slot. |
| User Management > All Users > Edit user | Inspect the assigned Item's Title, Role, and Employee Status, or reassign an eligible account. Account Active/Inactive remains a separate field. |
| User Management > User Access | Inspect individual grants, denials, and organisation scope for a non-Admin user. |
| Settings > Profile | Review the assigned Item's Title, Role, and Employee Status. |

Direct links after login:

- http://127.0.0.1:5174/users?page=Employee%20Status
- http://127.0.0.1:5174/users?page=Items
- http://127.0.0.1:5174/users?page=Item%20Permissions
- http://127.0.0.1:5174/users?page=All%20Users
- http://127.0.0.1:5174/users?page=User%20Access

## Database prerequisite

The connected Supabase database does not yet contain `access_items` or `employee_statuses`; the read-only check returned `PGRST205` for both. The pages currently show a migration notice. Saving catalogue records and creating users require the migrations below to be applied through the normal Supabase deployment workflow, in order:

1. `supabase/migrations/20261003000000_unify_admin_identity.sql` (Phase 1 prerequisite).
2. `supabase/migrations/20261003000001_access_items_and_employee_status.sql`.
3. `supabase/migrations/20261003000002_dynamic_item_capabilities.sql`.

These migrations have **not been applied to the connected database**. They are prepared and rehearsed in an isolated PostgreSQL engine. Target database function definitions are archived before adaptation; review them and rehearse on a clone before rollout. The new migrations preserve unrelated operational routing and financial reviewer rules.

Existing Items intentionally have no guessed Employee Status. In **Items**, edit each Item needed for new account creation and assign a reviewed status first. Existing accounts remain usable during that review; new assignments require an active Item and active Employee Status.

## Suggested review sequence after migration

1. Add a test Employee Status. Try a duplicate with different capitalisation or surrounding spaces; it must be rejected.
2. Create an Item with your own Title and Role and the test status. Confirm it starts with no page/action grants. A Title such as "Admin" or Role such as "Head" must not grant protected identity or a leadership appointment.
3. Grant **Open Reports** to that Item and create a user directly in it. Sign in as that user and confirm Reports/Performance open, while ungranted Tasks and administrative catalogues remain inaccessible. Revoke the grant and refresh; Reports must disappear or deny access. Use **User Access** to check an explicit individual denial as well.
4. Grant a relevant page and action together, for example **Open Projects** and **Create projects**, and test the action within the user's department scope. A page grant alone must not enable a separately controlled action. Cross-department access still requires an explicit scope grant.
5. Rename the Item's Title and Role. Confirm its user still belongs to that Item and its grants remain intact. Check the directory, filters, user editor, and Profile display.
6. Create a Head or Assistant Head in an eligible organisation with a vacant slot. Confirm the final Item and slot assignment. Try the occupied slot again; it must reject the conflict and compensate a newly created Auth account when the database confirms no profile was committed. An uncertain commit is preserved for Admin recovery rather than risking deletion of a completed account.
7. Try retiring an Item assigned to an active user; it must require reassignment first. Referenced catalogue entries cannot be permanently deleted. Retired status references remain visible historically, while new assignments cannot use them. An unreferenced custom Item or status can be deleted. System Items and the Admin lifecycle are protected.

Only Admin maintains Items, Employee Status, and their permission defaults. Granting user-management access to a custom Item does not grant catalogue maintenance or permission to create/reassign protected higher-level accounts. Database backup access follows its explicit capability, retaining password reauthentication and the existing per-user job restrictions.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 153 files, 534 tests passed |
| `npm run build` | Passed; existing circular-chunk and bundle-size warnings remain |
| `server/.venv/Scripts/python.exe -m unittest discover -s server/tests` | 31 tests passed |
| `node scripts/verify-access-items-sql.mjs` | 47 assertions passed; both Phase 2 migrations applied twice |
| `node scripts/verify-admin-unification-sql.mjs` | 36 Phase 1 assertions passed |
| Playwright `access-item-maintenance.spec.ts` | Both new browser tests passed with isolated Auth/REST fixtures |
| Playwright `admin-mobile-dialogs.spec.ts` | Both phone smoke tests passed |
| Latest Playwright `admin-unification.spec.ts` rerun | Inconclusive: both cases timed out waiting for the live Supabase sign-in response before product assertions. The earlier combined run passed the legacy case and reached all canonical-Admin assertions before a teardown timeout. |

The new browser fixture intercepts Supabase requests and performs no live writes. SQL rehearsal reads no credentials or live database and uses the ignored, disposable PGlite runtime installed for Phase 1. On another checkout:

```powershell
npm install --prefix tmp/phase1-sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.8
node scripts/verify-admin-unification-sql.mjs
node scripts/verify-access-items-sql.mjs
$env:EFLOW_E2E = "1"
$env:EFLOW_E2E_BASE_URL = "http://127.0.0.1:5174"
npx playwright test tests/e2e/access-item-maintenance.spec.ts
```

The isolated SQL fixture exercises real scope/leadership helper definitions and representative domain tables; it does not reproduce the entire deployed Supabase schema or simultaneous database clients. Leadership slots are locked in the implementation, but concurrent-client acceptance remains part of rollout rehearsal. Financial operation tests exercise the added capability gates; existing domain-specific financial tests retain responsibility for full cash/reviewer behaviour.

Organisation hierarchy changes, board/committee retirement, expense accounts, annual-budget corrections, and the project cost/allocation flow remain for later phases.
