# R0 phase source/test register and coverage

Paths are repository-relative. This register bounds first-pass implementation context; search actual consumers before editing. Existing test names below were checked on the source baseline. **New tests** are future requirements, not tests added or executed by R0. Shared baseline commands remain check/test/build plus affected configured browser smoke; new backend authority requires genuine server/RLS evidence.

## Bounded phase scopes

| Phase | Initial source scope | Existing regression starting points | New acceptance / entry gate |
| --- | --- | --- | --- |
| R1 | `styles/foundation-tokens.css`, `workspace-foundation.css`; shared Vibe/workspace primitives; shell/navigation CSS, `RoleContent.tsx`, `projectsVibe.css` | Unit `workspaceFoundation`, `designSystemFoundation`, `vibeFoundation`; E2E `phase18-surfaces`, foundation/admin mobile suites | Content/sidebar last-row scroll at five widths, theme/contrast/tooltips/focus/zoom; preserve layer/dirty semantics |
| R2 | navigation role/sidebar/presentation/URL/permissions; shell Global/Mobile/WorkspaceNavigation; ProjectContextSidebar; preferences; guided tours/onboarding | Unit `navigationV2`, `navigationUrl`, `navigationActionAlerts`, `guidedTourCatalog`, `notificationNavigation`; E2E `navigation-v2`, `project-workspace-controls` | All retirement/default/caller mappings, persisted disclosure and scoped storage; no fake workspace capability |
| R3 | new `features/workspaces/` public API; shell context; project query/mutation adapters; memberships/auth/scope caches | Unit `navigationUrl`, `phase18ProjectCache`; E2E `phase10-project-workspace`, `phase65-office-identities` as Office compatibility baselines | New workspace/personal schema, own-scope allow-deny/backfill; no Office privilege/profile rewrite; routes/cache/realtime isolation |
| R4 | project-command catalog/header/participants/utilities/view menus/settings; ProjectCompleteDialog/sidebar; project-readiness resolution/panel/services | Unit `phase10ProjectWorkspace`, `projectViewNavigation`, `phase15ReadinessResolution`, `projectLifecycle`, `projectReadinessSummary`; E2E `phase10-project-workspace`, `phase7-readiness-staffing`, `phase15-ai-governance` | Removed IDs absent even with old preferences; enabled requirements/review/activate/governance resolution before old surfaces retire |
| R5 | project-table types/layout/editor hook/TimelineCell/TaskCells/group/toolbar/column header/SubitemRows | Unit `phase11Editors`, `phase11TableLayout`, `projectTable`; E2E `phase11-main-table`, `project-workspace-controls` | Save-close/failure retention, estimated-hours compatibility, compact absent-preference default, supported + catalogue, all group consistency |
| R6 | task-inspector; TaskDiscussion/TaskActivityTimeline; task/subtask progress/submission/review services; new scoped file adapter | Unit `phase12InspectorDrafts`, `phase12Evidence`, `phase12DialogFocus`, `phase12SubmissionDrafts`; E2E `phase12-shared-inspector` | New general-file metadata/storage guards; current text comments/evidence/privacy preserved; Updates/Files/Activity and essential contextual actions |
| R7 | project-offices membership/selectors/staffingAuthority/OfficeMembersEditor; teamMembership/taskTeamService; subtaskService/sequencing/deadlines; inspector/table/import/template adapters | Unit `taskTeamMembership`, `phase14StaffingAuthority`, `projectOfficeAuthority`, `subtaskSequencing`, `hierarchicalDeadlines`; E2E `phase6-project-offices`, `phase14-people-collaboration`; SQL `phase6-authority.py` | New narrow contributor/tree/lead APIs, depth 8/cycle/ancestry guards, own-Office selected roster/backfill, descendant review/rollup parity |
| R8 | invitation forms/types/services/AcceptInvitationPage; office-team retries; professional-profile; gateway invitation/service/email/config | Unit `phase14InvitationDrafts`, `phase14InvitationManagement`, `phase2Onboarding`; E2E `phase2-invitations`, `phase65-office-identities`; server `test_phase2.py`, `test_phase65.py` | New request/Head decision/project-member acceptance with no preapproval email/grant; actual provider receipt/verified acceptance/expiry and idempotency |
| R9 | ProjectUtilities/lifecycle; membership/staffing guards; new grants/removal/expiry adapters; invitation acceptance/download/realtime | Unit `projectLifecycle`, `projectLifecycleService`, `phase17StaffingSafety`; E2E `phase17-safety`, people/lifecycle suites; SQL Phase 6/7 authority baselines | Transactional complete impact removal, Viewer denial/Head grant, expired-session storage/realtime/read/write denial; no global account deactivation |
| R10 | personal-work selectors/workspace; navigation; authorized dashboards; subitem/history/report/inspector handoff | Unit `phase13PersonalWork`, `phase13PersonalFeed`, `phase13CheckedFeeds`, `notificationNavigation`; E2E `phase13-personal-work` | Retained personal data/filters/reviews/history; R3/R7/R9 for full workspace/descendant/revocation behavior |
| R11 | ProjectReportsTab/ProjectToolsInspector/ProjectActivityTab; activity service/command selectors/workflow facts; HeadReportsWorkspace/ReportsWorkspace | Unit `reportFormatting`, `projectFinancialReport`, `projectCommandSelectors`; E2E `phase16-support-finance`, `phase18-surfaces` | New cursor/snapshot/completeness/print >250 events, no empty-on-error or double-counted financial facts; R7 descendants included |
| R12 | administration workspace/styles/user management; organization/permissions/audit; SystemSettings/supabaseService; backup and redacted configuration adapters | Unit `adminAccountProtection`, `adminUserDirectory`, `auditPresentation`, `backupGatewayContract`; E2E `admin-unification`, `foundation-admin-directory`, `admin-mobile-dialogs`; server backup tests | Effective per-key consumer/validation/audit proof, readonly runtime/secret exclusion, support/operational separation; R8/R9 settings consumers |
| R13 | release configuration/current checklist/mutation registry; scoped candidate source and deployed artifact manifest | E2E `phase17-safety`, `phase18-release`, `phase18-measurements`, `phase18-rollback`; SQL/gateway authority suites | Genuine integration/privacy/roles, measured performance, supported scale/accessibility, ledger-safe hosted release and rollback |

`tests/unit/` entries use their existing `.test.ts` or `.test.tsx` suffix; E2E entries use `tests/e2e/<name>.spec.ts`; gateway tests are under `server/tests/`. SQL paths are fixture/rehearsal starting points, not permission to rerun hosted fixture writes during UI implementation.

## Complete request coverage

IDs match the roadmap's 33-item checklist. Every item has a phase, frozen contract and acceptance owner; none is marked implemented by R0.

| ID | Requirement / frozen contract | Owning phase(s) | Required evidence |
| --- | --- | --- | --- |
| 01 | Date picker closes on saved success, D01 | R5 | Persisted value/reload, failure draft, duplicate-save/focus |
| 02 | Estimated hours wording, D02 | R5 | Header/ARIA/import/group labels; unchanged IDs/payloads |
| 03 | Planning/Drafts/Waiting sidebar retirement, D03 | R2 | Old links/drafts/import/review recovery preserved |
| 04 | Verified sender/test-recipient restriction | R8/R12 | Operator configuration + actual controlled received mail |
| 05 | Invitation creation/delivery/PDS outcomes | R8 | Mixed rows/retry skip successful records |
| 06 | Delegated task/subitem members/leads, D10–D13 | R7 | Own-branch positive and sibling/ancestor/foreign denial |
| 07 | Owner invitation/Head approval/skills/type, D14–D16 | R7/R8 | Zero dispatch before approval; separate accepted membership/assignment |
| 08 | End temporary project access, D17 | R9 | Date/completion/archive/session/file/realtime denial; other memberships intact |
| 09 | Members in Add view | R7 | Real project roster, not duplicate Office-wide selection |
| 10 | No onboarded Office staff guidance | R7/R8 | All Offices empty-state and invite/add eligibility |
| 11 | Trailing Add column/icons/tooltips/compact defaults | R1/R5 | Searchable supported catalogue, saved preference parity, local width |
| 12 | Task details Updates/Files/Activity, D20 | R6 | Current execution/review/files remain; new general uploads scoped |
| 13 | Readiness/Offices header-strip removal | R4 | Strip absent; Offices/requirements still reachable |
| 14 | Participant avatars/name tooltips | R1/R4 | Mouse/keyboard/overflow/loading/name fallback |
| 15 | Head-only Viewer/member share, D18 | R9 | Authenticated bounded grant; viewer direct mutation denial |
| 16 | Reports/retained generic UI consistency | R1/R11/R12 | Surface states/theme and exported fact/total parity |
| 17 | Paged printable Activity | R11 | Stable >250 history, full declared print scope, source errors |
| 18 | Remove Workload & Team | R4 | Catalog/preferences/aliases/callers migrate |
| 19 | Full vertical scroll/no page-bottom gap | R1/R13 | Last actual content/sidebar item at supported viewports |
| 20 | Remove Readiness/Approval/Evidence/Decision views, D04/D21 | R4 | All old IDs retired; evidence/governance/closeout actions preserved |
| 21 | Completion reason and retained modal, D21 | R4/R9 | Enabled requirements path while Complete disabled; fresh server blocker tests |
| 22 | Remove Getting Started card | R2 | Banner absent, onboarding/profile/Help intact |
| 23 | Readable On track/Planning labels | R1/R4 | Semantic contrast in both themes; lifecycle status unchanged |
| 24 | Confirmed member removal unassigns, D19 | R9 | Cancellation zero writes; atomic all-descendant impact/conflict tests |
| 25 | Office tools persist/selection highlight | R2 | Tasks/Reports/reload disclosure and project-tree continuity |
| 26 | Sidebar Team Members retirement | R2/R7 | Project roster replacement/Office Team retained |
| 27 | Workspace selector/collapse/search/overflow/sections/icons | R2 | Keyboard/touch/scoped preference and expanded Projects behavior |
| 28 | Real personal workspace isolation, D06–D08 | R3 | New identity/placement/authorization, no unrelated LEDIPO project |
| 29 | Remove global Search item | R2 | Desktop/mobile removal; authorized workspace search retained |
| 30 | Own-Office selection current project only, D09 | R7 | Explicit selected membership/backfill and no other-project enrollment |
| 31 | My Work overhaul | R10 | Assignment/contribution/lead/date/history/inspector parity |
| 32 | Remove Home, workspace Overview | R2/R10 | All account landings, correct Office versus project totals |
| 33 | Admin takeover/configuration inventory | R0/R12 | Actual consumers/validation/audit/restart, secrets/runtime/support boundaries |

## Later capability acceptance matrix

| Capability | Positive case | Must-deny / failure case |
| --- | --- | --- |
| Workspace | Own personal scope create/select and Office context compatibility | Other user enumeration, fake Office/Head, stale cache, Admin operational escalation |
| Nested delegation | Current owner/Lead staffs its node and depth-8 descendants | Cycle/depth 9, cross-root/Office, sibling/ancestor replacement, revoked lead chain |
| Project roster | Own Head adds current-project personnel; existing assigned people survive backfill | Office-wide automatic enrollment, inactive/Observer staffing, removed lead-Office exception bypass |
| Invite request | Head-approved immutable terms dispatch once, verified identity activates project membership | Preapproval email/token/grant, altered approved terms, wrong/expired/revoked recipient, duplicate account, Office/role rewrite |
| Temporary access | Effective end checks without waiting for reconciler; restore needs reapproval | Active-session read/write, post-close redeem, stale signed downloads beyond documented limit, protected realtime event leakage |
| Removal | Complete confirmed impact transaction clears current assignments and membership | Cancel writes, concurrent new assignment, partial failure, erased authorship/cash/history |
| Share | Appointed Head recipient-bound Viewer/member grant | Anonymous bearer-link access, Viewer edit, Admin/Member issuer, Office/reviewer/finance escalation |
| Files | Current authorized project upload/link/read with stable retry | Raw PDS exposure, general file counts as approved evidence, source-link bypass, object orphan/duplicate |
| History/print | Stable page snapshot and complete filtered print/export | Latest-250 presented as full, duplicate merged fact, empty-on-error, unauthorized entity IDs |
| Settings | Allowed typed atomic audited key updates with real effect | Secret/runtime-owned/unknown keys, dormant control claimed effective, stale revision/partial apply |
| Completion | Requirements/review/activate resolution reachable and fresh final validation | Hidden blockers stranded, self-review, missing descendant evidence/cash/quorum, unauthorized direct modal/RPC |

## Phase entry and completion

R0 is a completed source/contract package. R1 may begin the shared presentation work; it must not implement later permissions by accident. For each capability phase, settle physical schema/endpoint schemas and verify deployed prerequisites before writes. Product policy is settled here; missing implementation/DDL/provider/hosting evidence remains that phase's gate.

Every future implementation slice has a before/after caller map, meaningful affected regressions, check/test/build, configured affected smoke, required server allow-deny proof, and reviewed graph refresh for structural changes. Preserve old contracts until consumers migrate. R13 must revisit the existing filtering/performance issue, actual screen-reader/zoom evidence, genuine expiration/cross-Office browser/email/privacy gates, and final artifacts/rollback. Web QA never certifies native delivery.
