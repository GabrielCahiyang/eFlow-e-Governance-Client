# R0 data and API contract inventory

This is a **logical contract freeze**, not DDL or installed endpoint documentation. Existing public operations keep their signatures and return values. New capabilities use versioned adapters/operations and separately reviewed migrations. Physical schemas must preserve the canonical Office model and satisfy the compatibility tests before they are accepted in their owning phase.

## Current authoritative paths

| Area | Audited caller → service/server → guard | Current limitation / future boundary |
| --- | --- | --- |
| Task team | Inspector/team editor → `updateTaskTeamMembers` → `updateTask` → Phase 6 task guard | Shared root owner/team edits are Head-only. New contributor delta must not enable Office/identity/root replacement |
| Subitems | Table/inspector → `subtaskService` → `subtasks.task_id` and existing execution/review/sequence guards | Flat parent task; no parent-subitem/lead tree |
| Office roster | `OfficeMembersEditor` → project Office service → `phase6_set_members(p_id,p_users)` | Own Head selects project roster; unfinished assignments block removal; lead-Office staffing exception exists |
| Office invitations | InviteMemberDialog → `/controlpanelEflow/api/invitations` → Head checks + `phase2_create_invitation` / email reservation / `phase2_accept_invitation` | Immediate dispatch; Office affiliation/account-role contract, not temporary project-only acceptance |
| Project Office invitations | Existing `/project-office` and `/v1/project-office-identity` routes + Phase 6/6.5 RPCs | Invite an Office/contact; joining/awaiting Head/linking contract, not individual task guest access |
| Invitation recovery | Existing resend/revoke/validate/create-account/accept routes | Preserve cooldown, token hash/rotation, wrong-email checks, verified identity, idempotency and privacy |
| PDS/professional summary | ProfessionalProfilePanel → protected gateway document/extraction services | Private optional PDF/extracted draft, user review/manual recovery; not project library content |
| Readiness/lifecycle | Readiness panel/completion modal → Phase 7 readiness/review/activation; completion/archive RPCs | Official work/evidence/cash/governance guards remain; UI removal does not alter RPCs |
| Reports/Activity | Project command data/facts/audit → merged selectors | Audit read limit 250, errors become empty; no complete-history cursor/print contract |
| Settings | SystemSettings → `fetchAllConfig` / `updateConfig` → `system_config` | Mixed runtime/unused keys; sequential non-atomic save; no universal per-key validation/audit proof |

## Required logical entities

| Capability | New/extended logical data | Invariants | Phase |
| --- | --- | --- | --- |
| Workspace identity | workspace ID, Office/personal kind, canonical Office link or owner, state/timezone | Real Office link; no dummy Office for personal work; one authoritative project home | R3 |
| Workspace/project placement | workspace/project relationship and explicit shared shortcut | Placement is not authorization; shared records retain original project ID/home/responsibility | R3 |
| Workspace membership | identity, scope/permission, active/ended/revoked terms | Personal ownership distinct from global role; project membership does not grant workspace-wide administration | R3/R9 |
| Project membership | selected identity, sponsoring Office where applicable, viewer/member access, engagement type, end terms, state/revision | Existing Office affiliation unchanged; no automatic enrollment elsewhere; closed/expired scope cannot staff work | R7–R9 |
| Nested work | root task ID, parent-subitem ID, order, contextual lead, revision, validated ancestry/depth | Same project/root, max depth 8, no cycle/self-parent, consistent deletion/review/deadline behavior | R7 |
| Delegation | node lead appointment, appointing authority, validity/revocation history | Current valid ancestor chain; contributor changes cannot alter root identity/Office | R7/R9 |
| Invitation request | requester, target email, project/node, sponsor Head, skill summary, engagement/end terms, state/revision | No raw token/email/grant before approval; approved immutable terms match dispatch; expiry cannot broaden access | R8 |
| Project-member invitation | request approval reference, token hash, identity binding, delivery/acceptance state and unique dispatch key | Separate acceptance from Office-member invitation; membership activation separate from work assignment | R8 |
| Share offer/grant | issuer, recipient/email binding, permitted role, redemption expiry, membership end terms, revocation | Head-only Office issuer; verified recipient; Viewer read-only; redemption never upgrades beyond accepted scope | R9 |
| Removal impact/receipt | project/member, impacted node/lead IDs, current revision/fingerprint, result/audit ID | One checked transaction, complete server-side impact beyond loaded page, no partial unassignment | R9 |
| Project reusable files | object ID/path, project, uploader, source/link provenance, access class, file metadata, state | General file versus formal evidence/PDS distinct; no share/link bypass; retry-safe object + metadata | R6 |
| Activity page/snapshot | source/event identity, project, timestamp, cursor/snapshot/filter identity, completeness/error state | Stable order, unique facts, current authorization, no silent truncation or empty-on-error | R11 |
| Effective configuration | typed key allowlist, current revision, validated value, mutation actor/audit, runtime consumer | Secrets absent from browser/shared table; readonly runtime keys protected; no unsupported “saved means effective” | R12 |

Personal project creation must use a versioned personal-scope persistence path and adapters. R3 must prove either its separately scoped storage or a constrained discriminator design preserves every existing Office-row/`org_id` invariant. The physical choice is an R3 schema-review deliverable; a client-only Office filter, a fake organization, or silently relaxing existing guards fails this contract. Reuse feature logic/selectors through adapters instead of duplicating Office business rules in screens.

New unaffiliated project guests need a valid active Member identity plus an explicit sponsored project membership. The current gateway permits an optional `org_id` on authenticated profiles, but Office execution guards require matching affiliation. R7/R8 must add a narrow project-guest authorization branch rather than rewriting a person's canonical Office or broadening all existing guards. Verify database/profile bootstrap constraints before choosing the new-account implementation. Missing compatibility blocks guest activation, not Office workflows.

## Versioned operation requirements

The following are contract names, **not routes already exposed**. Owning phases choose/version the concrete gateway/RPC interfaces and pin request/response schemas in tests. Do not silently repurpose current Office invitation/roster functions.

| Target operation | Required input/output facts | Required enforcement |
| --- | --- | --- |
| List/Create/Select workspace; create personal project | Explicit kind, owner/current workspace, placement, returned scope ID | Actor identity, own creation eligibility, no Office affiliation/Head grants |
| List/select project members | Project/Office scope, selected IDs, revision, effective eligibility | Own current Head; active selected membership, lead-Office backfill compatibility |
| Patch work contributors / appoint child lead | Node, expected revision, exact contributor/lead delta | Effective current lead; subtree/Office/membership checks; prohibit root/Office/project changes |
| Create/reparent/reorder nested subitems | Root/parent IDs, order, version; updated tree revision | Transactional cycle/depth/deadline checks; same scope; no started-work bypass |
| Submit/approve/reject invitation request | Request ID, expected revision, exact frozen email/project/node/engagement/end terms, approval actor/time | Current requester + appointed sponsor; no send side effect from submission; changed terms require reapproval |
| Dispatch/accept project-member invitation | Approval ID, idempotency key; scoped safe receipt; accepted membership ID/state | Authority/state recheck; verified matching email; current grant terms; no global role/Office change |
| Create/redeem/revoke share | Recipient, Viewer/member scope, 1–30-day redemption TTL, access-end terms; safe grant receipt | Authorized Head, authenticated identity, project state and viewer denial paths |
| Preview/confirm member removal | Full impact + fingerprint; exact confirmed fingerprint; durable receipt | Recompute impact/lock/revision; atomic unassignment/delegation/member removal; cancellation zero writes |
| Upload/link/download project library file | Project, object/metadata idempotency, source ID/class, safe metadata/signed download | Current file/project right; evidence/PDS separation; per-request authorization |
| Fetch/print activity snapshot | Project/filter/date range, cursor/page size/snapshot identity; events, next cursor, known count or unknown, source completeness | Stable `(occurred_at,event_id)` ordering; canonical source dedup; no unauthorized entity filter |
| Save effective settings | Allowed keys, typed values, expected config revision; applied changes/audit/restart effects | Actual administrative capability; atomic allowed-key validation; server-secret exclusion |

Across these operations, client actor/Office/role strings are not authority. Request cancellation or failed confirmation starts no mutation. A known committed result survives a subsequent refresh/email/PDS failure. An uncertain irreversible result is verified against its operation receipt before retry. Preserve old contracts for Office clients until all consumers are migrated through public feature APIs.

## Invitation and membership state contract

1. **Request pending:** authenticated requester records exact scope/terms. No invitation token, mail send, access grant or work assignment.
2. **Approved or rejected:** appointed sponsor reviews current terms/revision. Rejected requests cannot dispatch. Edited approved terms invalidate approval and return for review.
3. **Dispatch reserved:** recheck approver appointment, actor/node/project/membership/end terms, then reserve one unique request dispatch. Generate the token only now. Token hash is persisted; raw token stays out of logs/history/local storage.
4. **Invitation pending:** distinguish durable invitation creation from provider acceptance/delivery. Failed delivery retries the existing permitted invitation through cooldown/rotation; it does not recreate the successful membership/request row.
5. **Verified acceptance:** current scope and matching verified email; use existing identity when present; idempotent account bootstrap if absent. Preserve global Office/role. Record accepted project membership; assignments remain a separate action.
6. **Onboarding:** optional private PDS processing/profile confirmation has its own status and retry. PDS extraction failure does not recreate/send an accepted invitation or invent a completed skill profile.
7. **Active/ended/revoked:** project-only access respects date/close/revocation. Restoration does not revive grants. Request/invitation/dispatch/delivery/PDS/membership are separate status axes, not one misleading “success”.

Preserve current provider `sent` versus actual `delivered` distinction. Test genuine supported expiration; never mutate timestamps or recover raw tokens from hashes to manufacture acceptance evidence.

## Nested work and removal compatibility

Keep existing root/subitem IDs and flat records valid. Direct current subitems migrate to depth 1. New hierarchy reads return root/parent/lead/depth/order so old flat adapters can remain explicit rather than silently losing descendants. Extend reports/templates/import/notifications/sequence/deadline/review callers before enabling deep writes.

Reparenting started/submitted/reviewed work must preserve existing immutability and active-work constraints. Descendant deadline changes cannot silently extend ancestors. Reordering is sibling-local; dependencies remain cycle-checked and retain same-root execution rules unless separately amended. Financial request/evidence identity is counted once; moving/hiding/deleting work never clears cash or approved evidence.

Removal reads the whole affected project workload on the server, checks the confirmed revision, clears the person's current assignments and lead validity, and removes membership in one transaction. Unfinished nodes become Needs reassignment; financial obligations and historical authorship remain. Concurrent assignment/lead changes produce a conflict and fresh impact preview, not partial removal. Former delegates cannot manage via cached ancestry.

## Access expiry and storage/realtime contract

Every server read/write, acceptance/redemption, and signed-URL creation evaluates effective membership and project state. Expiry must work without waiting for a background job. A reconciler may materialize ended state/audits, but is not the authorization boundary. UI caches/subscriptions clear on revocation/scope switch and deny consequential actions with stale grants.

Previously issued signed URLs can remain valid until their expiry. Set a target maximum **60 seconds** for newly introduced temporary-project library downloads; test actual revocation limitations before claiming immediate byte-access removal. Official existing evidence signing remains its own contract until reviewed. Already downloaded bytes cannot be revoked. Realtime delivery must be proven to deny protected post-expiry events on an established connection; if the deployed transport cannot do so, use an authorized polling/read adapter or disable that protected subscription rather than claiming UI unsubscribe proves security.

## Migration and release boundary

No migration is created/applied by R0. Later schema work uses CLI-generated migration names, disposable local tests and an isolated deployment workspace populated from live history. Only `ixnfphgjyelhckjwjkdv` is the hosted target. Preserve the installed Phase 6.5 timestamp and the live Phase 6 ledger versions documented in the addendum; never repair history to repository filenames. Keep explicit RLS/grants, safe function search paths, least privilege, auth checks and storage guards. Verify actual function versions/overloads when reviewing later SQL.

Rollout must preserve records/evidence/authorship and old frontend/gateway callers. On failure disable new capabilities and forward-fix mappings/guards; never widen authorization, drop accepted data, or reapply installed historical migrations. Full backend rollout and live acceptance remain separate from this contract package.
