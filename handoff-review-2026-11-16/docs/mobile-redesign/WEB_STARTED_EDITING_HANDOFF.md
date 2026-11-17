# Portable Web implementation handoff — limited editing and Activity

**Latest extension:** read `docs/mobile-redesign/WEB_WORKFLOW_UX_DEPENDENCY_HANDOFF.md` for the newly approved date-neutral dependency linking, feedback/action placement, fresh ordinary edits and Start confirmation requirements. It is the root README of the updated archive. Earlier SQL below is reference material; the new dependency candidate has separate current hashes and is not installed.

User-approved requirements, 16 November 2026. Work in your own Web checkout. Read its AGENTS.md/current Git state and preserve unrelated changes. Inspect existing code before changing it. **Do not modify production, apply SQL, create fixtures, deploy or push without explicit approval.** This document and its archive need no access to another developer's local paths.

Extract the ZIP into a separate review directory, outside automated migration discovery. Paths below are relative to the archive root. Do not overlay Mobile reference code onto Web. Existing sources in your own checkout remain authoritative for Web implementation. Read the attached candidate and evidence; do not invent a parallel patch.

**Also finish the full contributor workstream in `docs/mobile-redesign/WEB_CONTRIBUTORS_HANDOFF.md`.** It contains the explicit own-Task/own-Subtask permissions, Lead exclusion/canonical IDs, separate appointment authority, overlapping appointments, required Web files, regression cases and current deployment evidence. A generic “preserve contributor behavior” instruction alone is insufficient.

## Behavior to implement

1. Apply limited editing to **both Tasks and Subtasks**, retaining current authorized editor appointments and scoped Office/branch permissions. Appointment as a worker/contributor alone is not general planning authority.
2. Before Start, preserve existing authorized editing and all existing independent restrictions. Do not infer no started history merely from `todo` or 0%.
3. After Start, allow an existing authorized editor to correct title/name and priority. Due date requires existing supervising/upper-Lead authority, reason (1–1,000 characters), and existing project/ancestor/descendant date validation.
4. Lock planned start, prerequisites, structure/order/sequencing and other planning definitions in ordinary editing after started history or started descendants. Do not add a new exceptional correction bypass. General details stay read-only while awaiting review, completed or cancelled; retain existing return/reopen workflows.
5. Preserve contributor management, independent appointment/Lead-transfer authority, Lead exclusion from contributor lists/counts, canonical compatibility IDs, evidence, financial commitments, dependency Start/Complete rules, blocker/Next-step handling and contributor proposal approval. A pending proposal must not look officially applied.
6. Preserve Task visibility. The separately approved Subtask parent-Start visibility, Delete-before-ever-started rules and nested Confirm/Cancel rules continue. Do not rebuild working Web staffing/delete/inline selector implementations.

## Shared editing contract (deployment observed; acceptance unverified)

Review `docs/mobile-redesign/backend-review/started-editing/README.md` and the full single-transaction `20261116030000_started_detail_editing_REVIEW.sql` beside it. The fragment `policy-body.sql` must not be executed alone. All baseline JSON is read-only evidence.

The earlier preparation checkpoint recorded the editing contract as absent. A newer SELECT-only handoff check now confirms that its schema/RPC exist and the two shared command/capability definitions match this candidate after newline normalization. Full installation/trigger/grant/RLS and real-workflow verification were not performed in this check. Do not blindly rerun either the earlier contributor patch or this guarded editing candidate. See the contributor handoff's current status summary; historical absent/original-hash evidence remains included as historical evidence.

- New authenticated read RPC: `work_detail_edit_state({p_task_id,p_node_id:null})` for Task editing. Response: `{version:1,task_id,node_id,updated_at,started,details,due,planning}`. Bind it to the current actor/record context; reject missing/wrong-record/unsupported responses. A missing RPC must show unavailable editing, not a JavaScript permission bypass.
- Office Subtask snapshots include `node.detail_edit` with the same fields, plus existing verified `capabilities.edit_details`. Both field policy and current capability matter. Do not replace server denials with local status heuristics.
- Recheck the specific capability, actor, current status/revision and changed fields immediately before saving. For Task due changes, existing `phase3_patch_task` and `edit_selected_project_task` receive `p_patch.change_reason`; unchanged fields need not be resent. Keep the old endpoint's narrower field/permission restrictions.
- Subtask edits retain `r7_work_command`/existing command service, revision, impact/history checks and original request ID. Use `payload.note` for schedule reason and preserve `due`/`start`/`standalone` terms as required by the existing editor. The candidate only permits Office edits that pass field validation; it does not loosen Personal structural commands.
- Keep saved drafts and original terms on unknown outcomes. Check existing receipts before an uncertain retry; a committed request can be confirmed after mutation authority disappears, while an uncommitted retry must recheck current editing/due/planning authority. Do not create a new request merely because a response was lost.
- Table triggers enforce the definition policy for old clients/direct UPDATE routes. Existing contributor, finance, evidence, date, impact, approval and visibility guards remain. Do not disable them to make a test pass.

The SQL guards exact hashes of 20 current functions and replaces five functions: `public.phase3_patch_task`, `eflow_r9.edit_selected_project_task`, `eflow_r7.operation_capabilities`, `eflow_r7.command`, `eflow_r7.snapshot`. It creates a private policy/audit helper schema and guarded public read wrapper; no record backfill or Realtime/RLS/production config change is included. Stop for review if a hash differs. Do not reapply the earlier contributor migration.

## Activity

Task saves write one atomic `task_activities` record with `type='work_details_edited'`, stored author/time and metadata:

```json
{"version":1,"fields":[{"key":"priority","label":"Priority","before":"medium","after":"high"}],"reason":"Approved reschedule, when applicable"}
```

Render the recorded labels/old→new values and reason. Preserve legacy content fallback when metadata is absent. Never reconstruct an unknown old value from current rows, and never log a cancelled draft or failed save as completed. Keep existing project field history; this new event supplies Task Activity.

Subtask edits continue through `work_tree_events` before/after snapshots. Extend the Web event presenter for priority, start date, explicit prerequisite IDs (`null` means legacy sequential; `[]` means none) and `due_date_change_reason`, as well as existing fields. Use names recorded in the event snapshots; show unavailable historical details honestly. Keep proposal submission, approval and actual application separately authored.

Native reference files under `mobile-reference/` demonstrate the behavior and regression scenarios; they are not drop-in Web components or runnable standalone Web tests. Inspect Web's existing Task editor, schedule controls, `WorkTreeEditor`, capability selectors, mutation recovery and Activity readers/presenters, and adapt those working paths with the smallest changes.

## Checks and acceptance

Add Web regressions for before/after Start, immutable started history, started descendants, name/priority correction, due-date reason/supervisor checks, review/completion locks, unchanged legacy payload fields, permission revocation, independent contributor/appointment rights, no-op/failed/cancelled edit history and receipt recovery. Run Web's required checks/tests/build and relevant browser smoke tests.

The attached SQL runner uses disposable PGlite and captured real function/guard bodies with synthetic scope/identity/history helpers. It passes 50 assertions for LF and CRLF input. To reproduce, from the extracted root set `EFLOW_WEB_SOURCE` to your own checkout with an existing `@electric-sql/pglite`, then run `node scripts/verify-started-editing-review.mjs` and again with `--crlf-sql`. This does not establish full-schema staging, real RLS/roles, concurrent sessions or device acceptance.

Stage the complete schema/trigger graph and test real authenticated roles before recommending production. Proposed actors are Cheryl (Office Head/automatic Project Lead), Andres (Task Lead), Crisostomo (Subtask Lead/contributor), with Gabriel optionally an unrelated reader for denial tests. Accounts and disposable non-financial fixtures still require user approval and normal protected login; no passwords or bypasses. Do not mutate capstone data.

Return exact changed files and PASS/FAIL/BLOCKED evidence. Separate implemented source, automated checks, installed SQL and real authenticated workflow results. The Mobile agent did not change Web or production. The Mobile review APK compiled; observed backend definitions do not establish end-to-end acceptance.
