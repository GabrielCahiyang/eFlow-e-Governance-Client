# NW8 — Canonical Subitem Inspector and review detail

**Prerequisite:** NW4–NW6; align section/origin contracts with NW7. Implement the scoped Activity shell here; final shared event presentation is explicitly deferred to NW9.6 and must close before NW10.


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


## NW8.1 — Introduce branch context without replacing workflow APIs

**Existing:** `src/app/features/subtasks/components/SubtaskWorkDrawer.tsx`, TaskSubtasksWidget; services/subtaskWorkflowService; public subtasks index.
**NEW:** `src/app/features/subtasks/components/SubitemInspector.tsx`, `src/app/features/subtasks/components/SubitemContext.tsx`, `src/app/features/subtasks/components/SubitemChildWork.tsx`; `src/app/features/subtasks/hooks/useSubitemInspectorData.ts`; `tests/unit/subitemInspector.test.tsx`.

1. Inspector inputs identify root task, item ID, fresh authorized node/tree, caller readOnly, current reviewer, prerequisite, origin/focus and close/changed callbacks.
2. Load data scoped to actor/root/item; ignore late results after switching. Failure is explicit, not a blank writable inspector.
3. Display title/status, explicit Lead/contributors, actual parent/children, full permitted path, item due date, execution mode and progress.
4. Names come from authorized tree/member directory, not only root team arrays.
5. Use shared child hierarchy and controls, not a second branch renderer.
6. Keep SubtaskWorkDrawer public export as a compatibility facade. Supported R7 work uses canonical inspector; legacy excluded work retains its existing component/flow.

**Tests:** deep-only name/path, duplicate titles, depth8 parent navigation, late read after item switch, missing/denied parent context.

## NW8.2 — Separate execute, manage, review and budget controls

**Reuse:** SubtaskProgressForm, SubtaskProgressHistory, SubtaskSubmissionHistory, SubtaskDeadlineEditor, SubtaskReviewerBadge, SubtaskEvidenceLink and WorkBudgetCard.

1. Node own Lead sees current own execution plus authorized Manage branch; contributor sees Execute assigned work only.
2. Current reviewer gets review capability independently. Do not use `can_review` to make readOnly false for progress or funding.
3. Remove supported Inspector shortcuts such as `canManageDeadline || !readOnly` for budget management. Pass independently verified budget capability; use existing budget authority contract, not branch management. Add `src/app/features/budget/components/WorkBudgetCard.tsx` to changed scope: its current cash-request predicate ignores `canManage`. Add a separate optional caller `readOnly` prop (default preserves old callers), and gate both cash-request and cap controls on caller readOnly/current-authority-pending state in addition to their existing distinct budget predicates. Update supported Inspector callers; keep server checks and current request-versus-cap rights.
4. Keep prerequisite sibling sequencing, status locks, progress/submission semantics, file validation, evidence seal/link services and historical authorship.
5. Replace supported UI Standalone/Ordered step/Team Leader copy with accepted labels. Internal legacy identifiers remain.

**Tests:** review capability alone cannot unlock progress/staff/budget; independently granted valid capabilities still work; archived/revoked/history-only viewers cannot request cash even when an old assignment predicate matches; contributor cannot manage; eligible Lead-only execution from NW2; sibling Lead denial; expired actor; formal evidence access denial; known budget behavior preserved.

## NW8.3 — Share review detail composition while retaining inbox logic

**Existing:** `src/app/features/reviews/components/SubtaskReviewInbox.tsx`; `src/app/features/subtasks/types.ts`; subtaskWorkflowService `fetchPendingSubtaskReviews/decideSubtaskReview/getSubtaskEvidenceUrl`.
**NEW:** `src/app/features/reviews/components/SubitemReviewDetail.tsx`; `tests/unit/subitemReviewDetail.test.tsx`.

1. Extract only presentation: submitted by, authorized path/parent, progress, note/evidence, historical decision author, feedback/pending state and approve/request-change callbacks.
2. Keep Inbox subscriptions, filtering/selection and notification focus, current eligible reviewer and existing mutation methods in their current owner.
3. Inspector and Inbox both use the extracted composition via reviews public index.
4. Show server-selected current reviewer and historical actual reviewer distinctly; UI never computes or overrides own-Lead-first chain.
5. Preserve dirty feedback/navigation, signed evidence reads and failed decision retention. Review changes cannot unmount/erase feedback without explicit outcome handling.

## NW8.4 — Wire all entrances and test compatibility

**Change callers:** TaskSubtasksWidget, project-table openSubitem, personal-work WorkInspector, review/notification focused-ID paths through public APIs.

1. Canonical ID opens the same item/section from Main Table, Work, My Work and review.
2. Return focus to the actual opener and preserve selected deep item, prerequisite and work path.
3. Legacy callers to SubtaskWorkDrawer keep valid props and supported behavior.
4. Test mobile sizes/dark theme, dirty close/Escape, revoked access, historical evidence, changed reviewer and no root rights for a deep assignee.
5. Include a Subitem Activity section for permitted work-command events, alongside progress/submission history. Extend `WorkActivity` with optional focused node identity, preserving root-only callers; filter using event node IDs and authorized before/after descendant context, including moved/deleted items. Use NW9.6's shared presenter when completed. Never expose unrelated root-wide events to a restricted deep assignee. Track this section as pending until NW9.6 supplies final readable event presentation; NW8 shell completion alone is not full Inspector acceptance.

**Affected tests:** phase12SubtaskScope, phase13SubtaskDrafts, subtaskReviewerBadge, new Inspector/review tests and relevant R7/R10/My Work E2E.

**Stop:** NW4 route is not installed in local fixture or canonical inspector would weaken evidence/financial/personal rules.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/components/workflow/TaskSubtasksWidget.tsx`
- `src/app/features/budget/components/WorkBudgetCard.tsx`
- `src/app/features/nested-work/components/WorkActivity.tsx`
- `src/app/features/nested-work/index.ts`
- `src/app/features/personal-work/components/WorkInspector.tsx`
- `src/app/features/reviews/components/SubtaskReviewInbox.tsx`
- `src/app/features/reviews/index.ts`
- `src/app/features/subtasks/components/SubtaskDeadlineEditor.tsx`
- `src/app/features/subtasks/components/SubtaskEvidenceLink.tsx`
- `src/app/features/subtasks/components/SubtaskProgressForm.tsx`
- `src/app/features/subtasks/components/SubtaskProgressHistory.tsx`
- `src/app/features/subtasks/components/SubtaskReviewerBadge.tsx`
- `src/app/features/subtasks/components/SubtaskSubmissionHistory.tsx`
- `src/app/features/subtasks/components/SubtaskWorkDrawer.tsx`
- `src/app/features/subtasks/components/TaskSubtasksWidget.tsx`
- `src/app/features/subtasks/index.ts`
- `src/app/features/subtasks/services/subtaskWorkflowService.ts`
- `src/app/features/subtasks/types.ts`
