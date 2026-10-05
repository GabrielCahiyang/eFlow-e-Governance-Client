# Phase 7 — AI Staffing, Readiness, Governance and Hardening

Implemented from Phase 7 of `eFlow_Remaining_Phases_3_to_7_Roadmap.md`, with the user's Monday screenshots, Monday Vibe components and Motion for React as the UI references. Earlier Phase 2–6 work is preserved.

## Delivered workflow

**Projects → Main table → an unassigned task's actions → Recommend staff** opens an Office Head decision dialog. The gateway derives eligibility from the authenticated Head, the task's Responsible Office and project participation. Collaborating Heads can recommend only their selected project personnel; Observers cannot staff work. Only confirmed professional profiles are supplied to AI. Raw PDS files and sensitive personal fields are excluded.

Recommendations consider professional skills, training, education, experience, specialization and current Office workload. Each card quotes confirmed profile entries, shows active tasks, estimated remaining hours and tasks with unknown effort. Rankings are advisory; no invented match percentage or availability is shown. The Head selects a candidate and explicitly confirms the owner through the existing assignment operation. AI never assigns or invites people automatically.

Both the application gateway and the companion's embedded gateway rebuild staffing context from the application's authenticated authority checks. Caller-supplied candidate lists cannot replace the canonical context. The companion retains its existing model loading, FIFO queue, progress reporting and decomposition architecture. Staffing adds a separate output adapter, including constrained generation of each candidate's own confirmed evidence and final output validation.

**Projects → Readiness & closeout** exposes current structure, Office, invitation, responsibility, staffing, date and budget checks. The Lead Head reviews the current structure, dates and budget; activation remains disabled until the database confirms readiness. Existing governed proposal projects retain their endorsement/approval workflow.

Material scope, Office responsibility, schedule, budget, dependency or deliverable changes invalidate relevant reviews and pause active work for re-review. Minor title, priority, ordering and progress edits retain reviews. Direct database writes cannot bypass activation. Closeout requires completed work, approved submissions and existing financial/governance checks. The summary includes tasks, joined Offices, approved submissions, contributors, timeline, estimated budget and cash-request status. Closing records the Head's outcome note and audit event; completed projects can then be archived. Reviewed archives can be restored, while stale or legacy plans return to Planning for review.

## Visual and runtime fixes

- The desktop staffing dialog displays four complete recommendation cards in two columns at 1440 × 1000. On mobile it fills the viewport, scrolls its content and retains visible confirmation/cancel actions. Longer profile notes are expandable.
- Readiness checks use natural height, responsive columns and readable blockers. Vibe provides modal focus handling and buttons; Motion uses the existing animation/reduced-motion infrastructure.
- A malformed onboarding response previously could blank Head, Member and Accounting workspaces. Read/save response validation now rejects malformed records before rendering, with a recoverable Help error. Regression and all-role browser checks pass.
- PDF import passes with actual PDF text extraction. Its browser assertion now permits cold worker startup time.
- A real small-model staffing run initially paraphrased evidence, which was correctly rejected. Candidate-specific generation constraints now preserve confirmed facts; the real queued-model rerun passed.

Screenshots: [desktop staffing](phase7/staffing-desktop.png), [mobile staffing](phase7/staffing-mobile.png), [desktop readiness](phase7/readiness-desktop.png), [mobile readiness](phase7/readiness-mobile.png).

## Main database and runtime

Applied to the **main Supabase project `ixnfphgjyelhckjwjkdv`**:

`20261004194130_phase7_readiness_governance.sql`

The local filename matches Supabase's applied migration ledger. New readiness reviews have RLS enabled; internal helpers live in a private schema. Narrow authenticated operations deliberately use security-definer execution with actor/scope checks. Their generic advisor notices are intentional and do not replace the role-denial tests. Existing financial safeguards, Office independence and canonical Head review remain in force.

Before migration, a fresh full database archive and role definitions were verified, with checksums at `C:\Users\gabri\AppData\Local\eFlow\deployment-backups\20261004T190230Z-phase7-main`. Preflight, post-migration authority checks and migration rollback were rehearsed within transactions. Verification projects, tasks, reviews and submissions were rolled back. No storage objects were changed and no live recipient email was sent. `scripts/phase7-rollback.sql` contains the reviewed rollback procedure; it was rehearsed, not applied permanently.

The local application gateway runs on 8322. The companion private model server and embedded JWT gateway were restarted with the final staffing adapter. Local frontend development runs on 5173/5190; the fresh production build was also verified using a preview on 5191. A real configured Head account was used for live login, navigation and inspecting/cancelling project creation without changing project data.

## Verification

- TypeScript check and fresh production build passed. Existing circular-import and bundle-size warnings remain; the built app passed runtime smoke checks.
- Full frontend suite: **588 tests in 162 files passed**, with four workers and a 15-second test timeout to avoid resource-contention timeouts. After the final onboarding fix, **7 focused tests passed**, including three new malformed-response regressions.
- Full application gateway suite: **48 tests passed**; the final archived-workload filter was also rerun against gateway tests.
- Companion focused regression suite: **50 tests passed** across staffing, gateway, decomposition, FIFO queue, proposal validation, LAYA and optimizer. The final constrained-evidence change passed **8 affected tests**.
- Main-database Phase 7 preflight and post-migration/rollback rehearsal each passed **42 assertions**. Phase 1 static authority verification passed **37 assertions**.
- All **21 distinct browser scenarios across Phases 1–7** passed across the combined run and corrected reruns, including all four canonical roles. Browser workflow records and provider responses are synthetic/intercepted. Phase 7's final desktop/mobile rerun passed all three cases.
- The **built production app passed 7 smoke scenarios** covering all canonical roles, readiness and explicit staffing confirmation.
- A real queued `qwen2.5-coder:1.5b` model request returned grounded eligible recommendations with authoritative workload. It used synthetic professional context and wrote no assignments; it is separate from the intercepted browser checks.
- Client secret verification and whitespace checks passed. Graphify was refreshed incrementally; existing extraction warnings remain, so source remains authoritative.

## Release limits

The hosted frontend/gateways have not been deployed as part of this turn. A fresh full restore into an isolated Supabase-compatible environment remains a release check; archive validation and transaction rollback are not a full restore rehearsal. Full deployed-account/manual acceptance, real invitation delivery/PDS processing and a real-account staffing round trip remain release checks beyond the synthetic browser and rollback-only authority coverage. Phase 7 implementation and local verification are complete; these production closure checks are not claimed complete.
