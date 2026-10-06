# Mobile B — Core mobile UX

Status: cross-repository implementation plan; native files/framework require the Mobile A inventory. Baseline web/backend: `a16d36e`, 6 October 2026. See the [program index](README.md).

## Goal, dependencies and current state

Deliver Home, My Work, assigned tasks, task details, evidence, reviews, Inbox/notifications and necessary project/Office/invitation context on supported mobile platforms. Start after Mobile A's identity, task, evidence and deep-link contracts pass. Phase 13 informs personal discovery, Phase 12 informs inspector consistency and Phase 8B supplies visual/semantic decisions; use each mobile platform's appropriate controls rather than copy desktop DOM.

This checkout has responsive React web screens and browser smoke tests, not the native app. Reference `src/app/features/tasks/selectors/leadership.ts`, task/subtask services, `src/app/features/invitations`, `docs/mobile-phase-1-backend-handoff.md`, and web project-view/evidence/review acceptance tests. Inventory the actual native navigation, auth, data cache, detail, uploader, reviewer and notification modules before fixing source paths. Existing historical mobile rollout documentation is not a current native release receipt.

## Graphify and information architecture

Use focused maps of actual native screen/service consumers after that repository is supplied. Web Graphify is a reference for contracts, not proof of mobile reachability. Proposed primary navigation: Home, My Work, Projects, Inbox, More. More contains authorized secondary/account/help content. Project/Office context belongs in task/project details, not duplicated top-level destinations. Native search can begin with authorized data already available; any new aggregation/search endpoint is a separate contract decision.

## Small vertical slices and component changes

1. **Navigation shell and empty states.** Implement the agreed destinations using platform-native navigation, correct role visibility, loading/empty/failure states and logout/session recovery. Gate: each role reaches its authorized core destinations without hidden primary actions.
2. **Personal work lists.** Assigned, Leading, due/overdue and recently completed filters use the same underlying task records/semantics. Needs-review items preserve reviewer scope and separate Head/Task Lead powers. Gate: no duplicate task copies or private data leakage; date filters use agreed user/timezone behavior.
3. **Task detail and team context.** Reuse one native task-detail surface from work lists, project context and Inbox. Show Overview, Subtasks, Evidence, Discussion/Activity, Team and allowed review actions with progressive disclosure. Expose eligible task-team management only after G2 is resolved; Lead appointment and Responsible Office remain Head-scoped. Gate: returning to the origin preserves filter/list position and task identity.
4. **Evidence and progress.** Add accessible native picker/camera/file selection where supported, upload progress, cancel/retry and robust draft retention. Use Mobile A's immutable evidence and cleanup contracts. Avoid duplicate submission after a network/refresh failure. Gate: interruption/background/reconnect, unsupported type, oversize file, refused cleanup and stale work state all remain recoverable.
5. **Reviews and action Inbox.** Aggregate existing permitted decisions/notifications with explicit resource references; open the matching task/evidence/financial/invitation context. Local Inbox presentation must not merge approval services or give Head financial execution powers. Gate: two-client state changes settle to the server state; unauthorized/expired links show useful recovery.
6. **Project/Office and invitation context.** Show enough participating Office, project access, readiness and ownership information to interpret assigned work. Local Office identities are pending and non-executing until Phase 6.5 resolves them. Support deep links/login switching and return to the project Offices context. Gate: invited email/scope and permanent account identity remain unchanged.
7. **Native release rehearsal.** Test supported devices, accessibility, background/session recovery, constrained networks and compatibility with the current web/backend. Measure list loading, rerenders and upload behavior before optimizing. Gate: supported-platform acceptance receipts and store/distribution rollback procedure from the actual mobile project.

## Data/API, migrations and business guardrails

No database/RLS/business-rule changes. Consume Mobile A's verified public contracts and account/project/task capability distinctions. Missing feeds, offline conflict APIs, push-delivery features or local-identity mutations are gated backend proposals, not assumed capabilities. Raw PDS stays private; staffing recommendations remain advisory and Head-confirmed. Do not grant cross-Office staffing, Admin operational superuser access or financial approval/execution overlap.

## UI states, mutation validation and unsaved work

Every core list handles loading, empty, denied and retryable failure. Details handle deleted/revoked/stale entities. Inline low-risk edits save directly with feedback; never promise offline write synchronization without a tested idempotency/conflict contract. Level 2 team/ownership/access changes show impact; Level 3 destructive/authority-sensitive actions show blockers and strong confirmation. Protect dirty multi-field forms on close, navigation and background return; committed evidence is never treated as an unsaved upload.

## Responsive and accessibility requirements

Use supported native small/large screen and orientation layouts, safe areas, keyboard avoidance, touch targets and large text. Details and evidence remain usable without desktop tables or hover. Test screen-reader names, status announcements, focus, text contrast, reduced motion and accessible progress. Tablet layouts may show work list/detail together when useful. Mobile web responsiveness remains the separate Phase 18 web gate.

## Test plan and E2E acceptance

Run the discovered mobile project's standard unit, contract, navigation and device suites for each slice. Share fixtures/expected business outcomes with web tests rather than import browser-only components. Test signed-in Member → assigned task → progress/evidence → permitted submit → Task Lead/Head review on web → updated task on mobile. Test context switching, wrong account/invitation, observer/unrelated denial, revoked access, slow/lost network, app background/resume and protected evidence retrieval.

Record role × destination and role × action matrices for all four account roles plus contextual Lead/observer variants. Require accessible end-to-end completion on each supported platform; web-only screenshots do not satisfy the gate.

## Rollout, rollback, definition of done and out of scope

Release core navigation/read flows first, then evidence/review write flows behind independently reversible client rollout switches where available. Keep an older compatible release/distribution path and server-side evidence/history intact. Do not roll back by weakening backend checks.

Done when users complete the verified core work cycle from discovery through evidence/review with correct Office authority, useful failures, native accessibility and cross-client consistency. Out of scope: full desktop Gantt, large analytics/admin configuration suites, duplicating project stores, untested offline write queues, or claiming native delivery from this web repository.
