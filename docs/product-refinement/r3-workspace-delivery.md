# R3 — Personal workspaces and project isolation

Implemented locally 7–8 October 2026 (Asia/Singapore) against R0 D06–D08/D15 and the existing R1/R2 working-tree implementation. Local verification finished 8 October. Hosted deployment and acceptance remain pending on the sole target `ixnfphgjyelhckjwjkdv`.

## Delivered slices

| Slice | Result |
| --- | --- |
| Real workspace identity | An additive pending migration creates real Office workspaces using canonical organization UUIDs and separate personal workspaces with an owner and no Office affiliation. No dummy organization, new account role or Office-Head authority is created. |
| Deterministic placement | Existing project IDs, task records, participation, grants, evidence and finance remain intact. Canonical `org_id` determines home; a single joined lead Office supplies the null-home fallback. Ambiguous/missing homes are recorded privately and retain existing authorized visibility. New Office project/name changes synchronize through additive triggers. |
| Server authority | Seven authenticated RPCs provide workspace list/create/select, personal project creation/snapshot, eligible candidate lookup and personal commands. New tables permit authenticated RLS-protected SELECT only. Direct writes, unrelated actors, anonymous users and unsupported owner roles are denied. Workspace discovery does not confer sibling-project access. |
| Personal work | The owner creates projects, selects onboarded own-Office members and staffs tasks. Assigned leads record progress and submit work. Optional appointed independent reviewers approve/reject; owners cannot self-review or waive required review. Completion requires all work/review done; archive requires completion. Internal Members retain closed history; Viewers end at close. |
| Retry and history | Atomic creation includes mandatory owner membership. Stable request IDs, actor receipts, expected revisions, project locks and immutable events protect retries/concurrent changes. Failed creation leaves no partial records; known committed responses remain successful when refresh fails. |
| Selector and creation | Current workspace, account-local recents, My workspaces, available workspaces, name/type/owner search and Create workspace integrate with R2. Personal and Office project creation explicitly identify their scope and contextual owner/creating Head. Missing server capability disables personal creation while preserving the old Office surface. |
| Scope and compatibility | Routes, selected projects, preferences and project caches include workspace/account identity. Switching clears stale content and old inspector/planning parameters. Poll/focus/request denial clears revoked private content. Old Office caches discard late reads and Realtime callbacks on account changes. Shell-owned Office subscriptions stop in personal contexts. |
| Explicit shortcuts | An owner may place a pointer in their own Office workspace. It grants no access to unrelated Office users, including its Head. Opening it changes to the personal home and project atomically through the existing dirty/pending navigation guard. Accounting, Inbox and authorized support destinations remain discoverable and return to canonical Office scope. |

The implementation is organized under `src/app/features/workspaces/` with a small public API. Existing Office service return values, operational roles, Python endpoints and financial workflows are unchanged. Known committed Office creation remains immediately selectable while the authoritative workspace refresh is delayed.

## Database review and rollout boundary

- [Schema, API, backfill and rollback review](r3-workspace-schema.md).
- Pending migration: `supabase/migrations/20261007120000_r3_personal_workspaces.sql` — prepared and tested locally, **not applied**.
- No personal storage bucket or Realtime publication is enabled. Cross-store UUID guards prevent personal work from aliasing existing Office evidence/finance identities. Files remain R6 work; sponsored external invitations remain R8; share tokens, engagement/access-end dates and transactional unassignment remain R9.
- Current R3 candidates are already onboarded active verified people in the owner's own Office, plus self. No-Office owners can work alone. Removing/downgrading unfinished assignments requires resolving staffing first; the later R9 confirmed removal workflow is not represented as delivered.
- Server revocation is immediate. The active UI detects it on its next request, focus or 15-second polling interval under a working connection. Synthetic browser fixtures do not establish hosted RLS, file transport, real session refresh or deployment acceptance.
- Before hosted installation, follow the dated [Phase 6.5 live addendum](../phase65-live-deployment-2026-10-07.md): populate an isolated migration workspace from the live ledger, inspect dependencies/backfill exceptions, preserve installed timestamps and apply only the reviewed pending migration. Never push the historical repository migration directory or repair live history.
- Capability rollback revokes the new RPC/table access while retaining all personal data/history and old Office operation. Physical removal requires a separately authorized verified export and dependency review.

## Verification

- `npm run check`: passed.
- `npm test`: **218 files / 871 tests passed**. R3 regressions cover switching, late responses, revocation, account/workspace isolation, route precedence/history, retry identity, contextual navigation, preference keys, independent review and Office account-cache reset.
- `npm run build`: passed. Existing static/dynamic import and large-chunk warnings remain; this does not close the Phase 18 performance gate.
- `npm run verify:r3-workspaces`: **102 checks passed** on disposable PostgreSQL seeded from the deployed Phase 1 fixture and Phase 2–7/6.5 SQL. Tests switch to `authenticated` for actual table RLS and exercise anonymous/direct-write denial, backfill byte preservation, owner roles, project isolation, own-Office candidate limits, membership expiry/revocation, independent review, conflicts/retries, close/archive, shortcuts, absence of personal storage/publication and reversible capability rollback. No hosted writes occurred.
- Chromium: **26 distinct cases passed** in the final combined `navigation-v2.spec.ts`, `workspace-refinement-r2.spec.ts` and `workspace-refinement-r3.spec.ts` run (20 retained cases plus six R3 cases, zero failures/skips/retries). R3 covers **320, 390 and 1440 px**, create/failure/retry, personal work, reload/history, Office-tree isolation, shortcut home, dirty cancellation, revocation, delayed Office creation and Accounting/Inbox compatibility. Retained cases additionally cover all four roles, authorized support routes, shared observer projects, failed/dirty Office writes, logout, no-Office contexts and R2 navigation at 768/1024 px.
- `npm run graph:update`: completed — **7,637 nodes / 24,336 final edges**. Reviewed limitations: 38 unsupported-extension files skipped and the four existing parser warnings in `guided-tours/index.ts`, `productivity/index.ts`, `ProjectTaskRow.tsx` and `work-templates/index.ts`. Indexing remained local/code-only; no forced smaller graph.
- `git diff --check`: passed.

## Retained visual evidence

Representative synthetic personal records rendered from the production shell; mobile and desktop screenshots were visually inspected for readable controls and contained page width:

- [320 px personal project](r3-workspace-evidence/r3-personal-320.png)
- [390 px personal project](r3-workspace-evidence/r3-personal-390.png)
- [1440 px personal project](r3-workspace-evidence/r3-personal-1440.png)
