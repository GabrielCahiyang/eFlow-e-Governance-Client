# Phase 14 — People, Invitations and Collaboration delivery

Implemented locally on 6 October 2026. Changes remain uncommitted and unpushed.

Office Team now has searchable active-member and invitation tables, role/status filters, independent loading/retry states and a contextual member inspector. Professional summaries load only when their tab opens; foreign-member summaries never request private PDS records. Owners retain their existing private profile workflow.

Project Offices now has one management table and a contextual inspector for participation, project teams and invitation history. Own-Office staffing, appointed Head authority, observer/closed/governed restrictions and Proposal Context handoffs remain intact. The separate Phase 6.5 named-Office and proposed-responsibility workflow remains reachable.

Invitation validity is separate from email delivery. Multi-recipient invitations retain failed rows and receipt successful creation without silently repeating it. Sending, rotating a fresh link and revoking access require a concrete review. Clipboard failure retains a temporary selectable link; failed refresh offers loading recovery without another create/write. Sensitive links are kept in component memory and excluded from captures.

Project member editing previews added/removed people and authorized unfinished-work blockers. It preserves drafts on failure or authority loss, checks fresh Office/account/project authority and concurrent membership before the unchanged staffing RPC, and requires explicit reload when the baseline changed. The server remains the final authority. Dirty and pending guards cover dismissal, tabs, routes and related-task handoffs; focus returns to the originating row or search. Known successful saves survive refresh failure without enabling a duplicate save.

Inbox supplies authorized links to existing invitation and participation workflows. It does not fabricate a personal recipient-invitation feed. Tours and the current-to-target map now describe the delivered surfaces.

See the [entry, source and authority contracts](phase14-people-contracts.md). G2 delegated shared-project Task Lead staffing remains blocked by the existing task trigger. G4 recipient-invitation discovery and bulk professional/PDS metadata remain separate contract work. No schema, RLS policy, Python endpoint, existing payload or public service return contract changed in this phase.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passed. |
| Unit/regression | 753 tests in 193 files passed. |
| Live frontend | 41 distinct Chromium cases passed across the combined run and focused governance/named-Office follow-ups. |
| Isolated server | 19 Phase 2/6 authority and invitation tests passed using the existing server virtual environment. |
| Production build | Passed in 13.21 seconds; 41 circular-export messages and the large-chunk warning remain, matching Phase 13 categories/count. |
| Production preview | 6 smoke cases passed on built assets at temporary port 5183. |
| Graphify | Updated: 7,272 nodes / 22,736 clustered edges (23,467 before clustering); six existing partial-extraction warnings, 34 unsupported files skipped. |
| Whitespace | `git diff --check` passed. |

Final receipts and source/capture hashes are indexed in the [evidence manifest](phase14-evidence/evidence.json).

The live frontend was exercised at port 5173 using synthetic intercepted auth, REST, gateway and realtime responses. No live database writes, real email delivery or deployed RLS certification are implied. Browser coverage includes desktop and 320/390px layouts, keyboard focus, partial-success recovery, authority loss, guarded handoffs and existing Phase 2/6/6.5/12/13 workflows. Native zoom and assistive-technology sessions were not run.

Diagnostic receipts retain the initial nested-guard handoff failure and corrected fixture assumptions. The accepted handoff opens after one discard and waits for the exiting confirmation before testing Escape. The combined browser run passed 37/38 cases; its governance case timed out at the login button before entering the feature, then passed in an isolated rerun. All three affected named-Office compatibility cases passed separately.

The baseline captures show the previous Project Office cards/member dialog only. They are not a pristine baseline of every People surface. Existing build chunk warnings and Graphify partial-extraction warnings are documented with their final counts in the evidence manifest.

Next planned phase: [Phase 15 — AI, PDS and governance](phase-15-ai-pds-governance.md).
