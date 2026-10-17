# Admin account activation — 17 October 2026

Target: `ixnfphgjyelhckjwjkdv` only. Database migration **20261016231317_managed_account_email_activation** is deployed. The gateway and frontend implementation are local; this does not certify a publicly hosted release or external email delivery.

## User workflow

- Administration → User Management → **Create LEDIPO User** keeps CSC PDS import, review, identity, skills and staged employee notes. Admin no longer selects a password.
- **Invite eFlow User** selects an existing authorized active office. This creates an account invitation, without granting project access or creating another office. Project invitations remain separate.
- Clicking **Send activation email** stages a pending invitation. No Auth user or active profile is created at this point.
- The recipient opens `/activate-account`, reviews the fixed identity, and sets and confirms a 12–128 character password. Ordinary Member/Accounting Staff activation creates their account and office membership together.
- Head/Admin requests verify email to an **inactive Member** account. An active Admin must separately select **Approve role** in Pending activation. Head approval uses the existing canonical leadership operation and refuses to replace an occupied Head slot.
- Pending activation shows delivery status, expiry, Resend and Revoke. Resend rotates the token; an old link stops working. Accepted accounts are managed through normal account deactivation, rather than invitation revocation.
- The existing unified Admin role, last-active-Admin protection, deactivation, lockout, password reset, Head office invitations and project participation workflows remain in place.

Only LEDIPO currently qualifies in the active office picker. Project-local invited office identities are not silently converted into canonical offices.

## Email and release configuration

Uses the existing `services/email_delivery.py` Resend integration, `RESEND_API_KEY`, `EFLOW_EMAIL_FROM`, optional `EFLOW_EMAIL_REPLY_TO`, `EFLOW_APP_URL` and `EFLOW_INVITE_TOKEN_TTL_HOURS`. Managed account expiry is capped at 24 hours. Provider acceptance is labeled **Email sent**, not delivered.

At verification, the configured sender is a restricted `resend.dev` sender. It can send only to `EFLOW_EMAIL_TEST_RECIPIENT`; broader delivery requires a Resend-verified sending domain. `EFLOW_APP_URL` currently points to `http://localhost:5173`. Use the deployed HTTPS frontend origin before inviting recipients on other devices. No real invitations were sent by the implementation tests.

Deploy the reviewed database migration and gateway before enabling the new frontend. The local gateway is running at port 8322. Keep the existing frontend deep-link fallback so emailed `/activate-account` links resolve to the application.

## Security and retry contracts

- SHA-256 token hashes only; token/password/PDS contents are absent from API receipts and audit metadata. The activation page removes the bearer token from the URL and uses no-referrer requests, without storing it in local/session storage.
- Strict request models reject extra fields, Admin-provided passwords, unknown roles and oversized PDS content. Public requests cannot choose identity, role or office.
- Database operations independently check current active Admin/office authority. Browser roles cannot execute managed provisioning RPCs or read the private invitation details. The unused direct-registration callback was removed and browser INSERT on profiles was revoked.
- The request UUID is retained across a failed submit. The database binds it to the original actor and exact payload, preventing duplicate staged invitations. Public completion uses an independent stable attempt UUID.
- Per-actor staging and per-actor/office dispatch limits, a resend cooldown, bounded send count, and database-backed per-token/per-IP public request limits apply across gateway instances.
- Completion locks the email and current token, rejects identity collisions including orphan Auth identities, and atomically writes profile, membership, staged notes, onboarding, acceptance and audit.
- Auth provisioning uses only server-owned `app_metadata` to identify the exact invitation and attempt. Existing identities are never taken over or assigned a new password.
- Timeout reconciliation takes the same locks as completion before deciding whether compensation is safe. An accepted identity is retained. An uncommitted identity created by the current request can be deleted only after its claim is fenced against delayed completion. Unknown outcomes remain recoverable by the same attempt rather than being blindly deleted.
- The old Head/project invitation entry points explicitly reject managed-account tokens, while retaining their previous authorization and business logic for other types.

## Operations and recovery

Email failure leaves a staged invitation, with a visible failed delivery state. Correct the sender setup, wait for the cooldown, and use Resend. Revoke and issue a new invitation to correct an email address; an invitation cannot transfer to a different email.

For an uncertain activation, the recipient should retry from the still-open activation page, which keeps the attempt UUID. Admin should refresh the pending list before repeating an action. If cleanup failed, the private sidecar records `reconciliation_claim` and an `account.activation_cleanup_required` audit event. The Admin receipt exposes only `needs_reconciliation`, without the claim itself.

Support must verify the invitation, accepted status, profile existence and the Auth identity's **server-owned** invitation/attempt metadata before removing any uncommitted identity through the Auth Admin API. Never delete an accepted identity, overwrite an existing password, reuse an orphan identity, or clear claims blindly. Once a safely fenced uncommitted Auth identity is removed, the next valid claim clears the reconciliation marker. Revoke/reissue only after recovery is established. If an Auth-create response itself was lost, the same attempt can discover and resume the owned Auth identity without recreating it.

Migration rollback should be a reviewed forward change after disabling the new entry points. Keep accepted accounts, audit records and canonical leadership; do not drop live invitation history or replay the historical repository migration folder.

## Backup and verification evidence

Before deployment, a full custom-format archive was saved outside Git at:

`C:/Users/gabri/AppData/Local/eFlow/deployment-backups/managed-activation-20261016T230427Z/before-activation.dump`

Archive size: 2,324,549 bytes. SHA-256: `5090ee85c8f8861bc6bc56dc37422fbd925f005c39cb1bb3ead8b9e1ffcd1009`. Archive listing and full decompression passed. Restoration was not exercised for this change. Historical Phase 6.5 recovery evidence remains unchanged.

The isolated migration workspace was populated from all 35 live migration statements before preparing this migration. The deployed version is preserved in the repository filename. No existing migration version was repaired or reapplied. `fresh_schema.sql` remains the historical bootstrap base, as required by `supabase/README.md`.

Live rollback-only SQL verified staging creates no identity; exact staging retry; safe preview; Member claim and atomic profile/membership/PDS completion; idempotent completion; replay rejection; accepted timeout reconciliation; inactive least-privileged Admin activation; and deliberate Admin approval. A second live rollback probe also verified canonical Head approval with all real triggers, dispatch reservation deduplication, token rotation, revocation and resend cooldown. All fixtures rolled back. Before/after counts remained 8 Auth users and 8 profiles; complete profile and office fingerprints matched; there were zero staged invitations after testing.

Local coverage includes the disposable PostgreSQL regression, activation gateway tests, existing Phase 2/8 invitation gateway suites, authentication startup, directory deletion, and synthetic desktop/mobile browser cases. Build, type checking and client-secret verification passed. The focused run passed 7 unit tests, 48 gateway tests and 16 Chromium browser checks, including retained Phase 2 invitation behavior and Admin navigation. See [the receipt](managed-account-activation-receipt-2026-10-17.json).

The broad `npm test -- --maxWorkers=2` run reported failures in unchanged task/nested-work/review areas (including older button-text assertions and an obsolete Admin leaf count). Remaining unrelated execution was stopped after those failures; a full-suite pass or complete-suite total is not claimed. The affected activation, Auth startup and directory-delete tests passed separately.

The Supabase advisor adds three informational notices for deliberately private deny-by-default tables (sidecar, dispatches and request limits), with RLS enabled and no browser grants. Existing warnings are unchanged. [Advisor documentation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
