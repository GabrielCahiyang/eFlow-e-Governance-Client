# Office subtask edit/delete permission correction — 19 November 2026

## Finding

The user's expected split is correct: the parent Task Lead may edit and delete eligible subtasks; an appointed Subtask Lead may edit their subtask but does not gain deletion authority from that appointment. Execution participation remains a separate rule.

Current Mobile `WorkTreePanel.tsx` explicitly limits Office Delete to `data.root.lead === actor`, `todo`, no start timestamp and zero progress, in addition to server capability. `WorkEditorSheet.tsx` repeats that restriction against the fresh tree before sending. Edit uses its separate `edit_details` capability. This source inspection does not establish installed-APK or device acceptance.

Web previously exposed Delete from `selectNodeWorkCapability(..., 'delete')` with no equivalent Task Lead-only restriction. Its hierarchy and shared editor both consumed that selector. Captured `eflow_r7.operation_capabilities` and the repository's latest `node_capabilities_fast` used branch-management authority, allowing an appointed Subtask Lead to receive Delete for untouched work. The earlier assigned-team and contributor-review migrations do not change this rule.

Local reproduction against the actual Web selector returned Edit=true/Delete=true for an appointed Subtask Lead when the server supplied both grants. The disposable SQL model likewise returned Delete=true for a clean Subtask Lead node before this correction. These are source/model findings; hosted state was not queried.

## Local correction

The shared Web capability selector now further restricts Office Delete to the root Task Lead, `status === 'todo'`, absent `started_at`, and exactly zero progress. It still requires the server grant and current actor/root/project/Office/revision. This applies to hierarchy menus and editor authorization without tying management to execution membership. It leaves Edit and all Personal capabilities unchanged.

| Appointment | Edit eligible Office subtask details | Delete eligible Office subtask |
|---|---|---|
| Root Task Lead, not assigned to the subtask | Existing authorized edit retained | Allowed only before execution and without blocking history |
| Appointed Subtask Lead, not root Task Lead | Existing authorized edit retained | Denied |
| Person appointed as both leads | Existing authorized edit retained | Same Task Lead restrictions |
| Contributor only | No new edit grant | Denied |
| Ancestor Lead, Project Lead or Head who is not root Task Lead | Existing scoped/planning edit rules remain; no new grant | Denied |

Editing is not an unrestricted lifecycle override: current field permissions, closed/read-only work, start/prerequisite locks, date bounds, reasons, stale revisions and server validation still apply. Web's modern Inspector currently opens the full shared details editor through an **Edit schedule** control in its Schedule section; Mobile labels its header action **Edit subtask**. That naming/location difference was identified but not redesigned in this permission slice. Root-task edit/delete policy is separate and is not expanded by a Subtask Lead appointment.

## Pending SQL

`supabase/migrations/20261119020000_task_lead_only_subtask_deletion.sql` is prepared locally and **not applied**. It follows the two migrations the user already confirmed applying. Sole target: `ixnfphgjyelhckjwjkdv`.

It updates both capability paths (`operation_capabilities` and `node_capabilities_fast`) and `guard_node`. The trigger requires Task Lead authority even for deletes inside the versioned command's internal transaction, preventing an RPC/direct-delete bypass. It also blocks a retained start timestamp when status/progress have not advanced, and both capability paths check started descendants. Existing evidence, financial-history, subtree, lifecycle and edit checks remain. The new restrictions apply to Office subtasks, preserving Personal behavior and existing unauthenticated maintenance semantics.

Expected fingerprints use the captured capability definition after the already-applied participation migration plus the latest repository fast-capability/node-guard definitions from `20261118091500_active_subtask_planning_lock_and_direct_task_staffing.sql`. No claim is made that these latter two definitions were freshly read from hosted. Any baseline drift aborts before modification; inspect live definitions instead of bypassing the checks. The transaction verifies function owners, ACLs, SECURITY DEFINER and search paths remain unchanged. No schema or RLS changes are included.

Existing root-task removal calls `soft_delete_task`, which marks the root deleted and retains checklist rows. This correction does not edit that RPC or its separate authorization/history rules. No task or subtask was deleted on hosted during this work.

## Verification

- 138 unique targeted tests passed across capability, hierarchy/menu, command-form and deletion-migration suites (136 initial cases plus two additional role/menu regressions). No full suite was run. An existing mocked task-notification callback logs a missing mock `supabase.from` warning; the targeted assertions pass.
- Seven disposable PGlite SQL cases cover the normal/fast capability paths, retained Edit, Task Lead deletion without execution membership, raw/internal deletion rejection for non-Task-Leads, history/start restrictions, started descendants, privilege preservation and baseline-drift rollback. This fixture supplies limited scope/planning helpers and is not full hosted RLS/concurrency acceptance.
- `npm run check` and `npm run build` passed. Existing circular-chunk and bundle-size warnings remain.
- Five Chromium production-preview checks passed, covering Edit/Delete menus for each lead, plus the previous unassigned-Lead review and assigned-Task-Lead contributor proposal paths, using mocked backend responses.
- No hosted migration, Web deployment, Mobile edits, native build or authenticated device testing was performed.
