# NW4 — Own-Lead-first Office review and completion compatibility

**Prerequisite:** NW2; coordinate with completed NW3 appointment/invalidation tasks.


Repository: `C:/Users/james/projects/eflow-e-Governance-Project`. This is a task brief for a later implementation request. The current request creates planning documents only.

## Rules carried into this brief

- Implement only the task ID the user selects. Finish its checks and handoff; do not start another task automatically. Read repository `AGENTS.md` and preserve pre-existing uncommitted work.
- Keep contextual Task/Subitem Leads, recursive children through depth 8, canonical IDs, `lead_id`, `parent_subtask_id`, sibling order, tree revision, evidence and audit history.
- Authority is current, branch-scoped and Office-scoped. Contributors cannot staff/structure. Leads cannot replace themselves. Admin/Viewer access grants no operational power.
- Confirmed Office subitem review: own eligible Lead first, then eligible parent/ancestor Leads, Task Lead and responsible Head; skip the submitter. Keep official root Head review and existing personal independent review.
- New assignments use selected eligible project people and existing approved guest contracts. Preserve financial/evidence/readiness/access-expiry rules. Keep `supportsNestedWork` exclusions and legacy API contracts.
- All full paths below are relative to the repository. Feature shorthand expands under `src/app/features/`; folder-relative names apply to the feature explicitly named in that read/change set. The Existing source locator gives full paths for named existing files. Files marked **NEW** are proposed creations. Locate symbols by search rather than trusting old line numbers.
- Backend corrections go in new CLI-generated migrations. Never edit installed historical migrations, repair live history or push the historical migration folder. No live writes/deployment in NW1–NW10.

## Working and handoff contract

Read only the selected task's source set plus dependencies needed to understand it. First report the requested task, changed-file scope and prerequisite receipts. If prerequisites are missing, inspect their actual outputs; do not pretend they passed or rebuild the entire application.

For each independently completed source slice run `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build` and the specified affected smoke test when configured. Refresh `npm.cmd run graph:update` after structural edits and inspect warnings. Documentation-only tasks need document/link checks, not a redundant application test run.

A focused unit command is diagnostic; it does not replace the full required suite. For local Playwright, set `EFLOW_E2E=1`; the default configuration starts the frontend on 5174 when no `EFLOW_E2E_BASE_URL` is supplied. Missing browser/configuration or skipped cases are open gates. Do not switch local fixtures to hosted data to make them pass.

Conclude with task ID/status, changed files/symbols, behavior preserved/changed, exact commands/results, remaining failures and the next eligible task. Preserve failed receipts. Do not commit, deploy, dispatch invitations or modify accounts unless separately authorized.


## NW4.1 — Correct only supported Office subitem routing

**Read:** effective `eflow_r7.reviewer/pending_reviewer/pending_reviews/snapshot`; `submit_subtask_for_review/decide_subtask_review`; `eflow_evidence.guard_attempt/can_read/can_read_task`; subtask workflow service. Original R7 starts reviewer traversal at `parent_subtask_id`.

**Create/change:** NEW CLI-generated migration named for `nested_work_office_review_routing`; NEW correction SQL runner from NW2 and its explicit migration manifest. Historical migrations/runners stay unchanged.

1. Preserve personal and excluded legacy branches. Only Office R7 subitems start candidate traversal on the submitted item.
2. Candidate is current eligible appointed Lead with valid chain and differs from submitter. Traverse parents, then effective Task Lead, then currently appointed responsible Head. No candidate means clear submission denial.
3. Preserve `resolve_subtask_reviewer` fallback when R7 root is absent.
4. Inspect actual submission/decision/evidence callers; change only effective callers that bypass the shared resolver. Existing adapters already route many operations through it.
5. Pending review uses current authority. Never overwrite previous submission identity, old completed `decided_by`, evidence seals or historical reviewer attribution.
6. Verify evidence reading/signing for the newly selected reviewer with existing scoped checks; do not authorize all managers to read every attachment.

**Exact fixtures:** Andrés root Lead → Gabriel branch Lead → Cheryl child Lead with Juan contributor.
- Juan submits Cheryl's child → Cheryl.
- Cheryl submits own child → Gabriel.
- Cheryl and Gabriel equal submitter → Andrés.
- Own Lead inactive/revoked → first valid higher candidate.
- All independent candidates unavailable → denied.
- Replacement while pending removes old decision authority, selects new valid reviewer.
- Historical approved decision author unchanged; formal seal/read scope preserved.
- Personal reviewer result unchanged; Office root review still Head-controlled.

**Checks:** verify:nw-correction and relevant hierarchy/access/evidence suites plus common gates.

## NW4.2 — Verify completion and UI routing parity

**Read/change only if failing:** `eflow_r7.guard_completion`; parent checks in `command`; existing root readiness/submission functions; `src/app/features/nested-work/selectors/tree.ts:leafCompletion`; `src/app/features/subtasks/services/subtaskWorkflowService.ts`; review inbox tests.

1. Test parent submission/approval with incomplete required descendants at depth 1 and 8, including a descendant hidden by UI collapse.
2. Test all descendants completed but parent's own evidence/review/readiness requirement incomplete.
3. Preserve manually stored root progress; leaf summary counts leaves once. Do not create extra status/cancellation semantics.
4. Verify pending inbox and tree `can_review/current_reviewer` use the new candidate; UI does not compute a different reviewer.
5. Test Lead transfer while pending, self-review denial, cash blockers, ordered sibling independence and due ancestry.
6. If existing behavior already passes, add meaningful regressions and report verification; do not rewrite functioning lifecycle code for cosmetic consistency.

**Done when:** route, queue, decision and evidence agree and completion/manual-progress contracts stay intact.

**Stop:** correcting review would require changing personal workflow, broadening evidence visibility or rewriting historical decisions.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/features/nested-work/selectors/tree.ts`
- `src/app/features/reviews/components/SubtaskReviewInbox.tsx`
- `src/app/features/subtasks/services/subtaskWorkflowService.ts`
- `supabase/migrations/20260816000001_subtask_evidence_review.sql`
- `supabase/migrations/20260817000002_subtask_progress_leader_notifications.sql`
- `supabase/migrations/20260819000004_subtask_execution_dependencies.sql`
- `supabase/migrations/20260831000001_task_evidence_security.sql`
- `supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql`
- `supabase/migrations/20261008060756_r8_approved_project_invitations.sql`
- `supabase/migrations/20261008081855_r9_project_access_lifecycle.sql`
- `supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql`
- `supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql`
- `tests/unit/reviewCashClearance.test.tsx`
- `tests/unit/reviewDecisionError.test.ts`
- `tests/unit/reviewEvidenceDetails.test.ts`
- `tests/unit/reviewRouting.test.ts`
