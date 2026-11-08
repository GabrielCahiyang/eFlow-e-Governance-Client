# Project guest account lifecycle

Implemented November 9, 2026 (Asia/Manila). Hosted database: `ixnfphgjyelhckjwjkdv`.

## Admin controls

Open **Admin → User Management → Project guests**. The existing account directory now has **Office accounts** and **Project guests** tabs. Permanent employee and Admin accounts stay in Office accounts; ordinary office invitations do not make someone a temporary guest.

The guest directory shows names, email addresses, sponsoring offices, active projects, account status, countdowns and deactivation dates. Search and summary filters cover active guests, guests awaiting assignment, guests approaching deactivation and deactivated accounts. Details include the lifecycle history, actor, time and recorded reason.

**Deactivate** and **Reactivate for 7 days** open confirmation dialogs requiring a reason. Open financial responsibility blocks deactivation. Reactivation enables login and starts a new seven-day window when the guest has no active project. It does not revive revoked or expired project access, promote the person to an employee, or change their role.

## Automatic behavior

| Condition | Result |
| --- | --- |
| Accepted project invitation creates a temporary guest profile | Register the account for lifecycle management. Existing permanent profiles are excluded. |
| Guest belongs to an active project | Keep access; cancel an existing cleanup countdown. On-hold projects count as assigned. |
| Guest has no active project | Start a seven-day countdown. Task assignment and last login do not determine eligibility. |
| Five days without an active project | Notify the guest and sponsoring Head in the system. Duplicate reminders are suppressed. |
| Seven days without an active project | Deactivate login and record the action. Keep the profile, messages, work, receipts and audit records. |
| Guest has open task funding/cash or separate office petty cash responsibility | Pause cleanup and notify the Head. Cleanup becomes eligible again once that responsibility is resolved; the original countdown is retained. |
| Account becomes a permanent employee or Admin | Exclude it from temporary guest cleanup. |

The hosted job `eflow-project-guest-lifecycle` runs every 15 minutes, independently of the application server and open browser tabs. Countdown initialization and enforcement can therefore occur up to 15 minutes after the relevant change or deadline. The Admin directory listens for database changes and also updates on focus and periodically while visible. No routine Refresh button is required. Signed-in clients sign out when their profile becomes inactive.

Notifications are in-app notifications, not invitation emails. Pending, unaccepted invitations remain governed by the existing invitation expiry rules.

## Deployment

Applied only `20261108193508_project_guest_account_lifecycle.sql` using an isolated workspace built from live migration history. No historical migration was renamed or repaired. See [deployment receipt](./DEPLOYMENT_RECEIPT.json) and [preflight](./PREFLIGHT.json).

Before deployment, the full database/roles backup was verified at:

`C:\Users\gabri\AppData\Local\eFlow\deployment-backups\20261108T194539Z-phase7-main`

The migration compiled against the hosted database in a transaction that was rolled back before applying it. Post-deployment checks confirmed the migration history entry, active 15-minute job and Realtime publication of both lifecycle tables. Fingerprints confirmed existing profiles, organizations, Auth users and cash/receipt records were unchanged. There were zero existing temporary guest accounts; no existing user was deactivated by deployment.

The security advisor reported no new warning/error for this feature. Its informational notice for `eflow_guests.writes` is intentional: this private internal table has RLS enabled, no client policy and no client schema access. It permits only the controlled lifecycle functions to change account status.

## Verification

- TypeScript: `npm run check` passed.
- Production bundle: `npm run build` passed; existing bundle-size warnings remain.
- Lifecycle SQL: `node scripts/verify-project-guest-lifecycle.mjs` passed 29 assertions against the actual migration in isolated PGlite. Covers reminders, expiry, project membership, funding holds, reactivation, retries, permissions and permanent-account protection.
- Focused unit suite: 15 tests passed across guest filters, Auth startup/deactivation and existing Admin directory/protection behavior.
- Chromium: three browser cases passed against the production preview, including 1440px and 390px layouts and Head-role exclusion. Covers required reasons, cancel, reactivation, history, finance holds, failed deactivation/retry and automatic focus synchronization. Browser tests used mocked accounts; they did not create hosted guests or send invitation emails.
- Deployed maintenance function: invoked successfully after installation with zero registered guests.
- Full regression attempt: `npm test` encountered failures outside this feature and was stopped after those failures were established. Examples include the missing `hasWorkCommandReceipt` mock in financial remediation tests, missing Realtime channel mocks in membership queue tests, and nested-work hierarchy interaction assertions. The full repository suite is **not** being reported as passing; those wider failures were not changed as part of this guest feature. The focused 15-test suite above passed separately.
- Graphify: refreshed successfully. Its four partial-extraction warnings concern existing guided-tour, productivity, project-task-row and work-template files; none concerns the new guest module.

The seven-day wait was tested using controlled timestamps, not a claim that a real seven-day live trial has elapsed. A real accepted guest invitation, day-five reminder delivery and physical-device session behavior remain practical acceptance checks when real guest accounts are available. This change applies to eFlow Web; the separate mobile repository was not modified.
