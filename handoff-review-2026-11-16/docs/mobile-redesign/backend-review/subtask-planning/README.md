# Subtask planning visibility and pre-start deletion — shared contract review

16 November 2026. **No hosted changes applied.** This is separate from the earlier contributor-authority correction already applied by the user.

## Prepared SQL files — review only

1. [Unstarted Task delete guard](20261116010000_unstarted_task_delete_REVIEW.sql): adds the atomic started-state/history condition to `public.soft_delete_task`. Passed 18 isolated PostgreSQL checks.
2. [Parent Task / Subtask visibility](20261116020000_parent_task_subtask_visibility_REVIEW.sql): narrows `eflow_m7.node_visible`, filters the baseline work-tree node/people/count projection, gates existing Subtask evidence readers and adds the missing restrictive attachment-metadata SELECT policy. Existing Task read/edit and Personal-work contracts are retained. Current restrictive notification/history/progress/submission policies reuse the corrected helper. Passed 69 disposable PostgreSQL checks per input mode with LF and Windows CRLF script input.

Both files check reviewed function hashes and stop on drift/reapplication. Neither has been applied to hosted Supabase. The visibility file was prepared after the earlier contract-only review; it should not be confused with the contributor-permission migration already installed by the user. Independent scripts cover different rules and do not require replaying that installed migration.

## Latest authorized scope

- Task behavior stays as before, with the requested additional Delete action for an authorized actor while work is unstarted.
- Subtasks remain in the appointed Task Lead's planning view before the **parent Task** starts. Assigned Subtask Leads, contributors and other project participants do not get an early visibility exception.
- After the parent Task starts, otherwise authorized project/Office readers can view Subtasks. Visibility does not grant mutation authority, bypass dependencies/dates or start individual Subtasks automatically.
- Existing Task Lead supervision, appointed Subtask Lead/contributor work, pending reviews and scoped Office/Personal authorization remain separate.
- Delete is available for eligible, unstarted Task and Subtask records. Started work, evidence, historical and financial restrictions must remain protected.
- Confirm in a nested people picker applies choices to the parent form; only Save team submits a server change. Cancel/X discards the picker draft.

## P1: Subtask privacy is NOT enforced by current shared backend

Read-only production inspection found:

1. `eflow_m7.node_visible(uuid,uuid,uuid)` currently checks `public.can_see_task` and existence of the Subtask. It does not require the parent Task to have started or the actor to be its Task Lead.
2. A subsequent query that explicitly included `pg_policies.permissive` confirmed `m7_operational_subtask` is **RESTRICTIVE**, alongside permissive `subtasks_read`. The earlier inference that both combined with OR was incorrect. The restrictive gate already exists, but its `node_visible` predicate still lacks the required parent-Start condition.
3. `m7_operational_subtask_updates` and `m7_operational_subtask_submissions` are also **RESTRICTIVE**, alongside broad Task-reader policies. Their `can_view_linked_work` helper delegates to the current incomplete `node_visible` predicate.
4. `m7_operational_work_events` is **RESTRICTIVE**, alongside permissive `r7_events_read`. Its helper checks embedded nodes in before/after snapshots. A root-level event can contain complete node arrays with `node_id = NULL`; verify that updating visibility safely protects these payloads while preserving Task-only history.
5. `eflow_r7.snapshot(uuid)` composes `eflow_r7.m7_baseline_snapshot`, schedule/count adapters and dependency enrichment. The complete node array, capabilities, visible counts and dependent-node metadata need review. Filtering only the final screen does not secure the RPC response.

Required shared implementation, **not applied here**:

- Define one authoritative Office-parent-start visibility predicate: Task Lead may plan before parent Start; otherwise existing Task/project/Office read authorization plus confirmed parent Start is required. Use persisted status/history to preserve visibility after a legitimately started Task becomes terminal; do not confuse a Subtask's own `started_at` with parent Task Start.
- Enforce it through the existing restrictive RLS gates and security-definer RPC projections. Verify the current policy types instead of adding duplicate restrictive policies. Scope changes to Subtask data and do not change Task visibility, Personal work or legitimate finance access.
- Review direct table reads, work-tree snapshots, history/proposals/evidence, counts, dependency names/IDs, notifications/deferred assignments, search, feeds, reports, links and Realtime subscriptions. Prevent alternate paths and root-event JSON from disclosing hidden Subtasks.
- Recheck Subtask mutations before parent Start, including create/staff/edit/delete/move/order and recovery, so hidden contributors cannot write via RPC/direct table routes. Preserve system/approved upper-level operation contracts rather than adding a session-setting bypass.
- After Start, readers get visibility only; current authorized branch actions, approval boundaries, evidence, no-self-review, eligibility, dates and dependency gates remain in force.
- Stage using separately approved identities/fixtures before production approval. The prepared visibility migration covers the captured helpers, baseline projection and attachment metadata/storage readers; it is broader than a one-function patch. Actual Web feeds, notifications, storage access, existing signed links/caches and authorized financial contexts still need coordinated real-role verification.

Mobile's native list/detail/deep-link presentation guards are implemented, but feeds/search/other clients/raw reads remain dependent on this server correction. **Do not declare global hiding or privacy acceptance from Mobile tests.** Unknown/ambiguous parent states fail closed for non-Task-Leads; an authoritative historical start marker is needed to preserve shared historical visibility for cancelled parents. This finding is about the incomplete visibility predicate, not a confirmed permissive-policy bypass.

### Visibility proposal validation and limitations

`scripts/verify-parent-task-visibility-review.mjs` runs the exact captured functions and this proposal in disposable PGlite. It tests pre-start denial for Subtask Lead/contributor/Head, Task Lead planning visibility, visibility after parent Start, restrictive progress/submission/event/notification policies, baseline counts and historical-person filtering, Subtask attachment metadata, sealed and unsubmitted evidence files, unchanged Task-only and Personal evidence access, historical parent starts, outsiders and reapplication rejection. The same suite runs with LF and CRLF SQL input.

Identity, membership, file-scope parsing/activation and finance adapters in that harness are synthetic. This does not verify hosted grants, actual Storage service behavior, previously issued signed URLs, cache invalidation, concurrent sessions, staging or devices. The new helper retains the canonical legacy recommendation-Lead fallback already used by `eflow_r7.root`; review that compatibility behavior explicitly during staging. The database predicate preserves genuinely started historical parents using status history, while current Mobile cancelled-parent presentation remains fail-closed until a compatible historical-start projection/native adaptation is reviewed. These are review candidates, not a declaration of migration or end-to-end acceptance.

```powershell
$env:EFLOW_WEB_SOURCE = 'C:/Users/james/projects/eflow-e-Governance-Project'
node scripts/verify-parent-task-visibility-review.mjs
node scripts/verify-parent-task-visibility-review.mjs --crlf-sql
```

## P1: Atomic unstarted-Task delete guard — prepared, NOT APPLIED

`public.soft_delete_task(uuid)` locks and checks the Task and deletion authority, then soft-deletes it and records an audit event. Its installed body has no explicit status/progress/started-history check. The inspected Task operation-write trigger does not classify `deleted_at` changes as a delete operation.

Mobile rereads the Task and actor scope before using the existing RPC, so a Task that started before that read is rejected. A concurrent Start **after the read and before the RPC lock** still requires an atomic backend condition. Do not describe that race as solved by the client.

Review [20261116010000_unstarted_task_delete_REVIEW.sql](20261116010000_unstarted_task_delete_REVIEW.sql). It verifies the captured function hash and a unique anchor, then inserts an under-lock check for Task state/progress, prior started status history and started Subtasks. It retains the existing RPC, soft-delete behavior, permissions, audit and existing triggers. No data, roles, grants, RLS or migration history are changed by preparing the file.

**PASS:** 18 disposable PostgreSQL checks using the exact captured/reviewed function and synthetic permission/identity helpers. The original function accepts deletion of an in-progress synthetic Task; the corrected function rejects started states, historical starts, progress and started descendants, still permits eligible unstarted Tasks, denies an unrelated actor and stops on reapplication/drift. Existing RLS/other triggers, concurrent hosted sessions, staging and real roles are not verified.

```powershell
$env:EFLOW_WEB_SOURCE = 'C:/Users/james/projects/eflow-e-Governance-Project'
node scripts/verify-unstarted-task-delete-review.mjs
```

Subtask deletion continues through the existing revision-bound work command and impact/capability checks. Mobile adds explicit unstarted and appointed Task Lead checks, confirms impact, and navigates to the remaining parent only after a receipt. Actual server deletion/history/cascade behavior needs approved staging fixtures; no existing capstone records were deleted.

## Required staged acceptance

Use an approved Office Head/Project Lead, a different Task Lead, different Subtask Lead, contributor and ordinary project reader. Test another Office/branch, planned/active/on-hold projects, fresh and historical/financial records, authorized and stale/unauthorized links, and separate concurrent Start/delete sessions. Verify Web, Android and iOS independently, including feeds, direct reads, aggregate counts, history/evidence and Realtime. The Task remains readable under its original policy throughout; only Subtask exposure changes before parent Start.

No dedicated actors, writable fixture or staging target is approved for agent-run mutations. All hosted execution tests remain **BLOCKED**. Production application requires explicit approval; the agent has performed SELECTs only.
