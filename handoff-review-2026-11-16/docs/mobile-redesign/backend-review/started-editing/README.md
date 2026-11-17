# Started Task/Subtask editing — backend REVIEW

16 November 2026. **Prepared by the agent; not applied by the agent. Real-role acceptance remains BLOCKED.**

**Newer handoff deployment observation:** a subsequent SELECT-only check finds the new editing schema/RPC and confirms that the shared command/capability definitions match the prepared candidate after newline normalization. This supersedes the earlier absent-contract checkpoint below. Full helper/trigger/grant/RLS and workflow acceptance were not verified in that check. See `../lead-contributors/handoff-status-summary.json`. Do not blindly rerun the guarded SQL on the newer environment.

The user approved limited edits after Start for both Tasks and Subtasks. This supersedes the earlier instruction to leave all Task editing unchanged; **Task visibility stays unchanged**. Definition-editing scope is existing project Tasks and Office Subtasks; Personal and legacy non-project definition contracts are retained. The no-delete-after-start rule also protects Task soft deletion.

## Confirmed baseline

Read-only Supabase CLI inspection identified `ixnfphgjyelhckjwjkdv` as **production**. No hosted mutations were performed. Evidence files contain function definitions, hashes, trigger definitions, column information and policies, without account passwords or record fixtures.

- `public.phase3_patch_task(uuid,jsonb)` currently permits broad changes to a started Task. Its delegated counterpart is `eflow_r9.edit_selected_project_task(uuid,jsonb)`, exposed through the existing public wrapper.
- `eflow_r7.command(uuid,integer,uuid,text,jsonb)` and `eflow_r7.operation_capabilities(uuid,uuid)` currently require untouched work for Subtask detail edits. Title/priority corrections therefore need a coordinated backend change.
- `eflow_r9.record_project_field_history()` already records several Task definition changes in project history. Mobile Task Activity reads `task_activities`/status history and does not consume that project feed. The new Activity records complement it; existing history is preserved.
- `task_activities` already has `actor_id`, `actor_name`, `created_at`, `content` and `metadata`. Its SELECT policy uses `can_see_task(task_id,auth.uid())`; no new read policy or Realtime configuration is proposed here. Mobile Activity already refreshes this feed and retains its polling fallback.
- The currently captured `eflow_m7.node_visible` **does contain the parent Task current/historical Start predicate**. This is newer evidence than the earlier planning report. That one function does not establish that every previous visibility/deletion candidate or all routes were deployed correctly. This slice does not certify those earlier migrations.
- The new `eflow_work_edit` schema was absent during inspection. The new editing contract has not been installed by this agent.

The preparation checkpoint in `installed-final-verification.json` recorded the schema/RPC as absent and all five reviewed writer/projector hashes at their captured values. That checkpoint is historical; the newer handoff observation above records later deployment state.

## What the candidate changes

`20261116030000_started_detail_editing_REVIEW.sql` is the complete guarded reference candidate. Use it only for a separately approved, reviewed deployment after staging; do not rerun it simply because this archive includes it. `policy-body.sql` is a generator fragment, not a standalone migration. Baseline JSON files are evidence, not scripts to apply.

The candidate is one transaction. It checks exact installed hashes for 20 reviewed functions, creates a private `eflow_work_edit` helper schema, and replaces exactly five existing function definitions:

1. `public.phase3_patch_task(uuid,jsonb)` — accepts `change_reason` and supplies it to the atomic Task guard/audit within the transaction; clears the reason afterward. Original permission, dependency, date and update code remains.
2. `eflow_r9.edit_selected_project_task(uuid,jsonb)` — same reason handling, retaining its narrower delegated-edit permission.
3. `eflow_r7.operation_capabilities(uuid,uuid)` — exposes the permitted Office `edit_details` action using the new policy. Other actions, including contributors, appointments, execution, completion and review, retain their existing branches.
4. `eflow_r7.command(uuid,integer,uuid,text,jsonb)` — permits Office edits that pass the new field-level validation. Personal behavior and structural commands retain untouched/subtree restrictions. Actor/scope checks, request receipts, revision/row locks, operation-impact checks, deadline/descendant checks, evidence/finance guards, events and staffing protections remain.
5. `eflow_r7.snapshot(uuid)` — includes each visible Subtask's `detail_edit` state and saved schedule reason; planning availability accounts for started history. The existing visibility-filtered baseline snapshot is retained.

New public read RPC: `public.work_detail_edit_state(p_task_id uuid,p_node_id uuid default null)`. Response version 1 contains `task_id`, `node_id`, `updated_at`, `started`, `details`, `due`, `planning`. Execution is granted to authenticated users; its private helpers are not exposed to anonymous/authenticated callers. Each call checks current scope and authority. This RPC grants no write permission.

New table guards apply the definition policy to every UPDATE route, including older clients. Subtask DELETE and Task soft deletion also reject previously started work, while existing deletion/finance/history protections continue independently. No trigger or RLS policy is disabled in the candidate. No record backfill, Lead transfer, data deletion, publication change or finance rewrite is included.

## Policy and compatibility

| Situation | Behavior |
| --- | --- |
| Genuinely unstarted work | Existing authorized planning remains available; existing endpoint/field/role restrictions still apply. |
| Started Task/Subtask | An existing authorized editor may correct title/name and priority. This does not appoint a new editor. |
| Due-date change after Start | Requires existing supervising/upper-Lead planning authority, a nonblank reason of at most 1,000 characters, and existing schedule/ancestor/descendant checks. Delegated detail access or contributor permission alone is insufficient. |
| Start date, prerequisites, hierarchy/order, sequencing or other planning definition changes after Start | Rejected through ordinary editing. No new exceptional correction/reopen bypass is introduced. |
| Pending review, completed or cancelled definition | Read-only; existing return/reopen workflows and independent action permissions remain. |
| Status reset to `todo` | Task status history, Subtask `started_at`, progress/submission history and started descendants still prevent treating it as untouched. |
| Contributor management and Lead transfer | Existing installed contributor correction retained. Appointed Lead is excluded from displayed contributor lists; canonical worker IDs remain compatible. Transfer still requires separate appointment authority. |
| Dependency execution | No Start/Complete prerequisite calculation is changed. Explicit `[]`, legacy `null`, cancelled prerequisites, parent Start, appointed Lead, scheduling, evidence and reviewer rules remain independent gates. |
| Uncertain Subtask edit | Existing receipt checked first. Uncommitted retries recheck edit/due/planning authority and retain original request terms. A committed receipt does not create a second event after authority is revoked. |

Existing project material-change and schedule-review behavior remains in force. A successful reschedule is not a promise that other project approval restrictions disappear.

The candidate preserves existing records without rewriting their dependency arrays or started markers. Historical values that were never recorded are not reconstructed or backfilled. A copied script whose preflight fails must be re-reviewed against current definitions; **do not remove the hash checks or splice around the failure**.

## Activity contract

Task changes are recorded atomically in `task_activities` as `type='work_details_edited'`, with stored author identity/name and timestamp. Metadata is:

```json
{"version":1,"fields":[{"key":"title","label":"Title","before":"Old name","after":"Corrected name"}],"reason":null}
```

All changed definition fields supported by the Task editor are included. Other tracked definition/staffing fields are also captured when changed through existing authorized routes: description, start/due dates, prerequisites, effort, budget estimate, group/position, Lead, contributors, reviewer, acceptance criteria and definition of done. A differing stored compatibility due-date value is recorded separately. Historical names are resolved when saving and stored, rather than replaced with today's names when viewing. Contributor displays omit the appointed Lead. Existing versioned staffing events are retained without an additional duplicate staffing-only Task entry.

Subtask edits continue using the original atomic `work_tree_events` before/after snapshots, enriched with the policy and schedule reason. Mobile displays title, priority, start/due date, explicit prerequisites versus legacy sequencing, structure, staffing and existing execution deltas. Progress updates, blockers, Next step, evidence and proposal submission/approval retain their existing separately authored feeds. Pending contributor proposals are not presented as officially applied changes. Cancelled drafts and failed writes do not create an applied edit event. Task no-op updates omit detail events; existing Subtask request audit entries are retained without inventing changed-field deltas.

## Verification and rollout

Local PostgreSQL tests use captured writer/capability/snapshot and guard bodies, with **explicit synthetic scope/identity/history helpers**. They are not real hosted-role or full-schema staging acceptance. Both LF and Windows CRLF scripts pass 50 assertions, including prerequisite-hash refusal, started/unstarted/history/descendant behavior, protected fields, reason/authority checks, independent contributor/appointment rights, existing date bounds, audit deltas/no-op behavior and receipt replay after revocation.

To reproduce locally, set `EFLOW_WEB_SOURCE` to a Web checkout that already contains `@electric-sql/pglite`; no package is downloaded:

```powershell
node scripts/prepare-started-editing-review.mjs
node scripts/verify-started-editing-review.mjs
node scripts/verify-started-editing-review.mjs --crlf-sql
```

Required before production approval:

1. Stage the complete current schema/trigger graph, RLS and this candidate in an approved non-production environment. Recheck preflight hashes and compare resulting definitions; test exact real endpoints used by Web/Mobile and direct reads/writes under authenticated roles.
2. Use approved dedicated actors: Cheryl as Office Head/automatic Project Lead, Andres as Task Lead, Crisostomo as Subtask Lead/contributor, and optionally Gabriel as an unrelated project reader for denial tests. Existing delegated Task editing needs its real project capability; Task Lead appointment alone must not invent general Task-edit authority.
3. Use one non-financial disposable project, one Task and direct Subtasks A/B/C, with C depending on B. Test edits before/after Start, B completed versus cancelled, satisfied dependencies, current blockers, review locks and evidence. Preserve the independent final Task reviewer.
4. Run concurrent Start/edit, Start/delete, review/edit, two-editor and permission-revocation sessions. Verify rollback leaves no partial audit/change and that an uncertain request is checked before retry. Local single-session tests do not establish this acceptance.
5. Verify Web/Mobile Activity and cross-device refresh, and Android/iOS workflows/themes/font scaling/accessibility/keyboard separately. Approve fixture creation/cleanup before any records are written. Retain audit/history; archive dedicated fixtures through approved flows rather than erasing started work.
6. Only after explicit production approval, coordinate one canonical Web migration and client rollout. Do not reapply the old contributor patch. Do not install this file through automated migration discovery before review.

Before any deployment, retain the captured definitions and a database backup. Rollback requires a coordinated client change and reviewed restoration of those exact functions/guards; keep all newly recorded Activity rows. Do not delete audit/history data or blindly drop the new schema while clients still call its public contract. No rollback was executed or production safety certified here.

No approved staging target, actor accounts or writable fixtures have been supplied. Those tests remain **BLOCKED**. The companion APK is a review artifact, not release acceptance. Missing-policy handling fails closed; the newer existence/definition observation alone does not prove the feature's complete installation or authenticated operation. Existing creation, assigned execution, blockers and contributor actions retain their own contracts. Verify the coordinated backend/client changes before declaring the new editing feature accepted.
