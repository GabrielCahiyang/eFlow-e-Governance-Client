# Project draft publication — 8 October 2026

Target: `ixnfphgjyelhckjwjkdv` only. Database guards are installed on this hosted target. Frontend changes are in this workspace and served by the existing local application; no new public frontend deployment was performed.

## Behaviour

New manual projects are always created as unpublished drafts, including clients that submit `active` or a publication marker. Drafts are excluded from Open Projects. Existing records, including historically planning projects, remain published without fabricated publication dates or actors.

Drafts appears directly below Create project without a Planning disclosure or Waiting for approval sidebar item. Existing proposal partner-approval workflows remain inside their draft workspace. The governed proposal commit pathway retains its existing approval/commit checks and now requires the owning Office Head to create its published delivery projects; it is not replaced with the manual-project checklist.

Manual publication requires the owning Office Head, a name and purpose, an active project lead in the Lead Office, valid project dates, at least one uncancelled task, task names/responsible Offices/eligible owners, valid entered task dates, accepted Office invitations, resolved Office identities and current Head reviews of structure, dates and budget. Zero budget is allowed. The readiness panel lists blockers and provides resolution links. Direct status changes and direct publication-marker updates cannot bypass checks. Publication records the time, actor UUID and an idempotent audit event; actor provenance survives later profile removal, subject to existing account-deletion rules.

Draft navigation clears stale project URL context. A just-created project ID is protected from the old list's synchronous URL listener until the new React snapshot is committed. Drafts do not fetch unrelated completion checks.

## Deployment and verification

CLI-generated migrations `20261007201249_project_draft_publication.sql` and `20261007203525_project_publication_history_retention.sql` were installed separately from an isolated workspace populated with exact hosted migration history. Each reviewed dry run selected exactly one migration and no seeds or roles. No historical timestamps were repaired or repository-wide migration push performed.

A verified database/roles backup preceded deployment: protected backup `20261007T202134Z-phaseoffice-budget-main` under the local eFlow deployment-backups directory. Protected receipts record both deployments. Existing public-table contents matched before/after hashes (the first comparison excluded only the three additive publication fields; the retention migration compared all fields). Historical projects and anonymous/authenticated function privileges were checked after each deployment.

Verification completed:

- TypeScript check and production build.
- Full unit suite: 223 files, 885 tests passed; focused publication suite: 8 passed.
- Disposable PostgreSQL fixture: 20 assertions passed, including actor-history retention, direct bypass rejection, invalid task fields, non-Head/wrong-Office denial and idempotent publication.
- Chromium smoke: create → Drafts → reopen → blocked publication → reload; historical project remains in Open Projects, removed navigation stays absent, and no false Project unavailable warning after creation.
- Hosted transaction under the actual appointed Head and `authenticated` database role: incomplete publication and direct activation rejected; real task creation/assignment and three readiness reviews accepted; member publication rejected; zero-budget Head publication succeeded with one audit event; retry idempotent. Every test write was rolled back and test-project absence checked afterward.
- Client-secret verification and Git whitespace check passed.
- Local Graphify update completed. Four pre-existing parser warnings remain in guided-tours/productivity/work-templates indexes and ProjectTaskRow; TypeScript/build are authoritative and pass. No smaller incomplete graph was forced.

Supabase advisors report the new `publish_project` security-definer RPC as authenticated-executable. This is intentional: it uses an empty search path, locks the project, verifies the appointed owning Head plus existing project-management permission, and rechecks readiness through the trigger. Anonymous execution is revoked. The live negative/positive authorization tests verify those boundaries. Other advisor groups concern existing objects outside this slice. See [Supabase database-function guidance](https://supabase.com/docs/guides/database/functions) for function-hardening context.

## Guidance used

The [Supabase skill](C:/Users/gabri/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md) and [Postgres best-practices skill](C:/Users/gabri/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase-postgres-best-practices/SKILL.md) informed the server-side authorization, restricted helper functions, short publication transaction and isolated migration deployment.
