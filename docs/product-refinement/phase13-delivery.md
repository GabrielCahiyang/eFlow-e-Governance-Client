# Phase 13 — My Work and Inbox delivery

Implemented locally on 6 October 2026; changes remain uncommitted and unpushed.

My Work and Inbox are global personal destinations. Existing task, leadership, deadlines/history, subtask, review, Accounting and notification URLs remain reachable. Admin gets its own updates without operational My Work or approval authority.

My Work reuses current-user task scope with assignment, effective leadership, due-day/week/overdue and recently completed filters. Accessible project labels supply context. The recent-completion bucket explicitly uses the last-update proxy over seven calendar days. Task selection opens the Phase 12 inspector with guarded drafts and return focus.

Needs action independently discovers explicitly routed task and subtask reviews with distinct stable source IDs. Decisions stay in the existing task/subtask review features; funding/workplan/governance queues retain their owners and checked eligibility there. Accounting release, settlement and journal workflows remain separate. No universal approval action or fabricated combined count is introduced.

Updates are accurately labeled as the latest 50 recipient-scoped notifications. Opening does not mark read or approve work. New checked adapters report errors and confirm the returned recipient-filtered write ID before reflecting Read; denied/zero-row writes stay unread. Sources refresh independently every 15 seconds/on focus; scope and sequence guards reject stale results. Legacy notification API returns remain compatible. Deleted/unauthorized destinations and ambiguous legacy subtask labels explain why the target cannot open. New subtask links carry canonical IDs while retaining older parent/label compatibility.

Subtask evidence/progress and review feedback use the shared dirty/pending guard. Failed writes keep drafts; pending refs deduplicate submissions. Existing review, financial, lead retention, unfinished-work and G2 checks remain owned by their original features.

See the [personal source matrix and G4 follow-on proposals](phase13-personal-source-contract.md). Mentions, recipient Invitations, personal readiness discovery and complete update pagination remain outside this UI release because their reliable personal contracts are not established. No database schema, RLS policy, Python endpoint or existing workflow payload/return value changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passed. |
| Unit/regression | 730 tests in 185 files passed. |
| Live frontend | 35 distinct Chromium cases passed: 34-case navigation/inspector/personal run, followed by all 12 personal cases after focus fallback, including one new origin-removal case. |
| Production build | Passed; circular-export and large-chunk warnings remain. |
| Production preview | 6 smoke cases passed on built assets at port 5183 (Head, Member, Accounting Staff, Admin, financial routing and focus fallback). |
| Graphify | Updated: 7,202 nodes / 22,379 edges; six existing partial-extraction warnings retained. |
| Whitespace | `git diff --check` passed. |

Build warning categories existed in Phase 12; the lazy personal destinations increase the circular-export message count from 22 to 41. Broader chunk-boundary hardening remains a Phase 18 target. The production-preview smoke tests exercise the new destinations against actual built assets.

Diagnostic browser receipts are separated from passing runs. They record corrected fixture assumptions: existing Head board heading, transport retry timing, warning status role, tablet navigation breakpoint and duplicate Inbox headings. The subtask guard paths passed before their final heading assertion was corrected.

Browser tests use the real frontend at port 5173 with synthetic intercepted auth/REST/gateway/realtime responses. They do not certify deployed RLS. Native zoom and assistive-technology sessions are not run. The previous phase's snapshots and receipts remain preserved; no pristine Phase 13 before-state was captured. Source snapshots and passing/diagnostic receipts are indexed in the [evidence manifest](phase13-evidence/evidence.json).

Next planned phase: [Phase 14 — People and collaboration](phase-14-people-collaboration.md).
