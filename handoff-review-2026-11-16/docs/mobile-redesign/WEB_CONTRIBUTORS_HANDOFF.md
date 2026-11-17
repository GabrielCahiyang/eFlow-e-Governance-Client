# Web contributor behavior — complete implementation checklist

This is a required part of the Web handoff, alongside limited started editing. Work in your own Web checkout. Read AGENTS.md, inspect current Git state and preserve unrelated work. Retain working controls and make the smallest necessary changes. Mobile reference code is illustrative, not Web code to paste.

## Approved behavior

1. A Task Lead can manage contributors on their assigned Task, including active projects.
2. A Subtask Lead can manage contributors on their assigned direct Subtask.
3. Exclude the appointed Lead from available and selected contributor lists and counts. Preserve the Lead's canonical ID in backend worker arrays where the existing contract requires it. Removing the Lead from the displayed contributor list must not remove their assignment.
4. Contributor permission never grants Lead-transfer permission. Task Lead changes use the Project Lead's separate appointment authority. Subtask Lead changes use the Task Lead's separate authority. Preserve existing legitimate scoped Office Head authority and independent lifecycle/history/eligibility restrictions.
5. Project membership alone grants no staffing authority. Overlapping appointments must retain the relevant branch permission without granting control of other branches. A Project Lead who is also a Task Lead or Subtask Lead must retain that appointed branch's contributor action, subject to independent restrictions.

## Inspect before editing

Inspect existing `WorkContributorsField`, `WorkLeadField`, `WorkStaffingDialog`, `WorkRootOwner`, `WorkTreeEditor` and `selectors/staffing.ts`. Also trace shared staffing/people selectors, `WorkRootStaffingDialog`, `WorkPeoplePicker`, caller permissions and mutation/recovery services in your current checkout. Much of the picker behavior and separation already exists; do not rebuild it unnecessarily.

Apply the specific contributor capability to contributor controls/saves and the separate appointment capability to Lead controls/transfers. Do not make the entire staffing form depend only on appointment authority, and do not enable the Lead picker merely because contributors are editable. Keep the canonical current Lead in contributor-only payloads.

When a selector is nested inside another modal, Confirm applies its draft to the parent form, X/Cancel discards the nested draft, and the parent's Save writes to Supabase. Existing inline Web selectors with a clear Save changes action can remain inline.

## Current backend evidence — correct the old pasted prompt

The statement **“the production contributor migration has NOT been installed; all five original hashes remain unchanged” is historical and must not be used as current status.** The earlier user-applied contributor correction was verified successfully. A fresh read-only handoff check now finds:

- `eflow_publication.guard_active_subtask_staffing()`, `root_contributor_change_locked(uuid)` and `guard_active_root_contributor_change()` still match the installed contributor correction.
- The two shared functions, `eflow_r7.command(uuid,integer,uuid,text,jsonb)` and `operation_capabilities(uuid,uuid)`, have advanced since that verification. Their complete definitions match the newer started-editing candidate after newline normalization, which retains the contributor correction.
- The new editing schema and `public.work_detail_edit_state(uuid,uuid)` now exist. This existence check and the two shared-definition matches do not certify every editing helper, trigger, grant, RLS route or real workflow.

See `docs/mobile-redesign/backend-review/lead-contributors/handoff-status-summary.json` and its source evidence files. All agent checks were SELECT-only. No Web or production mutations were made by the Mobile agent.

The historical corrected proposal, baseline/dependency definitions and installation evidence are included under `docs/mobile-redesign/backend-review/lead-contributors/`. The proposal normalizes function text, anchors and replacements for Windows line endings and retains hash/anchor checks. **Do not reapply it on the already corrected/newer environment, remove its checks or create a competing patch.** Recheck current installed definitions before any backend recommendation. Its original NOT APPLIED preparation header does not describe the later installation.

## Save and recovery requirements

- Recheck the particular contributor or appointment capability immediately before saving and before an uncommitted retry. Confirm actor, root, Office/project, branch and current revision/lifecycle scope.
- Preserve drafts on denials, stale state and interrupted requests. Explain the loss of authority without silently clearing selected people.
- Preserve original request IDs and immutable request terms after an uncertain result. Verify the original receipt before considering another write. A committed receipt can still be confirmed after mutation authority changes; an uncommitted retry requires current authority.
- Never override a server denial with JavaScript, change a Lead through a contributor update, or manufacture success from an optimistic roster. Refresh affected cards, counts and Activity only from confirmed server state.

## Required regressions

| Scenario | Expected behavior |
| --- | --- |
| Task Lead on own active Task | Contributor editing permitted through the current capability. |
| Subtask Lead on own direct Subtask | Contributor editing permitted; current Lead unchanged. |
| Available/selected people and counts | Appointed Lead excluded in all variants; canonical stored ID retained where required. |
| Task/Subtask Lead attempts self-transfer | Denied without separate appointment authority. |
| Project Lead transfers Task Lead; Task Lead transfers direct Subtask Lead | Allowed only under existing appointment, eligibility, lifecycle and history rules. |
| Ordinary member/contributor or unrelated branch/Office | No staffing authority from membership alone; server denies unauthorized writes. |
| Overlapping Project/Task/Subtask appointments | Own branch capability retained; unrelated branches remain protected; contributor exception cannot transfer a Lead. |
| Permission revoked before Save or uncommitted retry | Rechecked and denied; no roster mutation; draft retained. |
| Response lost after a committed write | Original receipt verified without a duplicate request/write/event. |
| Completed/archived/history/financial restrictions | Existing independent restrictions preserved. |

Add meaningful Web regressions, then run the checkout's required checks/tests/build and relevant browser smoke tests. Historical disposable local SQL coverage is provided by `scripts/verify-lead-contributors-review.mjs` and `--crlf-sql`; it uses captured definitions and synthetic scope/identity/history adapters and is not hosted authenticated acceptance. Set `EFLOW_WEB_SOURCE` to your own checkout containing the existing PGlite dependency; do not assume a developer-specific local path.

Do not apply migrations, modify production, deploy, push or create/mutate live fixtures without explicit approval. Real authenticated/RLS/concurrent-session and Web-to-Mobile tests remain **BLOCKED** until approved actors and dedicated fixtures are available through normal protected login. Do not request passwords or bypass authentication.

Report exact changed files and PASS/FAIL/BLOCKED evidence. Distinguish installed function definitions from actual Web UI behavior and authenticated workflow acceptance. If the current backend denies an approved contributor action, report the exact scoped denial and do not declare end-to-end success.
