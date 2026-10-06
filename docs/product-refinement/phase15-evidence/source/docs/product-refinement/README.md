# eFlow product refinement — implementation plan

Prepared 6 October 2026 against web/backend commit `a16d36e0b2c545c09a097801ff1345a26e39d030`. Source requirements: [the supplied agent brief](source-brief.md). These documents plan the work; they do not start implementation, deploy a migration, change permissions, or certify native mobile delivery.

The original brief is product direction and acceptance criteria. Existing source, tests and migrations establish current behavior. Where the two disagree, a decision gate is recorded instead of pretending the target is already delivered. This roadmap is distinct from historical files named Phase 8–10 under `implementation plans/` and from earlier Vibe overhaul phases.

## Start here

Phase 8A is implemented as a source audit and constrained IA freeze: [audit package](audit/README.md), [current-to-target map](audit/current-to-target.md), [decisions and gates](audit/ia-decisions.md), and [delivery receipts](audit/delivery.md). It includes the local Phase 6.5 source contract and fixture browser baselines; neither Phase 6.5 deployment nor unresolved authority/storage capabilities are implied. Later phases consume these artifacts before changing navigation or shared UI.

Begin with Phase 6.5's identity/authority ADR and Phase 8A's inventory. The identity correction is the recommended first implementation track; a source-only audit may proceed in parallel. Freeze the navigation and capability maps before broad UI migration. Do not make new project-local Office records until the identity contract, protected execution gates and compatible clients are ready.

If Phase 6.5 is postponed, explicitly record that choice: the UI program may proceed over existing canonical Offices, but must preserve pending named-Office intent and avoid hard-coding a directory-only product model. Resolve G2 before delivering any affected shared-project Task Lead staffing interaction.

Latest local UI implementation: [Phase 15 AI, PDS and governance delivery](phase15-delivery.md), following [Phase 14 People and collaboration](phase14-delivery.md). The next planned UI phase is [Phase 16 Admin, Accounting, Reports and Audit](phase-16-admin-accounting-reports-audit.md); unresolved authority/storage gates remain separate.

## Individual phase plans and dependencies

| Phase | Implementation plan | Dependency / release gate | Primary result |
| --- | --- | --- | --- |
| 6.5 | [Project-local Office identity](phase-6-5-project-local-office-identity.md) | G1; canonical authority/evidence preflight | Named Offices and proposed responsibilities can exist before directory linking. |
| 8A | [UX audit and IA freeze](phase-8a-ux-audit-ia-freeze.md) | Source baseline; full role/state inventory | Current-to-target screen, navigation, action and mutation maps. |
| 8B | [Design system foundation](phase-8b-design-system.md) | 8A component/token inventory | Shared tokens, adapters, focus/layer/state conventions. |
| 9 | [App shell and navigation](phase-9-app-shell-navigation.md) | 8A/8B; G3 | Global navigation and permission-aware workspace context. |
| 10 | [Project workspace](phase-10-project-workspace.md) | 9; 8B; 6.5 compatibility | One project header/context/view system. |
| 11 | [Main table](phase-11-main-table.md) | 10; G2 for affected staffing | Consistent dense editing, clear capabilities and accessible task actions. |
| 12 | [Project views and shared inspector](phase-12-project-views-inspector.md) | 10/11; shared inspector/layer gates | Canonical task data and inspector navigation across views. |
| 13 | [My Work and Inbox](phase-13-my-work-inbox.md) | 9/12; G4 | Personal cross-project discovery without merging workflow authority. |
| 14 | [People and collaboration](phase-14-people-collaboration.md) | 8B/10/12/13; 6.5; G2 | Clear Office/project/task membership and delegated team management. |
| 15 | [AI, PDS and governance](phase-15-ai-pds-governance.md) | 10/12/13/14; 6.5 | Progressive human-reviewed import, private PDS and actionable readiness. |
| 16 | [Admin, Accounting, Reports and Audit](phase-16-admin-accounting-reports-audit.md) | 8B/9/12/13/14/15; scope/service inventory | Cohesive non-project workspaces with existing authority separation. |
| 17 | [Validation and safety](phase-17-validation-safety.md) | Mutation inventory from 8A; shared patterns from 8B | Complete, tested risk/impact/dirty-state and retry coverage. |
| 18 | [Release hardening](phase-18-release-hardening.md) | 9–17 acceptance; current authority gates | Responsive, accessible, measured and cross-browser release. |
| Mobile A | [Contract alignment](mobile-a-contract-alignment.md) | G5; consumes 6.5/G2 as versioned contracts | A joint web/backend/native compatibility manifest with receipts. |
| Mobile B | [Core mobile UX](mobile-b-core-ux.md) | Mobile A; 8B/12/13 inform UX | Native discovery → task → evidence → review cycle. |

Use the table as milestone order, not as one enormous change set. Each plan breaks work into independently validated vertical slices. Mobile A can start with the existing canonical contracts now; new identity/staffing capabilities wait for their backend gates. Mobile B may build core read/navigation flows while later contract-dependent write flows are gated.

## Baseline to preserve

The latest application correction restored Create project with padding and its existing permission check. The sidebar Create work plan button remains removed. The main table has sticky first-column three-dot actions, no drag grips or trailing duplicate task action column. Task/subitem inline creation saves on blur, supports Shift+Enter, retains failed drafts and prevents duplicate saves. Add view menus are portaled and Board has a return path to Main table. These are regression targets, not backlog items to rebuild.

The immediately preceding implementation validation passed `npm run check`, 620 unit tests in 166 files, six affected browser checks and `npm run build`. Existing build circular-export/large-chunk warnings are Phase 18 investigation targets. The figures describe the last validated code slice, not a guarantee for future changes or all product routes.

The local Graphify map has 6,846 nodes and 20,666 clustered edges. Its report stamps predecessor `6995828c`; the latest restoration was reviewed in source. Six known parser warnings include `ProjectTaskRow.tsx` and several barrels. Focused queries identified affected modules; real source/migrations were inspected for permissions. No live database indexing or full graph dump was used. Documentation-only planning does not require rebuilding the graph.

Existing user edits to `.env.example`, `README.md`, `docs/phase1-delivery.md` and `docs/local-continuation.md` are outside this planning package.

## Decisions and gaps that must not be hidden in UI work

| Gate | Evidence and decision | Completion condition |
| --- | --- | --- |
| G1 — Office identity | Phase 6 participation requires a canonical non-null `office_id`; AI batch review already retains unmatched names. Choose the additive identity model or a coordinated nullable-participation model and define verified linking/Head authority. | Reviewed schema/API/compatibility ADR, role/allow-deny matrix, backfill/rollout design and isolated migration tests before implementation rollout. |
| G2 — Task Lead team authority | `phase6_guard_task` in `20261004174950_phase6_project_office_collaboration.sql` restricts contributor/team changes to the responsible Office Head; the follow-on shared-structure migration does not remove that restriction. Task team UI/services support contextual Lead edits. This conflicts with the target brief for shared projects. | Audit effective deployed guards/RPCs; deliver a separate narrow correction if confirmed. Task Lead may edit eligible contributors only for their own task, cannot self-replace or change Office, and cannot bypass unfinished-subtask removal blockers. Preserve Head appointments and cross-Office denial. Add SQL/backend and UI regressions; do not widen permissions during a UI refactor. |
| G3 — Workspace content | Current shell Office label does not establish a persisted workspace/folder/dashboard/favorites/search product model. | Identify actual available storage/services in 8A. Begin with supported Office/project context; persistence or cross-entity search needing new APIs is a separately scoped capability decision with ownership and contracts. No fake interactive creation entries. |
| G4 — Personal action feeds | Work/review surfaces exist, but complete mentions/invitation/readiness feeds and robust pagination/error behavior are not established for a new Inbox. | Wrap existing authorized sources first. Label available categories accurately; design missing adapters/API capabilities separately. Preserve partial-source failures and committed mark-read behavior. |
| G5 — Native delivery | Native app sources/manifests and current deployment receipts are absent from this checkout; the earlier mobile evidence handoff is not proof of current deployment. | Obtain actual mobile repo/SHA/tooling/platforms and a confirmed non-production environment. Freeze/version contracts and produce actual native + deployed-API acceptance receipts. |

G2 is a source discrepancy, not a claim that every deployed Task Lead workflow fails. Its narrow correction is separate from G1. Do not reinterpret Task Lead as a permanent account role or remove working leadership behavior elsewhere.

### G2 implementation slice, if the deployed discrepancy is confirmed

1. Trace the task-team editor → mutation service → effective RLS/trigger path and compare deployed definitions with both Phase 6 migrations. Freeze the exact contributor delta and the existing effective-Lead rule; keep owner/Lead appointment, `org_id`, project identity and unrelated team fields outside delegated contributor edits.
2. Add a new narrowly scoped migration/backend correction rather than editing historical migrations. Split contributor checks from the bundled owner/Lead/team-identity check; never add “or Task Lead” to the whole existing condition. Permit the active, authorized effective Lead from the existing `OLD` task row to change eligible own-Office/project contributors. Preserve existing Head/identity protections for `assigned_to`, `recommendation_lead_id`, `team_id`, `org_id` and project identity. Retain the follow-on shared-structure protections, lead retention and unfinished-subtask removal blockers. Direct writes and existing wrappers must enforce the same rule.
3. Prove positive and negative SQL/backend cases: own-task Lead adds/removes eligible contributors; foreign-task Lead, another Office, ordinary Member, observer, inactive actor and ungranted Admin are denied. Simultaneous contributor + Lead/owner/Office/team-identity changes, self-replacement and blocked removals remain denied. Keep Head and existing non-shared/governed workflows compatible. Rehearse migration and actual-user JWT checks in the explicit non-production environment.
4. Enable the affected existing team editor only after its server contract passes, then run its interaction and shared-project browser regressions. Record deployment/rollback receipts and update the Mobile A manifest. Rollback may disable the affected delegated UI flow while retaining stored team membership; it must not widen server authorization.

## Initial information architecture mapping

This is a starting hypothesis for 8A; the complete screen/dialog/state inventory must confirm every caller and destination before anything is visually retired.

| Current cluster | Target home | Treatment |
| --- | --- | --- |
| Overview and role landing | Home | Keep existing scope; consolidate personal summaries. |
| My Tasks, My Subtasks, Work I'm Leading, deadlines/history | My Work filters and contextual task details | Combine discovery; retain distinct permissions and mutation services. |
| Reviews, decision notifications, authorized invitations/actions | Inbox plus the matching task/financial/governance context | Aggregate discovery; preserve reviewer and approval/execution routing. |
| Projects context, portfolio, Main table and project views | Workspaces → Projects → project views | Canonical project data, filters, URL/history and shared inspector. |
| Team Supervision, Office Team, Identity & Access | Office Team and authorized administration/settings context | Preserve own-Office versus global administration boundaries. |
| Admin settings, accounts, Offices, audit and backup | Admin Center | No automatic operational project/financial authority. |
| Releases, liquidation/settlement and journal | Accounting workspace | Head authorization stays distinct from Accounting execution. |
| Office/project/personal/system reports | Scoped Dashboards or contextual Reports | Retire duplicate visual routes only after all consumers move. |

Target global navigation by account role remains conceptual and permission-aware: Member and Head use Home/My Work/Inbox/Workspaces/Search; Head additionally has own-Office Team/insights; Accounting Staff has its Accounting context; Admin uses Home/Inbox/Search/Admin Center. Help/Profile remain utilities. Existing explicit access/visibility rules win over a role-name shortcut.

## Delivery rules shared by every phase

1. Keep new application code under the owning `src/app/features/<feature>/` boundary, reusable controls in `src/app/components/ui/`, adapters/utilities in `src/app/shared/`, and cross-feature imports through public `index.ts` APIs.
2. For UI-only slices: **No database/RLS/business-rule changes.** Backend gaps become separate named capabilities; they are never solved by client-side authorization shortcuts.
3. Extend existing Vibe/Radix/workspace/motion adapters before introducing another parallel component system. Keep Figtree, teal identity, neutral surfaces, status text, visible focus and scroll affordances.
4. Preserve old navigation aliases, callers and service contracts until a tested canonical replacement exists. Remove legacy exports only after repository search proves no consumers remain.
5. Carry risk/dirty-state/async acceptance into every slice; Phase 17 audits completeness rather than delaying safety until the end.
6. Keep current data/role semantics in one source of truth. Head appoints a Task Lead; that Lead organizes eligible execution contributors for that task. Project access and account roles stay separate. AI advises; humans govern. Raw PDS remains private.
7. After structural implementation edits, run `npm run graph:update` and review extraction warnings. Do not overwrite a richer graph with incomplete extraction, enable live database introspection, or rebuild it for routine CSS/document edits.

## Validation and release gates

Every implemented slice runs `npm run check`, `npm test`, `npm run build` and the affected configured Playwright smoke tests. Small focused interaction tests precede broad checks; do not repeat passing tests without another change/failure. Plans name existing suites and proposed new tests separately.

| Area | Required acceptance evidence |
| --- | --- |
| Authority and identity | Four account roles plus contextual Task Lead, responsible/Lead/collaborating Office, observer, inactive and unrelated actors; direct API/RPC denied paths; existing canonical and governed workflows. |
| Navigation | Current → target route mapping, browser Back/Forward/deep links, role × route and role × action matrices; retained destination reachability. |
| Projects/table/views | Existing blur/Shift+Enter creation, failure retention, first-column menus, view switching/closing, Board return, shared filters and inspector origins. |
| Safety | Level 1 direct save/feasible undo; Level 2 impact confirmation; Level 3 strong confirmation/server blockers; dirty forms; committed success versus refresh/delivery failure; no duplicate retry. |
| Privacy and finance | Raw PDS denied outside approved self/backend workflows, professional summaries scoped, AI never assigns finally, Head authorization distinct from Accounting release/settlement/journal. |
| Responsive/accessibility | 320/390 px, tablet and desktop browser behavior; keyboard/focus/Escape, nested portaled popovers, text/status/contrast, reduced motion, localized scrolling; supported native device matrix separately. |
| Performance/release | Measured representative data sizes and baseline timings; no arbitrary virtualization or bundle rewrite; additional browser engines configured and tested; docs/deployment receipts synchronized. |

Phase 6.5/G2 also require isolated migration rehearsal, server tests and actual-user non-production authorization checks before deployment. Do not use service-role reads as proof of client RLS. Source files or stale handoff notes are not deployment evidence.

## Rollout and rollback policy

Implement one feature slice at a time with a reviewable change set and a specific return path. UI rollback restores an entry/rendering adapter while retaining stored data and authorization. Backend correction rollback must preserve existing records, tokens and audits; once project-local identities exist, prefer disabling new creation and forward-fixing mappings over destructive down migrations. No phase may roll back by widening permissions, dropping protected evidence or reviving legacy account roles.

## Definition of planning completion

This package contains one plan for each of the 15 requested phases/tracks, an ordered dependency index, current source evidence, decision gates, bounded Graphify guidance, small implementation slices, UI/API boundaries, authority and safety requirements, test/E2E acceptance, rollback and explicit exclusions. Missing native/deployed-state evidence is identified rather than invented. Application implementation, new inventory screenshots, migrations, deployment, commits and publishing this package are not part of this planning request.
