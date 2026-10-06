# Phase 17 — Validation, Confirmation and Safety Hardening delivery

Implemented locally on 6 October 2026. Changes remain uncommitted and unpushed. No Phase 17 database, RLS, gateway endpoint, service payload or public return contract was changed.

## Delivered behavior

Shared confirmation now supports contextual impact, existing blockers, exact typed confirmation and a labeled required reason. Cancel and Escape resolve without a write. Menu-initiated dialogs return focus to the persistent trigger. The shared action adapter locks synchronously, rechecks current context before writing and records a known service result before refreshing. A failed refresh offers verification of the saved record; an uncertain write is held against repeat activation in that mounted context. This is a client safeguard, not persisted idempotency.

Dirty navigation rechecks the mounted record identity and current pending state, uses the latest discard callback and refuses newly dirty or pending destinations that were not covered by the original review. Task details, submission/reopening, task teams, collaboration staffing/governance, announcements and template drafts retain edits through Keep editing. Incoming refresh does not silently replace staffing or governance edits. Task details also reject a source record changed before Save was pressed.

Task lifecycle actions have contextual review, typed deletion, required cancellation reason and current-record validation. Deleted tasks have no invented restore action; archive retains its existing restore flow. Optional empty-project cleanup has its own review. The task action menu uses the shared portaled dropdown, preserving existing action eligibility while making keyboard and 320px activation reachable. Result and verification notices stay in the task toolbar; browser acceptance checks their viewport visibility.

Staffing edits use one Apply review with task-by-task Lead and contributor differences. Per-click native prompts were removed from unpublished drafts. Current Office, actor, eligibility, Lead-retention and unfinished-work protections remain. Governance captures known service success even when the parent refresh fails; closeout, recusal and archive reviews include the supplied note, reason or decision. Financial cancellation and cap removal show amount/current state and require reasons; Head and independent Accounting authority stay separate. Invitation renewal/revocation holds the same invitation version after saved or uncertain outcomes. Announcement/template actions retain drafts and distinguish mutation receipts from downstream refresh failure.

All identified production `window.confirm`, `window.prompt` and `window.alert` callers were converted. Existing low-risk task/subtask blur, Enter, Shift+Enter and Escape creation behavior remains direct. Previous account, Office, project, financial-posting and private PDS protections remain.

See the [action contracts](phase17-action-contracts.md), [generated registry](phase17-registry/coverage.md) and [owned release gates](phase17-gates.md).

## Acceptance evidence

- TypeScript check, full unit suite and production build passed. Final exact counts and hashes are recorded in [the evidence manifest](phase17-evidence/evidence.json).
- Actual frontend at `http://localhost:5173`: 40 distinct Chromium cases across Phases 12, 14, 15, 16 and 17 passed. The four Phase 17 cases were rerun after strengthening focus/viewport acceptance. Receipts distinguish the earlier 34-case run, the later 10-case run and the final four-case viewport run; overlapping cases are not counted twice.
- Existing isolated authority and Office-identity checks passed 37 and 84 assertions respectively. They did not modify live database records.
- Registry scanner passed six regression assertions; generated coverage checked 2,785 conservative call-site candidates across 46 owned feature gate groups.
- Graphify refreshed locally. Six existing parser limitations and 36 unsupported-extension exclusions remain disclosed. Production build retains the existing circular-export and large-chunk warnings.

The first mobile run exposed a clipped menu; later visual review exposed an off-screen action receipt. Both were fixed and accepted on the live port. A precise partial-save task error was retained after regression detection. A formatting-sensitive source assertion was made whitespace tolerant while preserving its full state/owner condition.

Frozen screenshots and logs are under [phase17-evidence](phase17-evidence/evidence.json). Final 320px typed deletion and desktop verification captures were visually inspected. There was no frozen Phase 17 before-source snapshot; intermediate screenshots are labeled by acceptance run, not presented as a universal pixel comparison.

## Remaining release conditions

The registry is source navigation and explicit gap ownership, not certification of every mutation. All unresolved candidates carry owned blocked release claims. Dynamic calls, SQL delegation/triggers/overloads, actual deployed guards, universal audit persistence and caller-specific retry/Undo guarantees need independent verification. The G2 shared-project Task Lead discrepancy and Phase 6.5 deployment gate remain separate capability work. Existing workflows are preserved; the registry does not widen authority or disable supported features.

Browser tests use synthetic authentication and intercepted REST/gateway/realtime on the running frontend. They do not certify live RLS, actual financial delivery, real invitation email, storage deployment, native devices, additional browser engines or assistive-technology sessions. Client outcome holds clear on remount/reload; independently verify an uncertain record before another write.

Rollback each converted caller/shared adapter with its interaction tests while retaining server protections, source inventory and gate ownership. No automatic irreversible retry or policy relaxation was added.

Next planned phase: [Phase 18 — Responsive, Accessibility, Performance and Release Hardening](phase-18-release-hardening.md), with unresolved authority/audit/native gates kept explicit.
