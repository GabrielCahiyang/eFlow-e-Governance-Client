# R9 local delivery — sharing, removal and access lifecycle

Implemented and verified locally 8 October 2026. R9 replaces copy-only project sharing with recipient-bound Viewer/member offers, adds full reviewed transactional removal and explicit renewal, and enforces ended access through the checked server predicates. [The access contract](r9-access-contract.md) records scope, authority, lifetimes, public RPCs, session behavior and rollback boundaries.

The Lead Office Head issues Office shares; participating Heads manage their own personnel. Personal owners manage selected people, while the designated sponsoring Head handles external personal offers through a narrow issuer page. Ordinary navigation links grant nothing. Offers require an existing active verified account and recipient redemption; they default to seven days and support one to thirty. Editing eligibility does not appoint a task Lead or grant Head/review/financial authority. Current identity, appointment, project state and recipient Office/guest approval are rechecked on redemption.

Members and Office roster editing review the complete server assignment impact, including unloaded roots, descendants, sole Leads and dependent delegation. Confirmation verifies its fingerprint and atomically clears staffing, ends scoped access/invitations and appends history/audit. Cancellation makes zero writes; changed work needs a new review. A late failure rolls the entire operation back; lost responses reuse immutable request receipts. Sole work Leads can be removed; mandatory workspace/Office ownership requires replacement. Unfinished roots display **Needs reassignment** and cannot execute without a current active selected Lead. Progress, submissions, evidence and authorship remain attributable.

Dates use the exclusive end of the chosen local date. Temporary terms end at the earliest date, completion/archive or revocation. Permanent memberships retain permitted closed-history reads. Restore does not revive ended access; renewed selected or approved guest membership clears stale staffing. Legacy deletion/accepted-guest revoke APIs direct callers to reviewed removal. New sharing/removal controls wait for capability; unavailable installations retain earlier staffing behavior with an explanation.

Fresh RLS/RPC/library object authorization denies expired/removed access. Task and workflow feeds use authorized fifteen-second polling, with auth cache reset and stale-response rejection, alongside workspace/personal/Members refresh. This bounds normal update latency rather than claiming immediate transport delivery. Previously issued signed file links remain usable for their existing short lifetime; downloaded bytes cannot be recalled. Hosted transport/Storage/session acceptance remains open.

## Verification

- `npm run check` and production `npm run build`: passed. Existing shared-chunk and static/dynamic import warnings remain; no scale or release-performance acceptance is claimed.
- Full frontend: **227 files / 929 tests passed** on the final behavioral implementation. The seven R9 cases cover full-impact cancellation, stable uncertain retries, saved-result refresh failure, explicit stale-preview refresh, late capability/removal-context results, local-date/seven-day offers and reviewed atomic roster selection. Cache tests reject old-actor reads and confirm protected task data no longer uses persistent subscriptions. The final focused run passed **34 tests**.
- Gateway: **64 tests passed** using the repository server virtual environment; no provider or hosted calls.
- Disposable PostgreSQL: **81 R9 checks passed** using real prerequisites, R3/R6/R7/R8/R9 and private evidence sealing. Cases include zero pre-redemption grant, Viewer direct mutation denial, revoked fresh Storage signing/read denial, wrong recipient, expired offers/terms, changed Head/recipient scope, temporary close/restore, permanent closed read, personal/sponsor authority, sole-Lead removal, complete descendants, stale fingerprints, late transaction rollback, atomic Office selection, response-loss replay, preserved history/progress and cleared staffing after selected/guest renewal.
- R7 compatibility with R8/R9 installed: **102 SQL checks passed**. Two former expired-member broad-read expectations intentionally become denied access under D17; the remaining assertions are retained.
- Chromium: **19 distinct cases passed** across R9, R8, R7 and Phase 2 invitations. Final R9 presentation corrections pass all **four R9 cases** again, including an asserted genuine dark palette at 320 px, refreshed concurrent-impact review, cancellation/success, recipient-link failure and desktop sharing. All browser records/backend operations are synthetic and intercepted.
- Graphify refreshed locally: **8,172 nodes**, with the four existing parser warnings for guided-tours/productivity/work-templates public indexes and ProjectTaskRow. No forced smaller graph or hosted introspection.
- `git diff --check`: passed with normal repository Windows line endings. R9 scratch files removed and preview server stopped before handoff.

## Hosted status and rollback

`20261008081855_r9_project_access_lifecycle.sql` is **unapplied**, as are pending R3/R6/R7/R8 dependencies. No hosted schema/history, account, real invitation, email or provider configuration was changed. Sole future target remains `ixnfphgjyelhckjwjkdv`; preserve actual migration timestamps and prepare an isolated live-history workspace before deployment.

Hosted acceptance must establish genuine actor/session denial, concurrent transaction behavior, expiry/completion/archive and restore/reapproval, actual Storage signing/byte lifetimes, scoped direct API denial and refresh/transport cleanup on the deployed build. R8 verified-sender and genuine non-test mailbox onboarding remain open. Existing Phase 6.5/live and Phase 18 acceptance status is unchanged.

Rollback application entry points first while retaining grant, ended membership, invitation, audit, progress and evidence history. Do not drop lifecycle records or restore earlier broad predicates while new grants/ended staffing exist. Nullable personal Leads are intentionally retained for reviewed removal and later reassignment. R10 is the next implementation phase; R13 owns integrated hosted/release acceptance.

## Visual evidence

Synthetic desktop sharing and genuine dark mobile removal were inspected for reachable controls, text wrapping and local scrolling:

- [Desktop recipient-bound offer](r9-access-evidence/r9-share-desktop.png)
- [320 px dark removal review](r9-access-evidence/r9-removal-320.png)
