# Phase 6.5 — Project-local Office identity correction

Status: implemented locally on 6 October 2026; shared-environment deployment and actual-user release gates remain outstanding. See the [implementation receipt](../phase65-delivery.md) and [accepted G1 identity ADR](phase65-identity-adr.md). Baseline: `a16d36e`. This is a separate functional correction, not a UI refactor. The original implementation plan follows.

## Goal and dependencies

Retain a human-confirmed Office name and proposed task responsibility, invite its contact, and coordinate its identity before a canonical `organizations` record exists. Execution must continue to use canonical `tasks.org_id`. A verified email is not a Head appointment or proof of Office ownership.

This phase can precede the UI program. If postponed, Phase 8A may proceed and later UI work must retain a distinct pending Office state. Phase 14 and Mobile A must consume the eventual identity contract rather than guess it.

## Current-state findings and evidence

| Finding | Actual source |
| --- | --- |
| `project_offices.office_id` is a non-null organization FK; `(project_id, office_id)` is unique and there is one Lead Office per project. | `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql` |
| Participation tables permit authenticated reads through RLS and authorized RPC writes; invitation creation/acceptance RPCs are service-only. | Same migration, `project_offices_read`, `project_office_members_read`, `phase6_create_invitation`, `phase6_accept_invitation` |
| Invitation POST requires a canonical Office UUID. Email/context rendering also dereferences `organizations`. | `server/routers/invitations.py`: `ProjectOfficeInvite`; `server/invitations/service.py`: `project_context`, `create_project_invitation` |
| Existing acceptance checks verified invited email, inviter authority, expiry, claim reservation and retry. A new contact gets Member identity without Office membership; an ordinary contact awaits the appointed Head. | Phase 6 acceptance RPC; `server/tests/test_phase6.py`; `tests/sql/phase6-authority.py` |
| UI Office picker lists canonical active organizations. Type and selectors assume canonical `office_id`. | `src/app/features/project-offices/types.ts`, `components/InviteOfficeDialog.tsx`, `selectors.ts`, `services/projectOfficeService.ts` |
| AI import already allows an unmatched source-backed Office name and retains it in the reviewed batch. It does not establish a project Office or transfer authoritative task responsibility: tasks are created through `phase3_create_task`. | `src/app/features/project-import/selectors/draftValidation.ts`; `supabase/migrations/20261004164937_phase5_workspace_ai_import.sql` |
| Handover requires an unstarted, unassigned task without staffed/started subitems and a joined canonical collaborator. Readiness checks task Office, eligible owner, participation, reviews and dependencies. | `phase6_responsible_office`; `supabase/migrations/20261004194130_phase7_readiness_governance.sql` |

These are source findings. The deployed schema, migration history and live policy definitions have not been inspected for this plan.

## Graphify navigation

Query used: `npm run graph:query -- "project_offices organizations office invitations claim tasks org_id proposal import"`. It identified the Office service/panel, invitations router, proposal context and task types; actual migrations were then inspected. No full graph dump or live database indexing is required. During implementation use focused questions about `phase6_responsible_office` and readiness consumers only if their callers change; update the local graph after structural edits.

## Proposed model and decision G1

Prefer an additive project-local identity layer while retaining the authoritative Phase 6 participation table. This avoids making the existing public `ProjectOffice.office_id: string` and canonical participation RPC contracts nullable across every consumer.

| Proposed concept, final naming to be fixed in the ADR | Purpose |
| --- | --- |
| `project_office_identities` | Stable project-local ID, project ID, display name, optional canonical organization/link to a Phase 6 participation row, identity-resolution status, contact context, provenance and audit timestamps. |
| Pending task responsibility reference | A nullable reference such as `proposed_office_identity_id`, separate from `tasks.org_id`; only planning intent until explicitly resolved. |
| Invitation scope for a local identity | Reuses the Phase 2 opaque-token, reservation, resend/revoke and delivery engine, with a distinct validated local-identity target. |

The alternative is to extend `project_offices` itself with nullable canonical identity and a display name, as illustrated in the brief. Compare both designs against every discovered caller before selecting one. If that alternative wins, version nullable reads/types and migrate helpers, invitation rendering, uniqueness, readiness and mobile consumers together. Do not simply drop `NOT NULL` and leave old assumptions intact.

For the recommended additive design, preserve old `project_offices`, `office_id`, service signatures and canonical invitation behavior. Add a versioned local-identity API, not a silently changed payload. Keep `user_invitations.office_id` as the inviter's canonical Office; do not relax Office-member invitation rules. Add an explicitly constrained invitation target/type for local identity, and update all token validation/acceptance dispatch, email and safe metadata consumers. Choose the exact enum/constraint changes in G1.

Constraints must enforce same-project references, one canonical Lead, no duplicate canonical participation and no cross-project relinking. Similar names are suggestions for review, not proof that two Offices are the same. Lock link/claim transitions and make retries idempotent. A linked canonical ID cannot be replaced while assigned work, reviews, financial records or dependencies remain bound to it.

## Information architecture and component changes

Manual creation and reviewed AI import feed the same project Offices surface. Show the retained name and one of: Unlinked, Contact invited, Contact accepted / awaiting authority, Linked, Joined, Observer, Revoked, or Resolution conflict. Identity resolution and invitation delivery are separate state axes.

Extend the `project-offices` feature with focused identity types, mapping selectors, service operations and a resolution dialog. Reuse `InviteOfficeDialog`, `ProjectOfficePanel`, invitation adapters and reviewed import controls. Expose only the small public feature API. Keep Office invitations inside the project. Show proposed task responsibility separately from the executing Responsible Office; do not label the creator's Office as a confirmed imported responsibility.

## Small vertical slices

1. **Contract and authority ADR.** Trace organizations, participation, tasks, imports, readiness, invitations and mobile metadata. Record affected constraints, route/RPC request and response shapes, who can resolve an identity, and allow/deny examples. Choose the additive model or coordinated nullable model. Gate: reviewed G1 and an explicit compatibility test matrix; no schema mutation yet.
2. **Persist names without authority.** Add identity storage and name/provenance operations with least-privilege grants, RLS and actor checks. Backfill linked identities from existing participation without changing task ownership or invitations. Gate: existing Phase 6/7 fixtures still pass; anonymous/unrelated users cannot create, enumerate or relink identities.
3. **Preserve proposed responsibility.** Extend reviewed import through a versioned payload/RPC and a stable task-key mapping. Old `phase5_import_project_work` callers retain their existing behavior/result. Manual planning uses the same reference. Gate: confirmed unmatched name survives reload and batch retry; no automatic access, assignment, staffing or Office handover.
4. **Invite local contacts.** Add the explicit local-identity invitation scope using the existing token engine. Update validation context and email rendering to work without a directory join. Gate: new/existing verified identities, wrong account, expiry, resend invalidation, revoke, duplicate requests, email failure and accepted retry all behave correctly; raw tokens remain outside lists/audit/logs.
5. **Resolve and confirm.** Match an existing canonical Office through an authorized confirmation; if none exists, use the approved directory/Head verification process to establish it later. Project name creation/contact invitation require no Admin pre-creation. Creating a global Office or appointing its Head still requires the appropriate existing authority. Gate: contact acceptance cannot self-appoint a Head, move a profile's Office, or select another Office's staff; concurrent claims cannot produce two canonical links.
6. **Handover execution explicitly.** Link to a canonical Phase 6 participant, require joined collaborator authority, then resolve each pending responsibility using existing handover constraints inside a transaction. Keep unresolved task intent planning-only: block staffing, start/submission, review/funding actions and project activation affected by it. Do not bypass locks through direct writes, old RPCs or service wrappers. Gate: source import cannot execute under the creator's Office merely because that ID remains the canonical planning anchor.
7. **Readiness and resolution UX.** Return authoritative unresolved-identity/task blockers alongside existing readiness checks. Link blockers to Office resolution or pending tasks. Observer contacts retain only the existing read access and cannot become executing Responsible Offices. Gate: all blocker reasons are actionable and closed/governed project rules remain intact.
8. **Staged rollout and handoff.** Rehearse migration/backfill and old/new clients on an explicitly identified non-production environment, capture actual-user authorization results, then enable local identity creation after compatible clients are ready. Refresh Graphify and the Mobile A contract manifest. Gate: release and rollback receipts, not source presence alone.

## Data, API and authority impact

This phase needs reviewed additive schema/RLS/RPC/backend changes. It is the exception to the UI-only program rule. Generate migration files through the repository's verified Supabase CLI workflow; never edit an already deployed migration or reset a populated environment. Compare deployed definitions before deployment.

Preserve Head/Task Lead/account role separation, canonical `tasks.org_id`, financial/reviewer routing, existing governed-project paths and auditability. New helpers must authenticate the actor and validate project, Office, state and proposed identity inside the database or trusted backend. Service credentials stay server-side. Audit linking/claiming, invitation transitions and resolved responsibility without passwords or tokens.

G2, the Task Lead shared-project staffing discrepancy described in the program index, is a separate narrowly scoped authority correction. Do not fold it into identity migration SQL.

## UI states, confirmation and form safety

Keep an entered Office name/contact draft on failure. Distinguish a failed mutation from a committed identity/invitation with failed email or refresh. Retry against the same request/identity where appropriate. Validate names, email and project references; explain unmatched and conflicting identity states.

Name edits are Level 1. Linking a canonical Office, transferring responsibility and changing access are Level 2 with before/after impact. Revocation/removal with dependents is Level 3 with server-backed blockers. Do not remove records with dependent active work. Protect dirty multi-field invitation/resolution dialogs; do not interrupt autosaved task fields with discard prompts.

## Responsive and accessibility requirements

Office names and state labels wrap at 320/390 px. Resolution is usable without a wide table or hover-only tooltip. Dialogs fit tablet/mobile web, trap focus, support Escape when safe and return focus to their origin. Pending, observer and joined states include text; announce invitation progress and validation errors. Contact tokens are never displayed in ordinary UI.

## Test plan and E2E acceptance

Extend `tests/unit/projectOfficeAuthority.test.ts`, `tests/unit/projectImportDraft.test.ts`, `server/tests/test_phase6.py`, `tests/sql/phase6-authority.py` and `tests/e2e/phase6-project-offices.spec.ts`. Add proposed identity/claim unit, backend and SQL tests rather than using browser visibility as authorization proof.

Acceptance paths:

- Manually name an absent Office → retain after reload → invite contact → verified acceptance → still no staffing/Head grant → link canonical Office → its Head confirms → valid task handover.
- Import source-backed unmatched Office → human confirmation → durable name/task intent → idempotent retry → resolution without duplicate Office/task creation.
- Wrong email, another Office's Head, ordinary Member, unrelated Task Lead, observer, inactive user and global Admin cannot acquire ungranted operational authority through any direct API/RPC path.
- Linking/acceptance races, resend/revoke races, changed inviter, expired token and started/staffed task handover fail safely and audit accurately.
- Existing canonical Office invitations, project access, shared work, readiness, reviews and financial workflows pass unchanged.

For each implemented slice run `npm run check`, `npm test`, `npm run build` and affected fixture-backed Playwright specs. Backend gate: `python -m unittest discover -s server/tests -p 'test_phase6.py'` in the documented server test environment. SQL gate: run the rollback-only Phase 6 authority harness with an explicit non-production `--project-ref` and the reviewed `--migration`; then test actual user JWT access through the deployed API. No such deployment or SQL execution was performed while writing this plan.

## Rollout, rollback, done and out of scope

Ship additive storage/compatibility first, followed by server and client adapters, then enable new local identity creation. If disabled, retain pending identities and drafts for reconciliation and continue canonical legacy workflows. After unlinked records exist, do not roll back by dropping their table or restoring a non-null constraint that discards them; forward-fix identity mapping and preserve the audit trail.

Done when an absent-directory Office can be retained and invited, proposed work cannot execute prematurely, canonicalization preserves Office autonomy, old clients/canonical flows remain compatible, and the authorization/rollout matrix has receipts. Out of scope: unverified self-appointment as Head, redefining financial routing, new global account roles, automatic AI directory creation, silently moving existing staffed work, or certifying deployed policies from a source-only review.

## Platform references

Keep table grants and RLS together and verify allow/deny behavior; see [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security). Review relevant platform changes at implementation time. The [September 2026 PostgreSQL upgrade advisory](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) makes installed version/index compatibility a deployment preflight item; this plan does not assert the live database is affected or require an unrelated upgrade.
