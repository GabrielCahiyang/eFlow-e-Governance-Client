# Defense revisions implementation plan

Date: 30 September 2026

Status: Application and backend changes implemented and verified locally. The database function migration is prepared and tested but remains unapplied because the configured live database connection rejected authentication. This document retains the initial analysis and records the completed implementation below.

## Confirmed product decisions

- Workload measures estimated task duration plus deadline pressure, using Monday-Friday working days and eight hours of capacity per working day.
- Super admins enter a citywide Plans and Projects overview with department approval tracking. Department heads retain their existing creation and management workflow. Existing permissions remain authoritative.
- Use Approval instead of Sign-off, Approval status instead of Commit Gate, Updates needed instead of Changes requested, and Approve participation for a department's collaboration decision.
- Replace the Delivery tab with Work plan for an unpublished plan and Project tasks after publication. Project workspace tabs use the actual project title; preserve source document titles when available.
- Final business terminology for Add Project remains subject to LEDIPO input. This does not block the other fixes, and no message will be sent to LEDIPO without an instruction from the user.
- While PDF processing is active, keep interaction inside the creation modal and prevent closing, switching modes, or starting another upload. Release the lock on success or a reported failure.
- Deletions and consequential decisions require confirmation that describes the affected record and the consequence.

## Findings from source inspection

### 1. Edited collaboration drafts can lose the approval action

- `interdepartment-collaboration/components/CollaborationActionRail.tsx` renders the request-review action only when status equals `draft`.
- The latest `save_collaboration_revision` definition in `20260928000002_collaboration_role_and_approval_stability.sql` changes an in-review or ready-to-publish proposal to `changes_requested` when material content changes.
- `CollaborationDraftWorkspace.tsx` saves the new version without requesting approval again. The save function records the update and recalculates readiness; it does not issue a new review notification.
- `request_collaboration_review` already updates the requested time, moves the draft into review, and creates notifications. Its repository definition can be used to reopen the cycle without creating a new draft.
- Some action handlers catch errors without propagating them to the calling form. A confirmation may therefore close even when the operation failed. Keep forms open and preserve user input until success is confirmed.

These facts establish a broken handoff in repository code. The applied live database functions still need to be compared with the repository before claiming the production case is reproduced or fixed.

### 2. Super admin landing copy ignores its viewing role

`ProjectsWorkspace.tsx` displays Select or create a work plan and creation instructions even when `readOnly` is true. Hiding the create button does not correct the instructions. The shared workspace already supports citywide scope and department filters.

### 3. An approval matrix exists but can show a stale decision

`project-command/ProjectGovernanceTab.tsx` contains an Inter-Department Endorsement Matrix, but selects an approval by organization without filtering to the current version. Its text can also describe an existing non-approved decision as endorsed and approved. The new matrix must derive decisions from the current version and display each actual decision correctly.

### 4. Workload formulas differ and task duration is dropped

- `tasks/selectors/metrics.ts` primarily counts active tasks.
- `team-management/selectors/teamMemberSelectors.ts` uses weighted task/subtask counts, overdue counts, seven-day deadlines, blockers, and review counts.
- `proposal-import/selectors/candidateWorkload.ts` passes the Team Intelligence signal to AI candidate selection.
- AI decomposition includes `estimatedDuration` and optimizer duration metadata, but `proposal-import/components/draftModel.ts` does not retain task duration.
- Operational tasks already support `estimatedHours` and `estimated_hours`. Preserve duration through draft editing, publication, and reload before changing the visible workload rating.

### 5. AI progress is too coarse and the modal remains dismissible

- Import currently reports extracting/decomposing, queue position, and the current document part.
- The frontend queue adapter exposes queued/processing/completed/failed, with no intermediate processing stages.
- The external backend's `main.py` executes the proposal pipeline; `job_queue.py` owns job snapshots; `proposal_pipeline.py` owns actual breakdown, routing, and assignment stages.
- `CreateWorkPlanDialog.tsx` always allows mode changes and closing. The shared modal adapter forwards every close event.

Updating only the visible spinner or only `main.py` would not provide reliable stage reporting. Wire real progress through all three backend responsibilities and the existing frontend queue adapter.

### 6. First-use guidance already exists

`guided-tours` already offers a role-based welcome and remembers tour progress per user and role in local storage. Extend it with contextual next actions instead of creating a second onboarding system.

## Implementation order

| Slice | Change | Completion evidence |
| --- | --- | --- |
| 1 | Restore edited-draft approval cycle | Request -> edit -> resend -> approve -> publish works, including retry after failure |
| 2 | Login validation and basic terminology | Field errors are clear; active UI labels and walkthrough text agree |
| 3 | Citywide super admin overview and department approval matrix | Correct role landing; current-version decisions and filters; no added approval authority |
| 4 | Task duration preservation and workload calculation | Three one-day tasks due in five working days rate below two one-day tasks due tonight/tomorrow |
| 5 | Real AI processing stages and creation modal lock | Backend stages reach UI; close/mode/navigation guards work; success/failure unlocks |
| 6 | Confirmation coverage and task departments | Cancel has no side effects; task responsibility is visible before and after publication |
| 7 | Contextual next actions and UI explanation audit | Role-appropriate guidance; reasons for blocked actions; desktop/mobile verification |

Each slice should remain independently reviewable. Do not combine these requested behavior changes with unrelated module moves.

## Slice 1: Reliable collaboration resubmission

1. Add focused selectors for whether an owner can send or resend approval requests. Cover an initial draft, updates-needed state, and a previously submitted draft whose current version needs renewed decisions.
2. Keep a visible Send approval requests / Resend approval requests action for recoverable proposals. Never expose it for a published, archived, deleted, or unauthorized proposal.
3. When material edits are saved to a previously submitted proposal, offer a confirmation such as Save changes and resend approval requests. Explain that departments must review the updated plan.
4. Save the latest edited snapshot first, then request review of that version. Autosave must not repeatedly notify departments.
5. If saving succeeds but sending fails, retain the saved update and show Changes saved. Approval requests could not be sent. Provide an explicit retry action.
6. Preserve the existing rule that editorial edits can carry valid approvals forward. Material edits must not silently reuse stale approvals. Verify duration and deadline changes are classified appropriately because they affect departments' commitments.
7. Use the existing participant and approval-policy rules. Preserve governance reviewers, observers, sequence, backup approvers, and quorum behavior.
8. Disable duplicate submissions while a request is active. Verify retry notification behavior; if the existing RPC needs a narrowly scoped idempotency fix, preserve its signature, security checks, and return contract.
9. Recover existing stuck proposals through the same resend action; no destructive recreation is required.

Acceptance cases: initial request, partial approval then edit, request for updates then edit, scope change, staffing change, deadline/duration change, editorial-only change, repeated send, service failure, reload, and final publication. Old decisions remain available as history and cannot count toward a materially changed current plan.

## Slice 2: Clear validation and naming

### Login

- Replace Invalid email or password. Please verify your credentials. with Email or password is incorrect.
- Required email: Enter your email address. Invalid format: Enter a valid email address. Required password: Enter your password.
- Use the same validation on blur and submit; do not report every backend failure as a credential error.
- Distinguish connectivity, service failure, unconfirmed email, and retry cooldown when the authentication response actually identifies them.
- Keep field errors near the field and expose them accessibly. Preserve authentication and existing cooldown behavior.

### UI terminology

| Current wording | Replacement |
| --- | --- |
| Sign-off / Sign off / Signoff | Approval / Approve, according to sentence context |
| Waiting for sign-off | Waiting for approval |
| Commit Gate | Approval status |
| Commit blocked | Approval requirements not complete |
| Approve current revision | Approve participation |
| Changes requested | Updates needed |
| Publish scope revision | Save department changes |
| Publish staffing revision | Save team changes |
| Delivery tab | Work plan before publication; Project tasks after publication |
| Revision history | Plan update history |
| One Of | One authorized approver required |
| Quorum | Required number of approvals, with the number shown |

Explain approval as agreeing to the department's participation in the displayed plan. Explain publication as creating the active projects, tasks, and assignments. Maintain distinct meanings for department participation, completed-work approval, financial approval, and formal governance decisions even when their labels use simpler language.

Change presentation text, accessible names, notifications where applicable, tours, and matching tests. Keep database status codes, RPC names, stable tab identifiers, persisted view keys, and audit identifiers intact.

## Slice 3: Super admin overview and approval matrix

- Show a citywide overview with active projects, draft plans, pending department approvals, and plans needing updates, derived from already authorized data.
- Provide department and project filters and links to the relevant project/plan. Replace creation prompts with instructions to choose a department or view a plan.
- Include a clearly visible Department approvals table in Plans and Projects and the selected plan's approval workspace.
- Columns: plan/project, department or office, participation role, required approval rule, status, requested date, decision-maker, decision date, and comments or required updates.
- Statuses distinguish Not requested, Waiting for approval, Approved, Updates needed, Declined, and Approval not required.
- Count current-version approvals only; identify decisions carried forward after editorial edits. Keep old decisions in history.
- Show the owner as Lead department and observers as Approval not required. Do not invent a named approval for either.
- Reuse one selector for matrix rows, counts, and blockers. Verify the existing backend readiness remains the authoritative publication gate, including sequence and quorum.
- Super admin oversight must not acquire department approval powers through this UI change. Department, task leader, employee, and specialist-role visibility must retain their current boundaries.

## Slice 4: Duration and deadline workload

### Preserve the input

- Normalize explicit AI hours/days and optimizer duration values; one task day equals eight work hours. Let users review and correct the estimate in both creation modes and task editing.
- Carry duration through AI result -> draft task -> collaboration snapshot -> published task's existing estimated_hours -> task mapper -> reload. Verify every path, including manual creation.
- Do not infer effort from the entire calendar span of an activity: a month-long activity does not automatically require twenty full days of work.
- Missing or ambiguous duration stays visible as Estimate needed. Missing deadlines stay visible as Deadline needed. Neither should silently produce a reassuring low-workload result.

### Calculation proposal

- Build one pure workload calculation in the tasks feature and export its public API for Team Intelligence, task boards, project views, HRMO summaries, and AI candidate selection.
- Use remaining estimated work where trustworthy progress is available; retain the full estimate otherwise.
- Evaluate both the next five working days and each approaching deadline window. Compare cumulative work due in the window with the eight-hour weekday capacity available before that deadline.
- Use the highest pressure across those windows, so near deadlines cannot be diluted by later free days. Separately expose overdue work and missing estimates.
- Initial category thresholds: Light below 50% capacity, Moderate 50% to below 85%, High 85% through 100%, Very high above 100%. Validate these against representative local workloads before finalizing.
- Example with comparable one-day tasks: three tasks due after five working days require 24/40 hours and rate Moderate; two one-day tasks due tonight/tomorrow exceed the available capacity and rate Very high.
- Parse actual timestamps in Asia/Manila; date-only deadlines use the existing agreed end-of-day convention. Never turn a timestamp into an earlier midnight deadline.
- Exclude completed, cancelled, archived, and unpublished tasks from operational workload. Pending-review work and reviewing duties must be identified separately instead of counted as full remaining execution effort.
- Account for shared assignments without counting the same task and its delegated subtasks twice. Do not assume every team member does the full task effort or has an equal share when actual assignment data says otherwise.
- Show a short explanation, e.g. 16 hours of work due before tomorrow; 8 working hours available, alongside the rating.
- Keep the 0-100 AI input range through a documented adapter while displaying real capacity pressure separately; use the same workload facts in warnings and recommendations.

Working-day calculation initially follows the confirmed weekday/eight-hour rule. Do not invent a holiday calendar, leave records, or individual working schedules that the existing system does not provide.

## Slice 5: AI progress and modal locking

Backend project: `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration/server/`.

Real visible stages:

1. Reading your PDF.
2. Checking the proposal content.
3. Waiting for the AI, showing queue position when applicable.
4. Breaking section X of Y into tasks.
5. Checking departments and approval requirements.
6. Suggesting team assignments and task schedules.
7. Checking the generated plan.
8. Saving your draft.
9. Your work plan is ready to review.

- Add actual stage callbacks in proposal_pipeline.py, integrate them in main.py, retain them in the owner-scoped job_queue.py snapshot, and expose optional progress metadata through the existing frontend AI gateway.
- Keep existing request formats, queue states, authentication, FIFO behavior, result shape, and routes compatible. Older clients ignore the optional fields; newer clients can fall back to coarse status on an older server.
- Show the current step, completed steps, section count, elapsed wait, and concise status text. Do not display fabricated percentages or disclose model reasoning. Keep JSON conversion terminology out of the normal flow; Checking the generated plan communicates its purpose.
- Lift active-processing state to CreateWorkPlanDialog. Block close button, Escape, backdrop dismissal, mode switching, background interactions, duplicate upload, and in-app navigation while processing.
- Preserve focus trapping and access to the status region. Clearly state Please keep this window open while we prepare your work plan.
- Browser refresh/tab closing can only be guarded with the browser's standard warning; do not promise an absolute browser lock. Where a queued job can be resumed, retain its identifier safely and resume polling rather than enqueueing duplicate work.
- On queue/service failure or timeout, show whether the remote job is still active, offer a recoverable retry/reconnect path, and release the modal lock. A failed request must not permanently trap the user.
- Do not mark the import complete until the draft and source document are saved successfully.

The external backend already has uncommitted edits in .env.example, public_gateway.py, pygad_optimizer.py, start.py, and test_pygad_optimizer.py. Preserve them and inspect any overlap before editing.

## Slice 6: Confirmation and department labels

- Audit deletion/removal of drafts, tasks, subtasks, attachments, participating offices, team members, and manual-plan hierarchy items.
- Audit publish, approval/decline, cancellation, reopening, archiving, assignment changes, and consequential financial decisions reachable through the existing workflows.
- Reuse existing confirmation flows where they already work. Add a reusable accessible confirmation control only where a gap exists; do not stack two confirmations on the same operation.
- Show the record name, what will happen, and any approval/assignment consequences. Provide explicit Cancel and action buttons, keep existing mandatory reasons, and disable repeated confirmation while saving.
- Cancel must make no mutation or service call. Keep failed actions open with their error and existing input.
- Task list rows, kanban cards, hierarchy rows, task details, manual creation, and imported draft task rows show the responsible department. Supporting departments appear separately when present.
- Prefer task responsibility and activity inheritance over the lead employee's home department. Resolve organization identifiers to names; show Department not set when no valid responsibility is known.
- Do not reassign a task's department merely because its team leader belongs to another office. Preserve existing staffing eligibility and approval scope.

## Slice 7: Next-step suggestions and UI explanation audit

- Add useful next actions to the existing guided-tour feature and workspace empty states. Remember dismissal/completion with the existing user/role progress mechanism.
- Super admin: select a department, inspect plans, review pending department decisions.
- Department head: create/import a plan, review tasks and departments, send approval requests, then publish after approval requirements are met.
- Participating department: open the invitation, inspect requested responsibilities, confirm participation or request updates.
- Team leader/employee: open assigned work, check the deadline, update progress, attach evidence, and submit work through the existing review route.
- Choose suggestions from role, permissions, and current data. Existing users should not repeatedly receive first-use prompts.
- Audit every affected visible screen for field labels, required/optional indications, explanatory text, accessible icon names, action consequences, specific validation, empty/loading/error/success states, and disabled-action reasons.
- Keep explanations concise and relevant to the user's action. A source document title identifies the project; Work plan, Tasks, Team, and Approvals describe what a tab does.
- Finish with a role-by-role walkthrough and screenshots of desktop and mobile affected views.

## Verification and compatibility

- Use focused behavioral and pure-logic tests for each changed interaction. Existing source-string assertions alone are insufficient for the approval lifecycle and progress locking.
- Required frontend checks after every complete slice: npm run check, npm test, npm run build.
- Run affected Playwright smoke tests when EFLOW_E2E and test accounts are configured. Validate login, super admin navigation, department creation, participant approval, and edited-plan resubmission. Report missing live-test configuration explicitly.
- Add backend queue/progress tests using the existing unittest setup; cover real stage progression, FIFO, owner isolation, success, failure, and unchanged legacy result formats.
- Inspect applied database definitions read-only before changing any RPC implementation. Prefer existing RPCs. Any required function migration must be narrowly tied to an authorized behavior fix, preserve security and signatures, and be reviewed separately from structural extraction.
- Avoid schema changes, RLS changes, new endpoints, permission expansion, destructive cleanup, or unrelated file moves for these revisions.
- Keep new application code within the relevant feature directories; cross-feature imports use each feature's public index.ts. Domain-neutral confirmation UI belongs in components/ui.
- Keep an acceptance checklist per slice and record actual verification results. Planning does not constitute a tested or deployed fix.

## Remaining decisions

No blocking product questions remain for the implementation slices. LEDIPO's final preferred business label for Add Project remains an external naming decision. The workload thresholds are an initial implementation proposal to be calibrated against real examples, while the duration/deadline basis and weekday capacity rule are confirmed.


## Implementation and verification record

Completed on 30 September 2026:

- Restored send/resend actions for submitted plans and plans needing updates. Material owner edits save before requesting approval again. Publication requires confirmation; failed actions retain their form and explain how to retry. A temporary refresh failure keeps the current workspace accessible with Retry loading.
- Added clear login field validation and concise authentication errors. Active approval labels use Approval, Approval status, Updates needed, and Approve participation. The Delivery tab is now Work plan before publication and Project tasks after publication. Source project titles remain intact; selected tabs now follow the opened view.
- Added a citywide super admin landing with department filters, project links, counts, and department approval tables. Department heads retain creation. Current-version approval selectors distinguish owners, observers, approved decisions, declined decisions, pending requests, and updates needed. Existing access rules remain authoritative.
- Retained estimated task hours from PDF decomposition and draft editing, added task-day estimates and optional Philippine due times, and rejected invalid provided estimates. The prepared publication function preserves estimated hours and exact due times in active tasks.
- Used one duration/deadline calculation across team supervision, employee workload, task boards, department and citywide dashboards, HRMO workload views, assignment choices, and private AI candidate scoring. Weekdays provide eight working hours. Remaining effort accounts for task progress and shared team assignments. Missing estimates/deadlines are reported instead of being replaced with task counts. Work awaiting review no longer consumes estimated remaining task work.
- Updated the external main.py, job_queue.py, and proposal_pipeline.py to report actual preparation, document breakdown, structure checking, department checking, assignment, and final checking stages. Queue snapshots retain owner isolation and their existing results. The frontend shows stages, elapsed time, queue information, and section progress. The creation modal blocks closing, mode changes, and in-app navigation while preparing the plan, then releases its guards on completion or error. Browser refresh/closing uses the standard browser warning.
- Added confirmations for previously unguarded draft task, department, team-member, and attachment removal, and consequential plan and governance actions. Existing confirmation and mandatory-reason flows remain in place.
- Added responsible and supporting department labels to task rows, boards, task details, creation drafts, and read-only plans. First-use suggestions use the existing role-specific walkthrough and stored dismissal state.

Verification:

| Check | Result |
| --- | --- |
| npm run check | Passed |
| npm test -- --maxWorkers=2 | 149 files / 508 tests passed in the complete run |
| Final affected tests after the last validation edits | 7 files / 30 tests passed |
| npm run build | Passed; existing large-chunk advisory remains |
| npm run verify:client-secrets | Passed |
| Login browser smoke tests | Passed at 320, 375, 768, and 1024 pixels, plus animated preview behavior |
| Super admin mobile smoke | Passed: user dialog, citywide plan tracking, and absence of work-plan creation |
| Department-head mobile smoke | Passed: work-plan modal, usable input width, PDF import mode, and closing |
| Disposable PostgreSQL regression | Passed: migration compilation/repeatability, edit/resend lifecycle, invalidated vs carried approvals, rapid-repeat suppression, permissions, terminal guards, and publication duration/time preservation |
| eFlow Python tests | 8 tests passed |
| External AI queue and proposal-validation tests | 6 tests passed; main.py, job_queue.py, and proposal_pipeline.py compile |

One disposable database startup timed out while the build and frontend tests ran concurrently. Its retry passed. The test harness uses only a random localhost port and never reads a live database connection.

### Remaining live setup

The migration is supabase/migrations/20260930000001_defense_revision_approval_and_duration.sql. It replaces four existing functions without adding tables, columns, RLS policies, routes, or function signatures. It has not been applied to the live database. A read-only attempt to inspect applied definitions failed password authentication through EFLOW_DATABASE_URL. Correct the connection locally, inspect the applied definitions for compatibility, then apply and verify the migration. A request for the connection to be corrected or the migration to be left for manual application is pending.

The external AI server must load the edited Python modules on its next start/restart before actual processing stages appear. A live model decomposition and a live edit/resend/approval/publication cycle were not run against real records. Automated tests cover those behaviors without creating production notifications or assignments. The full all-destination authenticated Playwright suite still requires EFLOW_E2E_ACCOUNTS; the configured development UI shortcuts were used for the affected role smoke tests.

LEDIPO's final preferred business label for Add Project is still open. The requested Delivery tab change is implemented and does not depend on that naming decision. No message was sent to LEDIPO.
