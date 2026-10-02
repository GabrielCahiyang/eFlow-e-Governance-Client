# Project Cost, Item Maintenance, and Organisation Implementation Plan

Date: 3 October 2026 (Asia/Singapore)

Status: Phase 1 remains implemented. Phase 2 application changes have been reverted at the user's request. A read-only check confirmed Phases 1 and 2 were applied to the connected database; the Phase 2 rollback SQL is prepared for the user to run and has not been applied by this agent. See `Phase 2 Rollback Review.md` for rollback SQL and the restored navigation. Phases 3-9 have not started. The original Phase 2 migrations remain as deployment history, followed by the new reversal migration.

## Confirmed requirements

This plan incorporates the user's clarification answers. The work is a requested functional change and must be kept separate from unrelated modularisation.

| Area | Confirmed behaviour |
| --- | --- |
| Administrative access | Replace Super Admin with one Admin Item. Existing Admin and Super Admin accounts both receive the former Super Admin privileges, including managing Items, permissions, and higher-level accounts. |
| Items | An Item represents a system access role. It contains Title and Role as manually entered text, and Employee Status selected from its maintenance catalogue. Each Item has its own configurable permissions. |
| Employee Status | Provide maintenance with initial examples Job Order, Casual, and Regular/Permanent. This is separate from account activation/deactivation. |
| Maintenance authority | Admin alone maintains Items, Employee Statuses, and Expense Accounts. |
| User creation | Admin can create a user directly in the selected higher-level Item. The user must not first be created as Employee and then promoted. |
| Organisation | Enforce Department -> Division -> Section -> Unit without skipping levels. Remove active boards and committees and the legislative committee pages. |
| Retired governance | Pending and future board/committee approvals move to the responsible Department Head. Historical decisions and attachments remain accessible. |
| Expense Accounts | Add a new catalogue, separate from the accounting chart, with Account Name, Account Code, and optional reusable generic particular names. |
| Project costs | Enter project cost components before the work plan. A project may have multiple account groups, each with its own particulars. Each component has Particular, Details, and Cost. |
| Particular entry | Select an account before entering particulars. Its reusable names are selectable, and custom particular names remain allowed. Reusable names do not supply default details or prices. |
| Allocation | A component can be split across several activities/tasks. The entire project cost must be allocated before publication. |
| Annual budget | Maintain one annual budget per department per fiscal year. Draft creation and import remain available before setup; publication requires the annual budget. Annual budget data is excluded from project/proposal imports. |
| Budget corrections | Accounting Officer requests -> Department Head approves. A Department Head's own correction request -> Assistant Head approves. Record requests, decisions, before/after amounts, reasons, actors, and timestamps. |
| Program editing | Edit only the current draft program during project creation. Editing must not update a shared program used by other projects. |
| Activity timeline | An explicit activity timeline takes precedence. Without one, derive the earliest task start and latest task end. Task 1 on 1-3 September and Task 2 on 2-4 September produce an activity range of 1-4 September. |

## Final terminology

| Current label/surface | Required label/behaviour |
| --- | --- |
| Create Proposal | Create Project |
| Task Budget | Cost Component |
| Department Budget inside the project form | Budget Requirement |
| Standalone Department Budget page and its navigation label | Department Annual Budget |
| Role selector and role-management terminology | Item; use Item Permissions for the permission-maintenance surface |
| Role field inside Item maintenance | Keep the field named Role; it is manually entered text |
| Super Admin | Admin |
| Funding account selector in project creation | Fund account source, placed before the Particular table for every account group |
| Task funding status and the adjacent amount/status row | Remove that row; display component and project totals in their cost summaries |

Update relevant buttons, headings, tooltips, accessible labels, dialogs, confirmations, walkthroughs, and reports together. Existing URLs need compatibility aliases where labels currently double as route values.

## Repository findings and affected entry points

These findings are from local source inspection, not verification of the currently deployed database.

| Feature | Current entry points and findings | Implementation implication |
| --- | --- | --- |
| Creation and import | Plans & Projects opens `proposal-import/components/CreateWorkPlanDialog.tsx`, `ManualPlanBuilder.tsx`, and `ProposalImport.tsx`. Their controllers assemble task-derived drafts. | Project cost entry before tasks requires independently persistable project and cost records in the draft model. Moving the current task editor above the work plan is insufficient. |
| Draft hierarchy | `proposal-import/components/draftModel.ts` derives hierarchy identifiers from titles; `services/manualPlanDraft.ts` renames programs and updates activity schedules. | Use stable identifiers so program/title edits do not detach costs, assignments, or allocation references. |
| Budget authoring | `budget/components/TaskBudgetEditor.tsx` fixes the fund source to the proposal owner's department. `budget/selectors/budgetSelectors.ts` builds the proposal total from task budgets. | Introduce project-owned components and an allocation layer; retain compatible task funding outputs for existing cash workflows. |
| Annual budget | `budget/components/AnnualBudgetSetup.tsx` and `DepartmentBudgetWorkspace.tsx` provide setup, locking, and fiscal controls. The annual-budget table already has a unique department/year constraint. | Reuse the annual record and locking rules; add the requested approval workflow for corrections rather than creating another annual-budget store. |
| Corrections | `budget/components/LockedBudgetControls.tsx` currently calls the adjustment operation directly. The adjustment RPC writes audit and ledger entries. | A request and separate approval must precede posting the adjustment. A legacy direct call must not bypass this rule. |
| Accounts | `accounting_accounts` already exists for journal posting. No requested expense/fund-source catalogue was found in the inspected feature files. | Add the separate catalogue; selecting Petty Cash must not silently change journal-account mapping or create another appropriation. |
| Items and permissions | `permissions/constants.ts`, `selectors.ts`, `RoleDefaultsTab.tsx`, AuthContext, navigation, gateway guards, and SQL contain fixed role keys and special Super Admin handling. | Dynamic Items require client, server, and database enforcement changes; a free-text dropdown alone will not work. |
| Higher-level users | `administration/components/user-management/CreateUserModal.tsx` creates a leadership account as Employee and then assigns leadership. `server/routers/admin.py` validates a fixed role list. | Create the selected Item and any required organisation leadership assignment as one completed operation, with compensation if Auth creation succeeds but database finalisation fails. |
| Organisation | `organization/components/org-tree/OrgModal.tsx` offers all organisation types and defaults any child to Division. | Restrict child types and parent choices by level; apply the same rules to services, SQL, tree operations, and imported data. |
| Governance | Collaboration organisation eligibility, governance routing, reviewer memberships, records, closeout, and SQL publication checks use boards/committees. | Retire them through a migration of active review responsibility; preserve historical references and evidence. |
| Legislative pages | Legislative navigation and content contain Committee Affairs and committee-related destinations. | Remove these destinations and their active callers, then retain an accessible archive for historical records. |

Primary implementation locations are `src/app/features/administration`, `permissions`, `organization`, `budget`, `projects`, `proposal-import`, `interdepartment-collaboration`, and `navigation`, plus AuthContext, shared role helpers, gateway authorisation, and new Supabase migrations.

## Delivery rules

1. Implement each phase in small vertical slices. Each slice must have working enforcement, UI, and appropriate regression coverage before moving on.
2. Follow AGENTS.md: put new application work under feature directories, use small public `index.ts` APIs, and import other features through their public APIs. Keep unrelated moves out of these changes.
3. The schema, RLS, and authorisation changes below implement the explicitly requested behaviour. They must be recorded in new dated migrations; do not rewrite old migration history as a refactor.
4. Preserve public service return values, backend route names, and existing external AI request/response contracts. Add compatible adapters or separate operations for new capabilities.
5. Inventory consumers before replacing a legacy role key, snapshot field, route label, or funding representation. Remove compatibility code only after repository search proves no consumers remain.
6. Preserve project/task assignment, review, cash release, liquidation, journal, reporting, and audit behaviour except for the changes expressly confirmed above.
7. Treat Item labels, employment status, and account names as data. Privilege must come from trusted Item identity, permissions, organisation scope, and reviewer assignment.

## Proposed data additions

Exact SQL names may be adjusted during implementation to fit existing conventions. Keep one authoritative store for each rule.

| Entity | Essential data and constraints |
| --- | --- |
| Employee Status catalogue | Stable id, name, normalised unique name, active flag, creator/updater, timestamps. |
| Access Items | Stable id and immutable permission key, free-text Title, free-text Role, Employee Status reference, active flag, protected Admin identity, audit metadata. Display-name changes do not change permission identity. |
| Item permissions and user assignment | Reuse the existing permission catalogue and `role_permissions` storage where compatible, linked through stable Item keys. Add a user-to-Item reference and a migration bridge for the legacy role field. Preserve individual overrides for non-Admin users. |
| Expense Accounts | Stable id, Account Name, unique normalised Account Code, active flag, audit metadata. |
| Generic particulars | Stable id, Expense Account reference, name, position, active flag. No default details or cost. |
| Project draft cost groups | Stable project id and group id, selected Expense Account id, ordering. A project may have several groups. |
| Project cost components | Stable component id and group reference, particular name, details, decimal cost, optional generic-particular reference, ordering. Persist historical account/particular identity with an approved revision. |
| Component allocations | Component reference, stable activity/task target, allocated amount, parent-distribution reference where applicable, revision and audit metadata. Enforce target ownership and conservation of money. |
| Work-plan dates | Explicit task start/end and optional explicit activity start/end, with a distinction between entered and derived activity dates. Retain existing due-date/schedule compatibility fields. |
| Annual-budget correction requests | Budget id, department/year, before amount/version, proposed amount, reason, supporting-file reference, requester, routed reviewer, state, decisions, timestamps, and resulting posted adjustment id. |
| Retirement/migration mapping | Original organisation/role identities, replacement identities, original review route, replacement department/reviewer, actor, timestamp, and reason. Historical records retain their original context. |

Referenced Items, statuses, accounts, and particulars should be retired rather than destructively deleted. Allow permanent deletion for genuinely unreferenced catalogue entries. Require reassignment before retiring an Item still assigned to active users. Protect the last active Admin account.

## Phase order

| Phase | Deliverable | Dependencies |
| --- | --- | --- |
| 0 | Baseline and migration inventory | None |
| 1 | Unified Admin identity and privileges | 0 |
| 2 | Employee Status, dynamic Items, and direct user creation | 1 |
| 3 | Strict organisation hierarchy and board/committee retirement | 1-2 |
| 4 | Expense Accounts and generic-particular maintenance | 1-2 |
| 5 | Department Annual Budget and approved corrections | 1-3 |
| 6 | Project-first cost builder and current-program editing | 2-4 |
| 7 | Work-plan timelines and component allocation | 3, 6 |
| 8 | Import, review, and publication integration | 5-7 |
| 9 | Migration rehearsal, end-to-end acceptance, and rollout | 1-8 |

### Phase 0 - Establish the baseline

Deliverables:

- Record current navigation entries, callers, permissions, public DTOs, and publication/cash workflow contracts for affected features.
- Run the baseline checks and record pre-existing failures separately from this work.
- Inspect the target database's applied migrations and definitions before drafting deployment mappings. Local migration files alone do not establish deployed behaviour.
- Produce counts and mappings for existing Admin/Super Admin users, legacy roles, employee-status data, skipped organisation levels, boards/committees, active governance routes, open corrections, draft snapshots, and approved funding records.
- Identify draft versus committed records so draft adaptation cannot rewrite historical approvals or actual spending.

Exit criteria: the affected surface inventory and migration report are available, every legacy consumer is identified, and baseline verification results are recorded.

### Phase 1 - Replace Super Admin with Admin

Slices:

1. Update shared authorisation predicates and gateway/database guards so Admin receives the former Super Admin administrative authority across all affected operations.
2. Migrate both existing Admin and Super Admin profiles to the unified Admin identity. Preserve user ids, credentials, organisation links, activity, and audit references. Archive the previous role/override state for migration traceability and recovery.
3. Update login/profile mapping, navigation, account selectors, maintenance access, permission management, and visible labels. Existing stale sessions must refresh their profile/permissions.

Admin-only catalogue maintenance must be enforced in the database and gateway as well as the UI. Naming a custom Item "Admin" must not grant protected Admin identity. Existing Admin restrictions that conflict with the approved privilege consolidation are intentionally replaced.

Keep operational review responsibilities tied to the correct organisation/reviewer and preserve self-approval restrictions. Administrative privilege does not silently replace the selected financial or task approver.

Acceptance criteria:

- Both former account categories can log in as Admin and manage higher-level users, Items, permissions, and maintenance catalogues.
- No active selectable Super Admin role or visible Super Admin label remains.
- Non-Admin users cannot modify the Admin Item, protected management permissions, or Admin-only catalogues through direct API/Supabase calls.
- The last active Admin cannot be deleted, deactivated, or reassigned out of Admin.

Verification: permission and navigation regressions, gateway/database authorisation tests, and migration rehearsal using both legacy administrative account categories. Preserve old migration-file tests; add tests of the effective new migration behaviour.

### Phase 2 - Employee Status, Items, and higher-level user creation

Slices:

1. Employee Status maintenance: Admin CRUD, search, active/inactive handling, duplicate validation, and initial Job Order, Casual, Regular/Permanent values.
2. Item maintenance: Admin CRUD with Title and Role text inputs, Employee Status selector, and configurable page/action permissions for every Item.
3. Dynamic access: replace fixed-role-list assumptions in permission editing, user assignment, navigation, gateway validation, and RLS enforcement. Use capability-driven feature routing for custom Items rather than inventing a new hardcoded dashboard per role name.
4. Direct user creation: select the final Item during account creation; perform any required Head/Assistant Head organisation assignment during database finalisation. Preserve the current create-user return contract.

Update user-directory badges, filters, profile displays, and reviewed PDS mappings to show the assigned Item's Title, Role, and Employee Status without conflating employment classification with access or account activation.

Do not fabricate employment statuses for existing users/Items. Flag legacy records needing an Admin's reviewed status assignment; permit the migration bridge to keep existing accounts usable while that data is completed. A newly created custom Item starts with no permissions until Admin grants them.

For Head/Assistant Head appointments, validate and lock the organisation leadership slot, complete the requested profile/Item assignment, and recover or compensate a failed creation. The current create-as-Employee then promote path must be removed once its callers are migrated. Permission alone must not create an organisation leadership appointment.

Acceptance criteria:

- Admin creates a custom Item with arbitrary Title/Role text and its own permission configuration, then assigns it to a user.
- Granted pages/actions work; denied operations fail at both UI and enforcement boundaries. Renaming the Item does not change its permissions or assignments.
- Account Active/Inactive and Employee Status remain separate concepts.
- Admin creates a Head, Assistant Head, accounting user, custom-Item user, or another Admin directly.
- Leadership conflicts and concurrent attempts do not leave a partially created Employee account or duplicate Auth/profile records.
- Used catalogue records remain traceable when retired; deleting an unreferenced entry works.

Verification: extend `permissions`, `adminUserDirectory`, `managedUserService`, `managedUserLeadershipService`, leadership-constraint tests, and add meaningful catalogue interaction/enforcement tests.

### Phase 3 - Strict hierarchy and retirement of boards/committees

Slices:

1. Enforce parent/child rules: Department -> Division -> Section -> Unit. A retained technical LGU root may contain departments; it is not an additional employee hierarchy level. Prevent skipped levels, cycles, and children under Units.
2. Produce and apply explicit mappings for existing invalid branches. Preserve membership and reporting scope; do not invent department/division/section names to repair missing levels.
3. Resolve every active board/committee project, task, and closeout route to its responsible department and assigned Department Head. Preserve current participating-department approvals.
4. Retire active boards/committees, their reviewer rosters, selectors, and routing choices. Remove legislative committee destinations and their active UI callers.
5. Provide historical access through the project/audit archive to original approvals, resolutions, meeting records, and attachments. Keep the retired organisation identities needed by historical foreign keys.

Include active ownership references, user memberships, scope grants, and notification links in the reviewed department mapping. Retiring an organisation must not strand an active user or project in it. Retired legislative committee deep links should resolve to an appropriate remaining overview/archive rather than an inaccessible live page.

Pending review decisions must be reassigned with an auditable route-change event. Do not treat a retired board's previous decision as a newly issued Department Head approval. Completed historical decisions are retained as issued. If the Head cannot review because of self-approval restrictions, use the existing eligible Assistant Head path; missing eligible reviewers must produce a clear blocker rather than silent auto-approval.

Remove committee-stage links in legislative workflows and provide an explicit replacement route to department review where those links represent active review requirements. Keep other legislative destinations operational. Search for consumers before deleting components or exports; retain archive readers where they are still required.

Acceptance criteria:

- New organisation creation, edits, tree moves, and direct writes enforce the same strict hierarchy.
- Department financial scope correctly resolves for users assigned to Divisions, Sections, and Units.
- No active board/committee or legislative committee destination remains.
- Every migrated active approval has a resolvable eligible department reviewer, or a visible setup blocker.
- Historical decisions and attachments remain readable, and before/after routing can be audited.

Verification: organisation validation/tree tests, collaboration/governance routing tests, review/publication readiness, historical record access, scoped reports, and affected navigation smoke tests.

### Phase 4 - Expense Accounts and reusable particulars

Deliverables:

- Add Admin-only Expense Account maintenance with Account Name, Account Code, and an optional list of generic particular names.
- Validate required names/codes and duplicate codes. Support retire/reactivate and deletion of unused entries.
- Add an account-first picker usable by each project account group. Show only active accounts for new selections while preserving existing/approved retired-account references.
- Selecting a generic particular fills its name only. Details and Cost remain entered by the user. A custom particular stays local unless Admin explicitly adds it to the catalogue.

The catalogue classifies the project cost/fund source. The department's annual appropriation remains the funding envelope. This phase does not create account balances, transfers, or automatic journal-account mappings.

Acceptance criteria: multiple account groups can load distinct reusable names, custom particulars work, non-Admin writes are denied, and retiring an account does not break historical project costs or reports.

Verification: catalogue CRUD/enforcement, duplicate validation, account selection, custom particulars, and referenced-record retirement tests.

### Phase 5 - Department Annual Budget and approved corrections

Slices:

1. Rename the page/navigation to Department Annual Budget, retain legacy deep-link aliases, and put annual setup/status first in the fiscal planning flow.
2. Reuse the unique department/fiscal-year record. Show the relevant fiscal year and setup status in creation/review without blocking drafts or imports. Require a valid locked annual budget before publication.
3. Add correction requests and the confirmed approval routes: Accounting Officer -> Department Head; Department Head requester -> Assistant Head. Resolve Accounting Officer authority through the relevant accounting permission/assignment, including the existing accounting workspace.
4. Replace immediate correction posting with request/review/post operations. Keep the current amount effective until approval and post the adjustment, ledger entry, and audit record together exactly once.

Requests contain the before amount/version, proposed amount, reason, requester, reviewer, decision, and optional evidence. Rejection or updates-needed leaves the appropriation unchanged. At approval, lock and revalidate the budget/version and existing commitments so a stale request cannot overwrite a newer approved correction or reduce the budget below commitments. The legacy direct adjustment entry point must enforce the new policy or delegate through a compatible approved-request path.

Acceptance criteria:

- No duplicate annual budget can be created for the same department/year, including concurrent submissions.
- Users can create/import/save drafts before setup; publication reports the missing/invalid annual-budget prerequisite.
- Both confirmed correction routes work and self-approval is denied.
- Each approved correction records one auditable before/after adjustment; repeat clicks do not duplicate posting.
- Project/proposal import never creates or changes an annual appropriation.

Verification: annual-budget uniqueness, publication gating, correction request/decision/concurrency tests, ledger reconciliation, and affected budget-workspace interactions.

### Phase 6 - Project-first costs and current-program editing

Deliverables:

- Introduce independently persistable programs/projects/activities with stable draft ids and a versioned snapshot reader. Adapt existing task-derived snapshots without losing tasks, assignments, comments, or budget evidence.
- Present the creation sequence as current program/project details -> Budget Requirement -> Work plan -> review/publication readiness.
- Enable editing the current draft program's name/details. Keep its stable identity and update only its draft context and child display metadata; do not mutate shared/published program records.
- Build project-owned account groups. Each has Fund account source above a table containing Particular, Details, and Cost, plus group/project totals.
- Allow cost entry and draft saving before activities/tasks exist. Preserve manual creation and PDF import modes.
- Apply the confirmed Create Project, Cost Component, and Budget Requirement terminology. Remove the Task funding status row and its adjacent amount; retain totals in the cost summaries.

Use decimal/cents-safe financial arithmetic. Costs must not be derived from the new particular-name templates. Preserve historical quantity/unit/unit-cost information through compatibility mapping without making those legacy fields mandatory in the new form.

Acceptance criteria:

- A project and its account groups/cost components can be created, autosaved, closed, and reopened before work-plan tasks are added.
- Multiple projects in an imported plan each have their own costs; project totals and the plan aggregate reconcile.
- Renaming the current program/project preserves allocation and assignment references and does not affect another project's shared program.
- Account selection precedes Particular entry, and custom particulars/details/cost are retained through autosave.

Verification: draft snapshot round trips, legacy-draft adaptation, cost-editor interactions, stable-identifier renames, manual builder, and import-mode availability.

### Phase 7 - Work-plan timelines and allocation

Slices:

1. Add task start/end inputs and optional activity start/end inputs, retaining existing deadline compatibility for older records.
2. Extract and test one activity-date selector: use a complete explicit activity range; otherwise calculate minimum task start and maximum task end from the included valid task ranges.
3. Add component allocation editing against stable activity/task ids, including splitting one component across several targets and showing allocated/unallocated amounts.
4. Enforce the allocation and date rules in draft validation and server/database publication checks.

Date handling:

- Recalculate derived activity dates when tasks are edited, added, removed, or excluded. Clearing an explicit activity range returns the activity to derived mode.
- Keep explicit dates intact; report invalid/reversed or partially entered ranges and apply the existing hierarchical deadline constraints.
- Do not invent a start date from a legacy due date or an ambiguous imported schedule. Drafts may show incomplete/undated ranges; keep the existing publication deadline requirements.
- Use calendar dates consistently so timezone conversion does not move a date by a day.

Allocation handling:

- Each allocation must refer to a component and target inside the same project.
- A component's allocated total cannot exceed its cost; publication requires it to equal that cost. A total-only comparison is insufficient because one overallocated component could conceal another unallocated component.
- Separate a direct activity allocation from task shares distributed out of it. Parent and child amounts must never be counted twice.
- Activity allocations may be distributed to child tasks. Keep direct activity balances and task shares visible and traceable. Retain activity-only allocated balances at publication; task/subtask cash requests still require an operational task allocation.
- Excluding/deleting a target returns its draft shares to unallocated status with a visible validation message. Changes to approved or already consumed money follow guarded, audited redistribution rather than silently changing amounts.
- Zero-cost tasks/projects retain a valid no-cost path; a zero project total is fully allocated at zero while still meeting the confirmed annual-budget publication prerequisite.

Acceptance criteria: the September example produces 1-4 September, explicit activity dates override derivation, splits reconcile per component, cross-project/overallocated shares are rejected, and unallocated costs block publication.

Verification: pure date derivation, explicit/derived transitions, deleted/excluded tasks, calendar-date handling, allocation conservation, target ownership, split rounding, and zero-cost regressions.

### Phase 8 - Import, review, and atomic publication

Slices:

1. Map imported project costs into the new account groups and project components. Adapt older task-budget imports into project components with matching task allocations while preserving amounts and source evidence.
2. Resolve accounts by stable id/code or a unique matching name. Unmatched/ambiguous sources need selection from the catalogue; import does not create catalogue entries or guess accounts silently.
3. Exclude annual department appropriation fields/sections from persisted project cost data. Do not discard legitimate project components merely because their text mentions a department budget; identify annual totals by their source context.
4. Extend readiness/revision handling to the project costs, account groups, allocations, dates, and retired review routes. Material changes must follow the existing approval invalidation/resubmission rules.
5. Update atomic publication so project costs are reserved once from the selected department/year and generate traceable operational allocations for task shares. Retain allocated activity envelopes for later guarded task distribution.

Preserve external AI endpoints and existing returned values. Normalise new catalogue/project structures at the application boundary or use compatible optional fields; do not bundle an unrelated AI pipeline redesign into this work.

Keep project component identity and approved account/particular snapshots with operational funding. Cost classification must survive cash requests, release, settlement, project reporting, and journal mapping. Published task shares plus direct activity balances must reconcile to the one project commitment. Distributing an approved activity balance to tasks must not reserve the appropriation again.

At publication, recheck annual-budget status and availability, current approvals, component-by-component full allocation, eligible review routing, and target validity inside the same database transaction. Concurrent publications must not oversubscribe the annual budget. Retry/repeated publication must not create duplicate projects, commitments, or allocations.

Acceptance criteria:

- Manual and imported drafts support the same project cost/work-plan/review flow.
- Annual budget data in an imported document leaves the stored annual budget unchanged and is absent from project cost totals.
- Publication fails clearly for missing annual setup, insufficient funds, unallocated components, unresolved accounts, or incomplete required approvals.
- Publication reserves the correct amount once; existing cash release/liquidation consumes those approved allocations without a second annual deduction.
- Existing committed projects, task/subtask funding, liquidations, accounting reports, and historical revisions remain usable.

Verification: extend `proposalBudgetImport`, `proposalBudgetEditor`, `manualPlanDraft`, `manualPlanValidation`, budget-selector, committed-delivery, and collaboration/publication regression coverage. Add disposable-database tests for transactions, concurrency, idempotency, and RLS enforcement.

### Phase 9 - Rehearsal, acceptance, and rollout

Deliverables:

- Rehearse migrations using representative legacy roles, drafts, committed projects, budgets, cash records, skipped organisation levels, and pending/closed board reviews.
- Reconcile before/after account counts, user identities, task/project counts, approvals, attachment access, annual appropriations, commitments, allocations, released cash, settled spending, and journal totals.
- Review the concrete organisation/reviewer/status mapping report before applying changes to the target database. Unresolved business mappings must be resolved rather than guessed.
- Deploy enforcement and compatibility support before switching active role assignments, reviewer routes, or publication writes. Move readers/writers together at each financial boundary.
- Verify target migrations and live service contracts. Keep migration snapshots and audit mappings available for recovery.
- Remove temporary aliases/exports only after consumer search and compatibility verification. Keep historic schema/reference support where records still need it.

End-to-end acceptance journeys:

1. Former Admin and former Super Admin log in as Admin, maintain catalogues, configure a custom Item, and directly create a higher-level account.
2. A custom-Item user receives the configured pages/actions and is denied ungranted direct API/Supabase operations.
3. Create Department -> Division -> Section -> Unit; verify scope, member selection, reporting, and budget department resolution.
4. Open a migrated project with a former board/committee route; complete eligible department review and read the original archived decision/attachments.
5. Create a project with several account groups, generic and custom particulars, and costs before tasks; edit its current program and reopen the saved draft.
6. Add activity/tasks, verify automatic and explicit dates, split each component, and observe that missing allocation blocks publication.
7. Attempt publication without an annual budget, complete annual setup, then publish and verify one commitment and correct task/activity balances.
8. Complete the existing task/subtask cash request -> review -> release -> liquidation -> settlement journey using the new component-backed funding.
9. Submit an Accounting Officer correction for Head approval, and a Head correction for Assistant Head approval; verify logs, rejected requests, duplicate-decision handling, and the effective appropriation.
10. Import a document containing project costs and an annual appropriation; verify the project costs, unchanged annual budget, restored work plan, and publication prerequisites.

Exit criteria: the required checks and affected authenticated smoke journeys pass, financial/user/history reconciliation passes, no unresolved reviewer mappings remain for migrated active work, and the target environment is verified.

## Verification required after each implementation slice

- `npm run check`
- `npm test`
- `npm run build`
- Affected Playwright smoke tests when the environment is configured. The current suite uses `EFLOW_E2E=1` and appropriate test-account configuration such as `EFLOW_E2E_ACCOUNTS`; do not claim authenticated coverage when those prerequisites are unavailable.
- Gateway tests for changed user-management/authorisation behaviour and disposable PostgreSQL/RLS tests for new enforcement, approval, allocation, and publication rules.
- Targeted migration/schema verification before declaring deployment complete. Extend the existing schema verifier where necessary for the new contracts.

No execution checks are claimed by this planning document. During implementation, attach actual commands/results and unresolved environment limitations to the completion record of each phase.

## Requirement completion checklist

- [ ] One Admin replaces both legacy administrative roles with the confirmed privileges.
- [ ] Employee Status maintenance and Item CRUD/configurable permissions work with Admin-only writes.
- [ ] Direct higher-level user creation completes without an Employee promotion step.
- [ ] The strict four-level organisation hierarchy is enforced across all writes.
- [ ] Active boards/committees and legislative committee pages are removed; active reviews are rerouted and history retained.
- [ ] Expense Accounts and account-specific generic particular names have maintenance.
- [ ] Project costs precede work-plan entry and support multiple account groups, Details, Cost, and custom particulars.
- [ ] Components can be split across activities/tasks and must all be fully allocated before publication.
- [ ] The standalone page is Department Annual Budget; the project form uses Budget Requirement.
- [ ] Annual budgets are unique per department/year, required only before publication, and excluded from imports.
- [ ] Annual corrections use Route A and produce complete request/decision/posting logs.
- [ ] Create Project, Cost Component, Fund account source, and the removed Task funding status row are reflected consistently.
- [ ] Current-program editing preserves stable draft identity and affects only the current draft.
- [ ] Explicit and derived activity timelines behave as confirmed.
- [ ] Existing financial, review, task, report, and historical-record workflows pass the regression and reconciliation checks.
