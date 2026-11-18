# Subtask execution belongs to the assigned subtask team

Implemented in the Web working tree on 18 November 2026. The SQL migration is prepared and tested locally, **not applied to the hosted database**. No Web deployment, Mobile modification, account change, or hosted work mutation was performed.

## Corrected rule

Being the parent Task Lead, an ancestor Lead, Project Lead, or Office Head does not by itself authorize posting a subtask work update, raising/clearing its blocker, or making a new direct completion submission. The actor must be the appointed Lead or an explicitly assigned contributor of that exact subtask, and all existing server execution/lifecycle checks still apply. Contributor submissions retain their existing Lead-review route; membership alone never grants direct completion or bypasses independent review.

Task Leads retain their existing authorized review decisions. Accepting someone else's submitted work is distinct from posting a new update as the Task Lead. Root-task progress, planning/detail editing, staffing, finance and Personal-work permissions keep their existing contracts.

## Web implementation

- `nested-work/selectors/participation.ts` provides the focused node-membership predicate.
- `selectNodeWorkCapability` restricts Office `execute` and `submit` presentation to the node's own team, including while an older server still advertises the previous capability. Management/edit/review capabilities are not derived from this predicate.
- `SubitemInspector` removes the parent Task Lead shortcut for unassigned execution and explains the missing form. Existing Lead-review controls remain independent.
- `verifySubtaskProgressAccess` checks exact-node membership against a fresh scoped work tree before saving. The legacy drawer also restricts its form to the subtask's team and rechecks assignment before progress writes.

Navigation remains My Work/Project work → task → subtask → Work. Activity, funding and authorized detail editing remain available through their existing controls.

## SQL migration

`supabase/migrations/20261118152250_restrict_subtask_execution_to_assigned_team.sql`

Prepared with the Supabase CLI in the isolated migration workspace. Baselines came from read-only inspection of the sole hosted target, `ixnfphgjyelhckjwjkdv`.

The migration changes three existing functions:

1. `eflow_r7.operation_capabilities`: denies Office subtask execution/submission to an unassigned actor.
2. `eflow_m7.require_progress_authority`: rejects unassigned direct subtask progress writers, including the older numeric-progress entry point; root-task handling remains intact.
3. `eflow_evidence.guard_progress`: applies the same membership restriction to direct progress-history inserts/updates.

The existing private, transaction-scoped `applying_work_proposal` path is retained for legitimate reviewer decisions. Public callers receive no new bypass, grants or settings. The existing `decide_work` function still validates eligible independent reviewer, scope, pending state, baseline, proposal terms, files and completion prerequisites before entering that private path. Captured-function tests exercise accepted progress and completion proposals through this path.

The transaction checks function fingerprints before replacing any definition and verifies unchanged owners, ACLs, security modes and function settings afterward. Unexpected hosted drift aborts the script. No stored work/history is rewritten and no schema columns or RLS policies are changed. This permission migration is independent of the earlier estimated-hours removal migration.

To deploy later, populate an isolated migration workspace from the latest hosted history and add only the reviewed pending file. Do not push historical repository migrations or repair hosted timestamps. Re-review any reported fingerprint mismatch instead of bypassing the check.

## Mobile handoff — not implemented here

Current native source still includes the parent Task Lead in `isSubtaskLeadOrContributor`. For the later Mobile change:

- Restrict execution participation in `workPermissions.ts` to `node.lead_id` and `node.assigned_to_ids`. Keep `canDecideSubtaskProposals` separate: Task Leads may remain eligible reviewers without being subtask workers.
- Carry the exact-node participation check through `WorkTreePanel`, `OfficeSubitemUpdateSheet`, and the WorkEditor progress preflight. Continue requiring authoritative `execute`/`submit` capabilities and fresh scope/revision checks.
- Check `branchInspector.completionMode` so a parent Task Lead appointment alone never advertises direct subtask completion. Preserve the existing contributor/subtask-Lead review flow.
- Update permission and rendered-screen tests for an unassigned Task Lead, an explicitly assigned Task Lead, the Subtask Lead, a contributor, and an eligible reviewer. Preserve Start as an appointed-Subtask-Lead action.

The SQL restriction also protects requests from older Mobile versions once deployed. This document does not claim installed APK or native-device verification.

## Validation

- Web type check and production build passed; existing circular-chunk and size warnings remain.
- Six affected unit suites passed (159 tests), with the final notice/SQL changes rechecked in the affected suites and one additional legacy-form regression passing.
- Five disposable PGlite tests cover pre/post permission behavior, direct history rejection, null-array fail-closed handling, explicit assignment, retained contributor review, accepted progress/completion decisions, root-task authority, unchanged function privileges and rollback on drift. Captured hosted bodies run against a small scope/finance fixture, not a full hosted-schema/RLS acceptance environment.
- Chromium smoke passed for unassigned Task Lead review without execution, including a 390px viewport, and the existing uncertain-blocker recovery flow. The final notice was rechecked against the final production build. Requests were intercepted; no real records changed.
- Graphify refreshed successfully. Five existing partial TypeScript extraction warnings remain; actual source, type checks and build provide correctness evidence.
- No full test suite, hosted migration, authenticated production mutation, Mobile build, Android/iOS workflow test or deployment was run.
