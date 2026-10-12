# NW3 — Canonical staffing, transfers and advisory handoff

**Prerequisite:** NW2 capabilities and accepted NW1 transfer rules.


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


## NW3.1 — Create pure people conversion and controlled fields

**Existing read set:** `src/app/features/nested-work/components/WorkPeoplePicker.tsx`, `WorkRootOwner.tsx`, `WorkTreeEditor.tsx`; shared workspace primitives and Select.

**NEW files under `src/app/features/nested-work/`:**
- `src/app/features/nested-work/selectors/people.ts`: name resolution, ID deduplication, displayed contributors excluding explicit Lead, compatibility worker IDs including Lead.
- `src/app/features/nested-work/components/WorkPeopleSummary.tsx`: explicit labelled Lead and separate Contributors/count.
- `src/app/features/nested-work/components/WorkLeadField.tsx`: editable only with current appointment capability.
- `src/app/features/nested-work/components/WorkContributorsField.tsx`: controlled chips/remove/add-search using eligible project directory.
- `tests/unit/nestedWorkPeople.test.tsx` (test path at repository root).

1. Fields receive explicit Lead ID, selected contributor IDs, current `WorkPerson[]`, fresh capabilities, busy state and controlled callbacks. Fields do not call services or infer roles.
2. Historical people remain named even when ineligible. Only current eligible project people are selectable; the global profile directory is not a replacement pool.
3. Lead is displayed once; contributor count excludes Lead. Conversion retains storage-required Lead in worker arrays.
4. Keep previous Lead contribution during transfer unless explicitly removed; do not silently remove or automatically grant new project membership.

**Tests:** zero/one/many contributors; duplicate IDs; Lead not first; ineligible historical person; missing name; disabled appointment; replacement preserving old contribution; controlled changes do not mutate input arrays.

## NW3.2 — Create the canonical staffing dialog

**NEW:** `src/app/features/nested-work/components/WorkStaffingDialog.tsx`, `tests/unit/nestedWorkStaffing.test.tsx`. **Change:** WorkRootOwner, WorkPeoplePicker composition, WorkTreeEditor staff modes; nested-work public index.

1. Use the fields from NW3.1 in one narrow root/node staffing dialog; reuse `FeatureDialog` focus/close contracts. Read NW6's fixed public composition/controller design before choosing props. Until NW6 implements shared-controller ownership, preserve a narrow standalone compatibility owner; do not claim proposed controller fields already exist.
2. Command map is fixed: changed root Lead → `root_lead`; root contributors only → `contributors`; node people/Lead → `staff`. Do not send Office/project identity fields.
3. Root Lead control requires `appoint_lead`; own node Lead appointment control requires its distinct appointment capability. Contributor editing never unlocks these fields.
4. Preserve revision and stable request identity. Lead transfer gets impact confirmation showing cleared descendant appointments, retained contributors and current review effects; use NW5's authoritative preview once installed. Before NW5 use the existing checked operation and accepted current-state checks, without claiming its eventual stronger impact gate complete.
5. Preserve ProjectInvitations as membership requests, gated by its own accepted capability. Enabled staffing does not alone grant invitation approval/dispatch.
6. Keep WorkRootOwner's existing public fallback/readOnly interface; replace chip presentation with WorkPeopleSummary.
7. Update `hierarchyFixture.snapshot` in `tests/e2e/workspace-refinement-r7.spec.ts` and affected `tests/unit/workspaceRefinementHierarchy.test.tsx` mocks with explicit authoritative root/node capability maps. New editors fail closed if maps are absent; never infer missing maps from old booleans in production.

**Tests:** shared Task Lead can contributors, cannot root transfer; own Subitem Lead can contributors, cannot replace itself; ancestor can change descendant Lead; revoked capability retains values but disables save; cancel zero writes; expired person excluded.

## NW3.3 — Migrate all supported staffing callers

**Change:** `src/app/features/project-table/components/ProjectTaskRow.tsx`; `src/app/features/task-inspector/components/TaskInspector.tsx`, `InspectorTeam.tsx`; `src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx`; inspect `src/app/features/tasks/services/taskTeamService.ts:updateTaskTeamMembers`.

1. Replace supported-project Head-only contributor conditions/messages with NW2 contributor capability.
2. Team actions open the canonical editor/Work section through public exports. Head-only root appointment and Responsible Office remain separately guarded.
3. Route supported TaskTeamEditorDialog work to canonical contributor operations; retain its old workflow for excluded task types.
4. Do not delete `updateTaskTeamMembers` while legacy callers remain. Do not add duplicate client notifications to server-generated R7 assignment events.
5. Confirm caller readOnly/project locks propagate to staffing and nested widgets.

**Affected tests:** taskTeamEditorDialog, taskTeamMembership, workspaceRefinementHierarchy, projectTable and R7 E2E contributor/revocation cases.

## NW3.4 — Make AI selection use the same appointment path

**Read/change:** `src/app/features/staffing/hooks/useStaffingReview.ts:confirm`; `src/app/features/staffing/components/StaffingDialog.tsx`; staffing service/presentation; public nested-work API.

1. Preserve `fetchStaffingContext/recommendStaff/parseStaffRecommendations`, advisory ranking, professional evidence, queue progress and fresh context after confirmation.
2. For supported work, validate selected candidate against both refreshed staffing context and tree eligible-project people, then prefill/enter canonical root Lead appointment.
3. Persist through the canonical checked appointment operation; do not additionally call `assignTask` for the same supported root. Preserve legacy assignTask handling only where supportsNestedWork excludes the task.
4. Retain savedReceipt/version/pending behavior; completed appointment followed by refresh failure must not trigger a second appointment.
5. If candidate is not selected for the project, guide the responsible Head to Members. No automatic membership insertion.

**Tests:** phase15StaffingReview and phase17StaffingSafety, including canceled review, changed candidate, missing selected membership, denied appointment, one save after retry and saved-plus-refresh-failure.

**Checks:** common gates; local `workspace-refinement-r7.spec.ts` and affected staffing tests. **Stop:** implementing a bypass around selected membership, governed staffing or root Head appointment would be required.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/components/ui/FeatureDialog.tsx`
- `src/app/components/ui/select.tsx`
- `src/app/components/ui/workspace/PeopleAvatarStack.tsx`
- `src/app/features/nested-work/components/WorkPeoplePicker.tsx`
- `src/app/features/nested-work/components/WorkRootOwner.tsx`
- `src/app/features/nested-work/components/WorkTreeEditor.tsx`
- `src/app/features/nested-work/index.ts`
- `src/app/features/project-invitations/components/ProjectInvitations.tsx`
- `src/app/features/project-table/components/ProjectTaskRow.tsx`
- `src/app/features/staffing/components/StaffingDialog.tsx`
- `src/app/features/staffing/hooks/useStaffingReview.ts`
- `src/app/features/task-inspector/components/InspectorTeam.tsx`
- `src/app/features/task-inspector/components/TaskInspector.tsx`
- `src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx`
- `src/app/features/tasks/services/taskTeamService.ts`
- `tests/e2e/workspace-refinement-r7.spec.ts`
- `tests/unit/workspaceRefinementHierarchy.test.tsx`
