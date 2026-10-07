# Phase 6.5 implementation receipt

Current live deployment and acceptance status is recorded in the [7 October 2026 addendum](phase65-live-deployment-2026-10-07.md). The original implementation and rehearsal receipt below is preserved as historical evidence.

Implemented locally on 6 October 2026 against baseline `a16d36e`, with a successful rollback-only hosted rehearsal. The additive identity ADR is [here](product-refinement/phase65-identity-adr.md); the Mobile A source contract is [here](phase65-mobile-contract.md). **No migration has been permanently applied to either Supabase project.** This receipt records implementation and verification, not a production release.

## Delivered behavior

- The appointed Lead Head can retain a named Office before a canonical directory entry exists. Creation and reviewed source-backed import use the same identity model. Names and proposed task responsibility survive reload/retry without appointing a Head, creating a global Office, selecting employees or silently transferring execution.
- Project Offices separates retained name, contact invitation/delivery, acceptance, directory linking and canonical participation. Invitations reuse Phase 2 verified-email, opaque-token, claim, expiry, cooldown, resend/revoke and dispatch behavior. Drafts survive failures; committed save/delivery/refresh outcomes are distinguished. Dirty invitation/link dialogs require explicit discard.
- Linking is immutable, same-project and Head-authorized. Pending invitations must be accepted/revoked first. Existing participant reuse preserves unique canonical participation and checks relationship conflicts. Existing contact role and Office affiliation are retained; incompatible affiliation is a resolution blocker.
- An accepted ordinary contact awaits its canonical Office Head; the Head chooses its own project members. Unstarted, unassigned proposed tasks require explicit handover to a joined non-observer participant. The table shows proposed names, disables owner/status/staffing actions, and the detail drawer blocks execution. Readiness provides an actionable Office-resolution blocker.
- Database guards prevent bypass through direct task/subitem, progress/evidence and funding writes. Parent row locks serialize proposal versus execution mutations. Canonical ownership, reviewer routing and existing canonical invitation/import contracts remain available. Canonical-only projects retain existing readiness approval fingerprints.
- Responsive named-Office/contact/link controls were checked at 320px; existing Phase 5–7 desktop/mobile flows were exercised against the running Vite frontend with synthetic backend interception.

## Migration and API

CLI-generated additive migration: `supabase/migrations/20261005170822_phase65_project_local_office_identity.sql`. The executable CLI used was version 2.116.0; the cached npm wrapper was missing its Windows binary. Existing deployed Phase 2/6/7 definitions and migration metadata were checked read-only on configured project `ixnfphgjyelhckjwjkdv`. This preflight inspected definitions, not project/user records.

New public read-only table: `project_office_identities`; nullable task intent reference: `proposed_office_identity_id`; constrained local invitation target: `project_office_identity_id`. Same-project composite FKs, unique unlinked names/pending invitations, least-privilege grants and project-read RLS protect the new records. Private compatibility copies preserve baseline function signatures/behavior. The new table is published for authenticated Realtime.

Authenticated Head operations: save identity, link, propose responsibility, resolve responsibility, and reviewed import. Invitation creation is service-only and is reached through the strict versioned gateway endpoint. Versioned routes and exact RPC shapes are documented in the mobile manifest. Raw tokens remain excluded from safe lists and audit events.

## Verification

Commands and results are recorded below. Browser/disposable SQL fixtures are synthetic. The PGlite runner loads no environment credentials and contacts no Supabase service. The separate hosted runner uses only the explicitly matched rehearsal connection and always rolls back; it refuses the main project.

| Check | Receipt |
| --- | --- |
| `npm run check` | Passed. |
| `npm test` | 168 files / 628 tests passed. |
| `npm run build` | Passed; existing cyclic re-export/dynamic-import and large-chunk warnings remain. |
| `server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p 'test_phase*.py'` | 34 tests passed, including Phase 2/5/6/6.5/7 gateway contracts. |
| `npm run verify:phase65-identity` | 84 assertions passed. Covers canonical backfill/fingerprints, stable ID/import retry, direct-write execution locks, Lead/member/foreign Head/Admin/inactive/anonymous denials, wrong/unverified email, claim contention, expiry, token rotation, revoke, stale inviter, closed project, local contact RLS, observer, linking, explicit handover and canonical/Office-member invitation compatibility. |
| `server/.venv/Scripts/python.exe tests/sql/phase65-hosted-rehearsal.py --project-ref epmwzfjlghtpeygbhrdv` | 21 checks passed on hosted PostgreSQL 17.11, including real grants/RLS, verified contact preservation, role denials, explicit handover and canonical Head staffing/review. Missing Phase 3/5/6/7 prerequisites and Phase 6.5 were rehearsed in one transaction; all DDL and fixtures rolled back. This is SQL role/claim testing, not a user JWT/API receipt. |
| Fixture-backed Playwright Phase 5/6/6.5/7 | 12 scenarios passed across the initial run and corrective rerun; final Phase 6.5/7 rerun verifies sizing and readiness navigation. Real Vite DOM on port 5173; no real accounts, database writes or emails. |
| `npm run verify:client-secrets` | Passed against final build. An obsolete, unused browser-prefixed credential duplicated the existing server-only credential in ignored `.env`; only the duplicate entry was removed. No credential value was logged. |
| `npm run graph:update` | Local code-only graph refreshed. Graphify warns about unsupported SCSS and partially extracted TypeScript/TSX files; source and compiler results remain authoritative. |

The disposable SQL bootstrap restores archived public tables/functions/policies/triggers, then executes Phase 1/2/3/5/6/7/6.5 migrations. Private evidence-seal definitions are absent from that archived snapshot; their triggers are excluded and their existing security runner remains the deployment gate. The fixture's starting grants are simplified; the Phase 6.5 migration's own read-only grants/private-schema restrictions are tested directly. The hosted runner additionally exercised the actual restored rehearsal schema, existing triggers, grants and RLS. Rehearsal metadata had Phase 1 and the three Phase 2 versions; missing prerequisites were tested transactionally without permanently advancing its ledger. Claim/race guards were exercised sequentially; actual multi-session contention, native clients, network delivery and deployed user JWT receipts are outstanding. The SQL tooling driver `psycopg2-binary` 2.9.13 was installed only in the ignored server virtual environment, not in global Python or production requirements.

## Deployment and rollback

1. Select an explicitly non-production Supabase environment and confirm its baseline migration/function definitions, extensions, grants, database version and existing canonical workflows. Do not apply the entire historical migration chain to a populated environment simply because this fixture uses it.
2. Apply only the reviewed Phase 6.5 migration through the normal migration workflow. Verify backfill without task ownership, membership or invitation changes; capture real user JWT allow/deny tests and concurrent link/claim/resend/proposal-versus-execution tests. Re-run the existing evidence/financial authority harnesses against that environment.
3. Deploy the compatible gateway and client after storage/RPC compatibility exists. Missing identity installation is an explicit error; new reviewed Office intent never silently falls back to a legacy import. Test new/existing email acceptance and delivery failure using approved synthetic recipients.
4. Record staging receipts, then perform the shared-environment rollout. This repository has no supplied native client, so Mobile A must verify the published manifest against its actual source/platforms before enabling native local identity workflows.

Rollback is a compatible client/gateway disable or forward fix. Preserve identities, proposals, import receipts and audit history; never drop the additive tables/guards to let unresolved work execute. Accepted contacts retain project read context while unresolved, and linked access respects canonical participation revocation. Existing accepted-token/participation removal rules remain Phase 2/6 contracts; this phase introduces no global directory or Head appointment/removal flow. Closed/governed projects remain read-only for identity changes. G2 and later UI refinement phases are separate work.
