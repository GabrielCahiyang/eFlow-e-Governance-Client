# Phase 2 invitation, onboarding, and professional-profile delivery

The revised `eFlow_Phase_2_Implementation_Plan (1).md` is implemented locally. The three additive migrations were first rehearsed in the isolated project. On **2026-10-04**, following the user's instruction to use the main database, Phase 1 and all three Phase 2 migrations were applied to **Eflow** (`ixnfphgjyelhckjwjkdv`) through tracked CLI migrations after a verified full database/roles/storage backup and authority preflight. Profile, Office, project, task and subtask counts were preserved. Hosted frontend/gateway deployment, a verified sender domain, Auth SMTP configuration, and canonical public URLs remain outstanding.

## Interface

The supplied Monday references guide the spacious split invitation dialog, paired email/role fields, additional invite rows, centered invitation email, and split account-creation page. These use eFlow branding, Figtree, teal actions, a native decorative workspace illustration, and mobile layouts. They preserve existing navigation and workflows.

- Head → Office Team → Office Team opens active members and pending invitations. The original Team Supervision page remains available.
- The invite dialog accepts up to five people, Member or Accounting Staff roles, and an optional PDF PDS per invite. Office authority comes from the verified Head profile and appointment.
- Invitees see a fixed email, Office, and role; new identities create their own password. Existing identities sign in. An existing Auth identity without an eFlow profile supplies its full name without receiving a second login.
- First-run welcome, interests, checklist, and guided-tour progress persist on the server. Interests do not grant access. Dismissal remains separate from completion; Help reopens Getting Started and existing walkthrough controls remain available.
- Owners review, edit, and confirm professional data. Heads see confirmed summaries for their own Office. Raw PDS access is restricted to the owner or the current authorized Head who uploaded that document.

Screenshots: [invite desktop](phase2/screenshots/invite-desktop.jpg), [invite mobile](phase2/screenshots/invite-mobile.jpg), [account creation](phase2/screenshots/accept-desktop.jpg). The [invitation email preview](phase2/invitation-email-preview.html) contains a demonstration link that cannot accept an invitation.

## Gateway and data

Business invitations use Resend through FastAPI. Supabase Auth invitation emails are not used for Office membership. Tokens are random, SHA-256 hashed at rest, expiring, single-use, and rotated on resend or copy-link. Mutating business RPCs are service-only; the authenticated caller is resolved before invoking them. Acceptance locks the invitation and identity, updates profile/membership, associates PDS, initializes onboarding, and records notifications/audit in one database transaction. Auth creation has compensation and protects an already committed acceptance after a lost response.

Rate limits cover Head/Office creations, persistent email attempts across workers, resend cooldown/count, and public acceptance attempts. Pending records survive delivery failure and expose retry feedback. Trial `resend.dev` sending is limited to the locally configured rehearsal recipient.

Private PDF uploads are capped at 10 MB and 50 pages. A durable queue uses atomic claims and retries interrupted processing. Local text extraction retains only education, training, certifications, skills, experience, specializations, and a concise summary; raw PDS never goes to an AI service. Scanned or unsupported PDFs fail with retry/manual-entry guidance and do not block acceptance. A confirmed profile is not silently replaced by a later upload: its owner explicitly reviews the new draft. Downloads use a 60-second signed URL.

Gateway routes use the existing `/controlpanelEflow/api` prefix: invitations, Office Team, PDS upload/processing/download, professional-profile review/confirmation, and onboarding. Browser clients do not receive provider credentials, token hashes, acceptance claims, or private storage paths.

## Verification on 2026-10-04

| Check | Result |
| --- | --- |
| TypeScript check | Passed |
| Full application unit suite | 156 files, 557 tests passed |
| Affected onboarding/tour checks after final logic changes | Passed |
| Gateway suite | 33 tests passed |
| Phase 1 SQL regression | 37 assertions passed |
| Hosted isolated Phase 2 SQL/RLS checks | 28 assertions passed; fixtures rolled back |
| Hosted gateway/Auth/Storage rehearsal | 11 workflows passed, including new/existing identity acceptance, private PDS processing, review, confirmation, and signed download; synthetic accounts/files cleaned up |
| Browser checks | Head invite dialog, skipped onboarding/Help, desktop and 390px account screen passed; mobile invite visually inspected |
| Resend delivery check | Provider accepted one authorized setup email; no Office invitation/account created by it |
| Production build and client-secret scan | Passed; existing chunk/circular-import warnings remain |

The security advisor flags the authenticated `phase2_is_office_head` predicate because it uses security-definer execution. This is intentional: it returns a boolean and is used by the scoped read policies; it cannot mutate membership or create invitations. All Phase 2 mutation RPCs deny anonymous/authenticated execution. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Other advisor findings concern existing restored functions/extensions and are outside this additive change.

The local Graphify map was refreshed. Its existing parser limitations for five feature barrel files and unsupported SCSS remain; source and migrations stay authoritative.

Run the scoped hosted SQL rehearsal with the gateway Python environment:

```powershell
server/.venv/Scripts/python.exe tests/sql/phase2-authority.py --project-ref YOUR_ISOLATED_PROJECT_REF
```

It requires `EFLOW_REHEARSAL_DATABASE_URL`, matches the explicit project reference, rejects the live connection, and rolls back its fixtures. Put temporary rehearsal scripts and evidence under ignored `.phase2-work/`, outside Playwright's automatically cleaned output directory.

## Release configuration and remaining closure

1. Phase 1 and Phase 2 database migrations are already applied to main; do not apply them again. Deploy the matching frontend/gateway release and complete the remaining configuration below.
2. Configure server-only `RESEND_API_KEY`, a verified-domain `EFLOW_EMAIL_FROM`, optional reply address, canonical HTTPS `EFLOW_APP_URL`, token TTL, Supabase secret/service key, and allowed frontend origins. Use `.env.example`; keep credentials ignored. The present local sender is for one-recipient rehearsal only.
3. Configure Supabase Auth custom SMTP with Resend for password reset/confirmation. It has **not** been configured through the available connector, which has no Auth-configuration operation. Use the project's Auth SMTP settings with `smtp.resend.com`, Resend credentials, and the verified sender; confirm settings against [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp) and [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
4. Allow-list the production Auth callback/reset URLs. Set the public `VITE_EFLOW_GATEWAY_URL` so an unauthenticated invitee can reach acceptance, with CORS allowing the actual frontend.
5. Deploy matching gateway/frontend versions, keep the PDS worker enabled, then manually verify a real invitation, password-reset email, acceptance, and role-specific workspace in the deployed environment.

Optional Resend delivery webhooks, OCR, cross-office invitation products, and project/Gantt redesign are not enabled in this phase. Provider acceptance is recorded as `sent`; confirmed delivery/bounce status requires the optional verified webhook integration. Live deployment and verified-domain/Auth SMTP checks remain outstanding; implementation/rehearsal success does not imply production closure.
