# Mobile A — Contract alignment

Status: cross-repository implementation plan; native mobile source is not present in this checkout. Baseline web/backend: `a16d36e`, 6 October 2026. Read the [program index](README.md). Run this track in parallel with the web program; do not wait for all desktop screens.

## Goal and dependencies

Align the mobile client with four account roles, contextual Task Lead authority, Office/project access, evidence/review workflows and secure invitation deep links. Obtain the actual mobile repository, framework/platform targets, source SHA and agreed non-production environment before naming native files or claiming device acceptance.

Phase 6.5's new identity contract and gate G2's shared-project Task Lead staffing resolution need explicit version handling. Existing canonical workflows can align earlier. Mobile B consumes the accepted contract manifest.

## Current-state findings and modules

- `src/app/shared/roles.ts` and `server/services/account_roles.py` normalize legacy identities to Admin, Head, Accounting Staff or Member and fail closed for unsupported roles. Task Lead is not a managed account role. `tests/unit/phase1Roles.test.ts` verifies Admin/financial separation.
- Effective task leadership uses `src/app/features/tasks/selectors/leadership.ts` and `selectors/teamMembership.ts`. Subtask workflow and deadline contracts reside in `src/app/features/subtasks/services/subtaskWorkflowService.ts` and `selectors/deadlines.ts`.
- `src/app/features/invitations/services/invitationService.ts`, `components/AcceptInvitationPage.tsx`, `server/routers/invitations.py` and the Phase 2/6 migrations preserve invited email, existing identity, opaque-token acceptance, account role and project scope. Web removes a token from its URL and keeps it in memory while completing acceptance.
- `docs/mobile-phase-1-backend-handoff.md` is an older evidence-security handoff, explicitly not a deployment receipt or completed native release. Source contracts include `supabase/migrations/20260831000001_task_evidence_security.sql` and `scripts/verify-task-evidence-sql.mjs`. Confirm their actual deployment before mobile integration.
- `docs/mobile-responsive-rollout.md` concerns the web client and contains older terminology. Its screenshots/tests do not prove native completion. No Dart, native platform app sources or native project manifest was found in the current checkout.

Graphify reuse: the bounded project Office/invitation query identified backend adapters; direct role/evidence sources then established the contract. Once the mobile repository is available, map only its auth, task, evidence, invitation and review callers. Do not index live user data.

## Information architecture and component boundary

Mobile consumes personal work, authorized project/Office context and contextual task actions. Keep account identity, Office appointment, project participation and task leadership separate in models and capability decisions. Add one mobile normalization/API adapter layer using that repository's conventions; screens must not duplicate role aliases or raw authorization logic.

## Small vertical slices

1. **Freeze a joint manifest.** Record web/backend/mobile SHAs, supported platforms, environment, endpoints/RPC shapes, role aliases, task/subtask states, invitation types, evidence limits, notifications and Realtime behavior. Mark deployed/undelivered/unknown separately. Gate: both repositories use one reviewed compatibility manifest.
2. **Normalize identity and capabilities.** Align role labels and adapters; test inactive/unsupported identities and Admin versus operational project access. G2 must distinguish Head lead appointment from eligible own-task contributor management. Gate: direct backend denials and client role/action matrix agree.
3. **Align task/review contracts.** Use canonical Office identity and effective Task Lead; preserve all workflow states, submission attempt IDs, stored review routing, return-for-change and completion prerequisites. Gate: the same synthetic records give consistent web/mobile results.
4. **Align evidence and cleanup.** Query `get_task_evidence_rules()` where deployed; preserve submission fields `id`, `note`, `attachments` and attachment fields `fileName`, `filePath`, `fileSize`, `mimeType`. Use the private `task-attachments` bucket and existing task/subtask/progress path formats. Do not persist signed URLs as evidence paths. Rehearse claim-before-remove cleanup and immutable finalized evidence against the actual deployed rules. Gate: the acceptance matrix in the existing backend handoff passes using real permitted/denied users.
5. **Deep links and invitation identity.** Validate the original opaque token through the backend; retain it only for acceptance, protect it from logs/analytics and handle wrong-account switching. Support existing-account/new-account paths, expiry, revoke, resend and accepted retries. Project contact acceptance cannot change global role or Office. Gate: launch from a supported native link plus web fallback, complete only the exact invitation scope, and reopen safely after interrupted login.
6. **Cross-client rollout.** Verify publication/subscription membership and actual-user visibility. Submit on mobile → review on web → update on mobile; denied users see neither protected rows nor events. Publish the accepted manifest and feed unresolved capability gaps into Mobile B. Gate: environment-specific receipts, native tests and agreed compatibility policy.

## API, migration and guardrails

No new database/RLS/business-rule changes in this alignment track. Deployment of the already-authored evidence-security work and new Phase 6.5/G2 corrections belongs to their backend owners and separate release gates. If a required operation is absent, record a versioned backend extension rather than mimic it with client writes or a service-role key. Never apply a historical handoff migration blindly to a shared database.

## States, validation and safety

Handle loading, stale session, revoked capability, failure, retained draft, retry and committed-success/refresh-failure separately. Preserve drafts across retry and avoid duplicate submissions. Evidence type/size failures explain the rule; normalize a legitimate native picker MIME type without disguising unsupported bytes. Apply Level 2/3 confirmations only to authorized material/destructive actions; dirty multi-field task/evidence forms have discard protection.

## Responsive and accessibility

Contract alignment does not prescribe the missing client's framework. Test readable labels, native dynamic text, accessible role/status announcements, focus after validation, keyboard-safe forms and supported deep-link/browser handoffs on each supported platform. No desktop Gantt or admin configuration is required here.

## Tests and E2E acceptance

Use web references `tests/unit/phase1Roles.test.ts`, `tests/unit/taskTeamMembership.test.ts`, `tests/unit/hierarchicalDeadlines.test.ts`, `tests/e2e/phase1-authority.spec.ts`, `phase2-invitations.spec.ts`, `phase6-project-offices.spec.ts`, server Phase 2/6 tests and the evidence SQL runner. Add native contract fixtures and run that repository's actual lint/type/unit/device commands after discovering its tooling; do not invent an Expo/Flutter command.

Minimum paths: Member submits assigned subtask evidence; effective Task Lead reviews permitted work but cannot self-replace; Head reviews only own-Office outputs; Accounting Staff executes only financial operations already allowed; Admin cannot gain operational rights; unrelated/observer accounts are denied. Test wrong-account/expired invitation, retry after interruption, failed upload cleanup, protected final evidence and two-client review/notification behavior.

## Rollback, done and out of scope

Keep the prior compatible client available, disable only unsupported new flows and preserve server-side state/submission IDs. Native rollback must not relax evidence policies or remove durable seals. Done requires a reviewed manifest plus actual platform and deployed-API receipts; this repository alone cannot certify it. Out of scope: redesigning every desktop screen, new account roles, Office authority shortcuts, automatic Head claims, or resolving unknown mobile code by guessing its stack.
