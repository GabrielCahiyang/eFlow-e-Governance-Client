# Account lockout — 8 October 2026

Implemented the requested eFlow-level account lockout without paid Supabase Auth hooks.

## User behavior

- Wrong passwords are counted on the server per existing account, not per browser. Default limit: three consecutive failures.
- Successful password verification resets the count before lockout. Network/provider failures do not count as incorrect passwords.
- Reloading, using another device, or entering the correct password does not clear a lock.
- Admin Center → User Management → Locked out accounts lists only locked identities, with their name/email, role, failure count, and lock time.
- Only an active Admin can change the limit (1–20) or confirm an unlock. Changing the limit does not unlock existing accounts.
- Unlock resets the count and removes that identity from the locked list. Cancelling confirmation performs no write.
- Password reauthentication for settings, invitations, and backup export also uses the protected login service.

## Security boundaries

The backend checks actual Supabase password responses; it never trusts a browser-reported failure. Private, RLS-protected tables hold counters/settings and audit events. Gateway-only RPCs use short account leases to prevent concurrent requests skipping the threshold; no transaction is held across the Auth HTTP call.

The durable eFlow lock is the authority. Once locked, the gateway synchronizes a native Supabase password-login ban. Ban synchronization failure leaves the eFlow lock intact and is retried on a later locked login. Unlock only clears a confirmed feature-owned ban; a separate or unconfirmed restriction requires project-owner review, rather than falsely reporting success or clearing unrelated restrictions.

This is **not** provider-wide failed-password detection. An attacker calling Supabase's public password endpoint directly before the lock can bypass the eFlow failure counter. Native provider rate limits remain relevant. Existing access tokens are not revoked by this feature; this controls password sign-in/reauthentication, not forced logout of every active session. Recovery/reset flows do not clear the durable lock.

Admins are not exempt from lockout. If the sole active Admin is locked, the Supabase project owner needs an out-of-band recovery procedure; the app does not give ordinary users an emergency unlock privilege. Account-based lockout can also be abused to deny another user access, so it is not a replacement for traffic/IP rate limiting.

The new public discovery RPC returns only the published gateway address. It does not expose other admin-only system settings, passwords, counters, or account details.

## Deployment

Target: `ixnfphgjyelhckjwjkdv` only. No billing upgrade or Auth hooks enabled.

- `20261007191654_account_login_lockout.sql`
- `20261007195837_login_gateway_discovery.sql`

Both were applied through an isolated workspace populated with exact live migration history. Dry runs selected only the respective reviewed migration; no roles, seeds, history repairs, or unrelated pending migrations were pushed. Before/after fingerprints confirmed existing public table data unchanged for both installations.

Verified database archive and role definitions are protected outside the repository at `C:/Users/gabri/AppData/Local/eFlow/deployment-backups/20261007T194510Z-phaseaccount-lockout-main`. Deployment receipts are stored there. Failed partial backup attempts were not used for deployment.

## Acceptance evidence

- TypeScript check and production build passed; existing chunk-size warnings remain. Client-secret verification and diff whitespace checks passed.
- Full frontend regression run: 222 files / 876 tests passed. After the public-discovery addition, the focused 12-test login/form run passed again, including its new endpoint-discovery test.
- Disposable PostgreSQL verification: 32 assertions, including exact/dynamic thresholds, concurrency, grants, reset, and Admin-only unlock.
- Python suite: 69 tests passed, including provider/network failures, authorization, validation redaction, ban ownership, and nanosecond-to-microsecond timestamp handling.
- Dedicated frontend unit checks: 12 tests passed.
- Chromium: Admin settings/save/cancel/unlock/reload test and Head access-denial test passed. Project Offices single-table refresh regression passed separately.
- Live disposable account: 401 → 401 → 423, three recorded failures, correct password blocked, native password login banned, Admin unlock, successful gateway login, actual member JWT denied Admin management, unlocked account removed from list.
- All disposable live identities were removed. Final hosted state: limit three, zero locked accounts, zero remaining QA identities. No real account was deliberately given a wrong password.
- Signed-out anonymous gateway discovery returned 200 with a configured address, while direct anonymous access to admin settings returned no address.

## Guidance used

The Supabase skill and Supabase Postgres best-practices skill guided the least-privilege private RPCs and short-transaction lease design. No password-verification hooks were installed.

## Operational dependency

Password login now requires the eFlow control gateway. Local development uses the existing frontend proxy to port 8322; other laptops discover the published gateway URL through the read-only RPC. Deploy the updated gateway and frontend together when publishing the application. There is deliberately no unprotected direct-password fallback when the gateway is offline.
