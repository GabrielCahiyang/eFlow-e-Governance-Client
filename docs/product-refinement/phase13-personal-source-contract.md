# Phase 13 — Personal discovery source contract

Global My Work (`/my-work?page=My%20Work`) and Inbox (`/inbox?page=Inbox`) are additive destinations. All prior My Tasks, My Subtasks, Leading Work, Deadlines, Task History, For Review and Accounting paths remain available. Member, Head and Accounting Staff see My Work under existing task/leadership access. Admin receives personal Inbox updates without operational My Work or approval authority.

## Source and owner matrix

| Source | Scope and eligibility | Discovery and action owner | State / terminal handling |
| --- | --- | --- | --- |
| Personal tasks | `useCurrentUserTasks`: assignee, recommendation lead or team membership; RLS-visible task records only. Effective leadership uses `isTaskLead`, so a stale recommendation cannot replace the current appointee. | My Work opens the Phase 12 inspector by canonical ID. Domain task/Office/review/financial selectors own mutations; G2 remains gated. | Archived/cancelled excluded from active discovery, retained in existing History. Completed work appears in the recent bucket. Read errors are visible and retryable. |
| Task reviews | Existing `isTaskVisibleInReviewQueue` and `canUserReviewTask`: pending review, explicit reviewer/backup and existing self-review/Office Head finalization rule; no Admin authority. | `task-review:<id>` opens the shared inspector's existing review feature. | Realtime acceptance/withdrawal removes discovery. No universal Approve action. Source read failure does not clear other sources. |
| Subtask reviews | Existing pending submission query with `reviewer_id=current user`, never include-all; self-submission excluded. | `subtask-review:<id>` delegates to For Review's subtask owner with stable entity ID and legacy parent/label compatibility. | Checked reader reports submission/evidence/task/project errors. Stable-ID focus prevents same-label selection. |
| Funding, workplans, governance | Existing For Review/Budget/Collaboration authority and queues. No inferred personal ownership from unread notifications. | Explicit link to existing review queues; eligibility and counts remain there. Accounting release/settlement/journal remain separate. | No fabricated combined count or cross-Office recipient scan. |
| Recent updates | Existing notifications table; explicit `user_id=current user`, descending creation order, at most 50. Source schema has recipient SELECT/UPDATE policies in `supabase/fresh_schema.sql`. | Reuses notification destination/intent mapping. Opening never approves or marks read. Checked individual mark-read uses the same recipient-filtered update plus returned ID verification. | Denials and zero-row writes stay unread with error/retry. Missing tasks, unauthorized routes and ambiguous legacy subtask labels show explanations. Older results are outside this feed. |
| Invitations | Existing `listInvitations` and project invitation lists are management/project sources; accept/validate require a token. | Existing Invitations/project Office workflows remain owners. | No personal pending-recipient feed exposed in this UI release. |
| Mentions | Comment notifications have no reliable persisted mentioned-user identity contract. | Existing Discussion remains owner. | No fabricated Mentions category. |
| Readiness | Existing project-scoped `phase7_project_readiness`/closeout RPCs; requires project context and existing Head authority. | Existing project readiness controls remain owner. | No personal readiness feed inferred from role or incomplete project metadata. |

## Calendar and personal filters

All my work retains the established broad personal scope. Assigned to me includes the appointee and actual team members, but excludes recommendation-only matches. Leading uses the effective lead selector. Due today, Monday–Sunday current week and Overdue use the app's existing local-calendar parsing and exclude invalid/missing dates; Overdue means before today. Completed/cancelled/archived work does not appear in active due buckets. Recently completed means completed tasks last updated within today and the preceding six local calendar days: `updatedAt` is an explicit proxy because the Task contract has no dedicated completion timestamp. No new completion store or payload is created.

Search uses authorized task/project/Office context. Presentation filters are guarded while explicit inspector drafts exist. Shared inspector retains Office/project identity, G2, review routing, financial authority, nested focus, pending deduplication and dirty-form navigation. Delegated subtask progress/evidence and review feedback register with the same dirty/pending guard; failure retains typed fields. Stable focus/source IDs distinguish action kinds without conflating a task review with funding approval.

## Local checked-read extension

Existing service signatures/returns remain compatible. The task subscription adds an optional error callback; the current-user hook exposes retry. `fetchPersonalSubtaskReviews` opts into checked reads while the legacy pending-review reader retains its array/empty behavior. `fetchRecentNotifications` and `markRecentNotificationRead` are separate checked adapters; legacy notification subscribe/mark-read functions retain their contracts. No database, RLS, Python endpoint, workflow RPC or mutation payload changes.

Personal feeds refresh independently every 15 seconds and on window focus, coalescing refresh triggers while a slow read is pending. Cleanup and recipient/request sequence checks reject late results. These source boundaries expose honest loading/error/retry/empty states; they do not promise a durable all-action stream or cross-device preferences.

## G4 follow-on proposals, outside this release

A complete update stream needs an explicit cursor `(created_at,id)`, stable secondary order, recipient scoping, bounded page size, exact read-result contract and deletion/revocation handling, with recipient JWT/RLS tests and separate rollout receipts. A personal invitation feed must return only authenticated pending recipients, an opaque invitation ID, Office/project labels authorized for that recipient, expiry/state and a safe continuation; it must omit tokens, invited-person PDS and private profiles. Recipient matching and acceptance must stay server-owned. Mentions need stable user identity plus source/access/deletion semantics; quoted names are insufficient. Readiness discovery needs an explicit actionable owner, canonical linked Office identity and project visibility predicate. None of these proposals widens existing access or authorizes a migration during this UI phase.

## Verification boundary

SDK query behavior was checked against [Supabase select documentation](https://supabase.com/docs/reference/javascript/select); adapter tests verify recipient filters, returned IDs and database errors.

Browser validation uses the real frontend on port 5173 with synthetic intercepted auth/REST/gateway/realtime records. It does not certify hosted RLS. Native zoom and assistive-technology sessions are not run. Final delivery records actual passing receipts; earlier phase evidence remains untouched.
