# R3 additive workspace schema and API review

Date: 2026-10-07. Scope: local implementation for D06–D08 and R3. The pending migration is `supabase/migrations/20261007120000_r3_personal_workspaces.sql`. This review and the disposable PostgreSQL tests do **not** constitute hosted deployment or acceptance. The sole continuation target remains `ixnfphgjyelhckjwjkdv`; its installed timestamps must be preserved using the Phase 6.5 live addendum's isolated migration procedure.

## Physical isolation and authority

`workspaces` records either an Office with `id = office_id` and no personal owner, or a personal workspace with an owner and no Office link. A check constraint forbids mixed kinds or dummy Office links. An Office name follows its real organization. Office visibility still requires the existing `can_see_project` contract; placement never grants project access.

`office_project_homes` contains exactly one mapping per existing Office project. `personal_projects.workspace_id` is its single authoritative personal home. The stores are separate: personal project/task/progress/review writes never enter `projects`, `tasks`, `subtasks`, project Offices, evidence, budgets, cash, or proposal imports. Cross-store UUID guards prevent a request ID from aliasing a legacy project/task/subitem identity in either direction. Existing Office public operations and return types are unchanged.

Personal workspace ownership belongs to the current authenticated, verified, active Head, Member, or Accounting Staff identity. Admin, anonymous, inactive and unverified identities are denied. Every operation uses `auth.uid()`, not a supplied actor, role, or Office string. Personal ownership never changes a profile's role or canonical Office.

`workspace_members` grants workspace discovery/selection; it does not grant access to every project. `personal_project_members` separately selects each authorized project and Viewer/Member access. Both state checks apply immediately on every server read/write. Owner membership cannot be removed through the API. Workspace owners create projects and staff root work; a Member executes only work where they are the appointed lead, or reviews only work where they are the appointed independent reviewer. A Viewer cannot mutate anything and loses access at project close. Selected internal Members are permanent and retain authorized closed-project history. Access-end dates, external invitation/share redemption and engagement terms remain R8/R9 work; R3 does not expose a dispatch or token path.

Already onboarded eligible candidates are restricted to the owner's canonical Office plus self. No-Office owners can work alone; they cannot use ownership to browse an unrelated directory or send invitations. External members require the later designated sponsor Head workflow in D15/D18. Existing Office invitation endpoints are not repurposed.

## Backfill and legacy compatibility

1. Create one Office workspace for every canonical organization, using the existing Office UUID. The Office is selectable only when active and authorized.
2. For each existing project, use its canonical `projects.org_id` when present, regardless of collaborating/observer Offices.
3. If `org_id` is absent, use a **single joined lead Office** as the deterministic fallback. Collaborating/observer relationships are not a home. Current participation also enforces at most one lead.
4. If there is no unique authoritative home, preserve the entire record and write `eflow_r3.backfill_exceptions`. Retain its pre-existing authorized visibility rather than guessing a home or deleting it. Review/resolve the canonical legacy relationship through an approved Office operation before declaring the exception resolved.
5. Existing projects/tasks/participation records are never rewritten. New Office projects get a home in the same transaction through an additive trigger. Existing ID, grant, task, evidence, budget, import and integration relationships remain intact. Name changes synchronize Office workspace names.

Office selection includes authorized home projects, joined/awaiting-Head participating Office projects, accepted project-local contacts, and unresolved legacy exceptions. Every row still passes existing `can_see_project`. Shared Office participation remains independent of home identity. Shared Office contexts expose their projects; Office tools/creation remain in the user's own canonical Office context with their original permissions.

`personal_project_shortcuts` is an explicit owner-created pointer to their own Office workspace. It retains the original project ID and personal home. A shortcut grants **zero** access to other Office users, including the Head. Only an already authorized owner/project member can see it; opening it changes to the personal home before displaying work. Removing the shortcut removes only the pointer.

## Versioned API

All RPCs are authenticated-only, security-definer functions with an empty search path and current-actor checks. Private helpers live in `eflow_r3`, which is not a public REST schema. New public tables allow RLS-protected SELECT only; direct INSERT/UPDATE/DELETE is denied. Mutations use the following distinct RPCs:

| RPC | Request | Response / invariant |
| --- | --- | --- |
| `r3_list_workspaces` | none | Array of available workspace records, including kind, owner name, Office link, state and timezone |
| `r3_select_workspace` | `p_workspace` UUID | `{workspace, projects}` with each project's kind, home UUID and optional shortcut marker; rechecks selection and row rights |
| `r3_create_workspace` | `p_request` UUID, `p_name`, `p_timezone` (default Asia/Singapore) | Committed personal workspace; workspace and mandatory owner membership are one transaction |
| `r3_create_personal_project` | `p_workspace`, `p_request`, `p_title` | Committed personal project; one home and mandatory owner project membership in one transaction |
| `r3_personal_project_snapshot` | `p_project` | `{project, owner, tasks, members, shortcuts}`; membership eligibility is current, not a UI calculation |
| `r3_personal_member_candidates` | `p_project` | Eligible own-Office `{id,name}` records; owner-only directory operation |
| `r3_personal_project_command` | `p_project`, `p_command`, `p_payload`, `p_request` | Durable mutation result with current rights, project lock, retry receipt and immutable personal work event |

Command payloads:

| Command | Fields | Authority / validation |
| --- | --- | --- |
| `set_member` | `user_id`, `access` (viewer/member), `state` (active/ended/revoked) | Owner; eligible onboarded own-Office identity; no unfinished assignment removal/downgrade until staffing resolved (transactional unassignment is R9) |
| `create_task` | `title`, `lead_id`, nullable `reviewer_id` | Owner; active Member lead and optional **different** active Member reviewer |
| `staff_task` | `task_id`, expected `revision`, `lead_id`, nullable `reviewer_id` | Owner; unfinished task; reopening a submission preserves history and requires resubmission; required independent review cannot be waived |
| `progress_task` | `task_id`, expected `revision`, `progress` (0–100), optional `note` | Current active task lead; todo/in-progress work only |
| `submit_task` | `task_id`, expected `revision`, optional `note` | Current active lead; active required reviewer; pending review or personal done when no review is required |
| `review_task` | `task_id`, expected `revision`, `decision` (approve/reject), optional `note` | Appointed active independent reviewer; current submitted work; never the submitter; no Head/finance authority implied |
| `complete_project` | empty object | Owner; every task done and every required review finished |
| `archive_project` | empty object | Owner; completed personal project only |
| `shortcut` | `office_workspace_id`, `enabled` boolean | Owner; their canonical Office only; does not create membership |

Names/timezones/notes/progress and membership terms are validated server-side. Creation request UUIDs retain the committed identity; changed retry terms conflict. Consequential commands serialize on the project and use actor/request receipts; a known committed retry returns its receipt after current access validation, before stale revision checking. A conflicting payload cannot reuse the receipt. Statement failure rolls back the mutation, receipt, event and membership together.

## Sessions, preferences, files and Realtime

The route's `workspace` UUID takes precedence over account-local current/recent IDs. Selecting a new workspace goes through the shared dirty/pending navigation guard and clears old project/view/planning/task/inspector parameters. Reload and Back/Forward retain the explicit workspace. A committed creation navigates using its returned identity and is not recreated if a subsequent refresh fails.

Authorized account-level Inbox, Accounting and administration/support destinations remain discoverable. Their navigation returns to the user's canonical Office in the same guarded history operation as the destination change. Opening a personal shortcut likewise changes its home and project atomically; an old mounted Office project listener cannot replace the new selection. Known committed Office creation receipts bridge workspace-list refresh latency without admitting unconfirmed project identities.

Workspace snapshots have no global cache. They are keyed by actor/workspace, reject late responses, clear rows on scope switch or read denial, and refresh every 15 seconds and on window focus. Personal project snapshots additionally check the returned home UUID. Revocation is immediate at the server; the ordinary active UI discovers it on the next poll/focus/request (target maximum 15 seconds under a working connection). Network/read failures clear the displayed snapshot and show an error. Favorites/sidebar disclosures/table layouts/view filters are actor/workspace/project scoped; legacy Office presentation preferences seed the new keys. Project command caches include workspace identity; existing Office project/task caches now reset and discard late reads on auth changes. Shell-owned Office subscriptions stop while a personal workspace is active; account-level notifications retain their existing authorized Office workflows.

No personal table is added to `supabase_realtime`. Personal reads poll the authenticated RPC, so there is no stale personal Realtime payload/DELETE channel. No personal file bucket, signed URL or upload adapter is introduced before R6. Personal UUIDs have no legacy Office evidence/finance identity, and cannot reach those existing APIs through an ID collision. Raw PDS remains private. Files and hosted Realtime transport acceptance cannot be claimed from mocked browser tests.

## Rollback and hosted gate

The transaction is all-or-nothing: installation failure leaves no partial schema/backfill. Before future hosted installation, populate an isolated migration workspace from the **live** ledger, inventory backfill exceptions, verify the current schema dependencies, and apply only this reviewed pending migration with an appropriate new live timestamp. Do not push the historical repository folder or repair installed timestamps. R3 has not been deployed.

For a reversible capability rollback, deploy the R2 frontend and transactionally revoke authenticated execution of the seven public `r3_*` functions plus SELECT on the eight new public tables. Leave the additive records, receipts, history, backfill and ID guards intact. This stops new personal reads/writes without deleting user work, changing Office profiles, or altering legacy APIs. Re-enable only after revalidation. Physical schema removal requires a separately authorized, verified export of personal work and a reviewed dependency inventory; `DROP ... CASCADE` is not the ordinary rollback. The SQL verifier tests capability revocation while existing Office creation still succeeds.

`npm run verify:r3-workspaces` exercises the actual migration on disposable PostgreSQL seeded from the deployed Phase 1 fixture plus Phase 2–7/6.5 SQL. It switches to `authenticated` for real table RLS and invokes the public API for negative and positive cases. Browser tests cover presentation/interaction with synthetic intercepted records. Neither touches hosted accounts or live migrations.
