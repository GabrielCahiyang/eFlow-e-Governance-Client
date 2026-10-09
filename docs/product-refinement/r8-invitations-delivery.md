# R8 local delivery — project invitations

R8 adds a separate Head-approved project-member request, dispatch and acceptance path. Existing Office-member and Office-collaboration acceptance remains intact. Entry points are project Members / Invitations and the R7 Lead/contributor picker. The responsible Head also receives a notification and a scoped approval queue in the existing review Inbox. Personal owners explicitly designate an active sponsoring Office; its appointed Head approves without receiving personal workspace ownership or general project access.

Requests freeze email, project/task/subitem scope, requested skills, summary, engagement and end terms. Submission produces no token, email or membership. Approval and dispatch check current requester/Lead ancestry, the appointed approving Head, participating Office, project state, future access terms and request lifetime. Approval replay is idempotent. Dispatch rotates hashed tokens, enforces a 60-second cooldown and ten-attempt limit, and records provider acceptance separately from delivery. Approval never silently sends. Failed email retries target the selected person; already accepted provider results require an explicit resend.

Project acceptance is recipient-bound and idempotent. An existing person's role and canonical Office remain unchanged; a newly created guest is an unaffiliated Member. Acceptance grants selected project membership and leaves work unassigned. R7 staffing and existing formal evidence/review paths use a narrow guest branch. Expiry/revocation denies execution and delegation synchronously; old task assignments cannot recreate guest-only read access. Independent Office/selected membership access remains available. Temporary closeout materializes ended access; restoration cannot revive it. R9 still owns integrated assignment reconciliation, removal and renewal UI.

Optional PDS uses the existing private bucket, worker, extraction and manual recovery. Request submission, attachment, processing, email and onboarding have separate outcomes. Only the recipient and currently authorized original uploader see private documents; approval alone does not grant raw PDS access. A completed extraction attaches to acceptance without overwriting an existing professional profile. Requested skills remain invitation context. The recipient explicitly confirms project onboarding separately from membership activation.

PDS retries reuse the committed document by request/uploader/content digest. A request lock binds a late upload to its accepted recipient and denies revoked uploads; token operations use consistent request-before-token locks.

The request form preserves attempted terms and stable request IDs after response loss, excludes submitted people from retries, and retries a failed PDS attachment independently. Its dismissal affects only its own draft; submitting a portal form cannot also save the surrounding work editor. R8 controls wait for the database capability to load, so legacy installations retain functional R7 staffing with an actionable unavailable notice.

## Provider and hosted status

The redacted local configuration audit found application Resend credentials, sender and app URL present, and notification SMTP credentials present. The application sender is still a **Resend rehearsal sender**. Its existing restriction to the configured test recipient is retained with an actionable verified-domain error. Presence of credentials does not establish their validity, domain verification, mailbox delivery or correct hosted URLs.

Application invitations use Resend. Existing notifications independently use Gmail SMTP. Supabase Auth SMTP is independently managed in hosted Auth and was not changed or certified here. Provider credentials remain server-only. [Resend requires domain verification for a production sender](https://resend.com/docs/dashboard/domains/introduction); [Supabase documents separate Auth SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).

The additive migration `20261008060756_r8_approved_project_invitations.sql` is **unapplied**, alongside R3/R6/R7 dependencies. No hosted write, real email, invitation token or account was created. Sole future hosted target is `ixnfphgjyelhckjwjkdv`; preserve its actual migration timestamps and prepare an isolated live-history migration workspace before deployment. Do not push historical repository migration filenames.

Hosted acceptance remains open: configure a verified sender/domain and correct frontend/Auth URLs; use an explicitly authorized non-test mailbox; record actual receipt, recipient-correct acceptance, membership, private PDS/skills recovery, expiry/revocation and partial-failure retries. Provider IDs, mocked delivery and disposable SQL do not satisfy this gate. Hosted Auth profile bootstrap compatibility must also be verified before genuine new-guest acceptance.

## Verification

- TypeScript `npm run check` and production `npm run build`: passed. Existing large-chunk/static-dynamic import warnings remain; no scale acceptance is claimed.
- Full frontend suite: **226 files / 922 tests passed**; six R8 tests cover UTC/DST boundaries, partial request/PDS failures, stable retries, approval-only dispatch and submit-event isolation. The final shared-form layout correction also passes a 24-test focused frontend run.
- Gateway suite: **64 tests passed**, including ten R8 recipient/privacy/provider/idempotency cases. Dynamic imports are pinned to mocked clients; no provider or hosted service is needed for these tests.
- Disposable PostgreSQL: **61 R8 checks passed**. Real prerequisite schemas, R3/R6/R7 migrations and private evidence sealing are loaded. Cases include zero pre-approval tokens/access, rejected/current/stale Head, current requester/branch checks, duplicate approval, wrong email, verified identity, invitation expiry, token rotation/cooldown, existing role/Office preservation, guest staffing in shared projects, independent formal review, private PDS mapping/metadata, late-insert ownership, processed draft recovery and revoked uploads.
- R7 compatibility suite with R8 installed: **102 SQL checks passed**, retaining selected rosters, hierarchy, expiry, review and legacy/governed behavior.
- Chromium: **15 distinct cases passed** across R8, R7 and Phase 2 onboarding. The final shared-form layout correction passes all nine R8 and Phase 2 cases together. Five R8 cases cover request→approval→dispatch, project-only acceptance, unavailable links and desktop/mobile/dark layout. The older Office-invite fixture explicitly handles R3-unavailable installations. All browser records and backend calls are synthetic/intercepted.
- Graphify: refreshed locally after structural edits. The four existing parser warnings remain; no forced smaller graph or hosted introspection.
- `git diff --check`: passed with the repository’s normal Windows line-ending configuration. Task scratch files and the preview server are removed/stopped at handoff.

## Rollback boundary

Before deployment, retain the existing migration history and take the normal reviewed backup. Roll back application entry points first while retaining request/acceptance/event and private-document history. Do not drop guest records or restore old staffing predicates while active guest assignments exist; reconcile those grants through reviewed authority first. R8 introduces no global Office membership, Head/Admin/Accounting appointment or financial grant.

## Retained visual evidence

Synthetic records, with desktop/mobile acceptance and a dark mobile request form reviewed visually:

- [320 px request form](r8-invitations-evidence/r8-request-320.png)
- [390 px acceptance](r8-invitations-evidence/r8-accept-390.png)
- [1440 px acceptance](r8-invitations-evidence/r8-accept-1440.png)
- [Legacy Office invitation form](r8-invitations-evidence/invite-desktop.png)
