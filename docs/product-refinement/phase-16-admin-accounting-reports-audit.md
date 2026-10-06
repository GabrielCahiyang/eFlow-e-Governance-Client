# Phase 16 — Admin, Accounting, Reports and Audit UX

Local implementation delivered 6 October 2026: [delivery and validation](phase16-delivery.md), [preserved contracts and API gate](phase16-workflow-contracts.md), [frozen evidence](phase16-evidence/evidence.json). This is a UI implementation receipt; deployed authorization and the additive Audit API remain separate.

## Goal and dependencies

Apply the shared eFlow workspace/table/inspector system to non-project areas, consolidate navigation and make scope and financial authority explicit. A common visual shell must not imply common permissions.

Requires the Phase 8A route/action inventory, Phase 8B primitives, Phase 9 global/role navigation and Phase 13 Inbox handoffs. Reuse the shared task inspector from Phase 12 for authorized report drill-through. Phases 14/15 supply consistent people, profile and governance presentation. Implement Admin and Accounting in separate slices because their authorization and data scopes differ.

Baseline: repository `a16d36e`; no tests were run for this planning document.

## Repository findings and source map

| Area | Existing contract | Planned direction |
| --- | --- | --- |
| Administration | `src/app/features/administration/components/AdministrationWorkspace.tsx` already combines All Users, Role Defaults, User Access, Office Structure, Account Audit, System Settings and Backup & Export, filtering tabs with `can(...)`. `navigation/RoleContent.tsx` routes Admin into administration rather than operational workspaces. | Rename/group presentation as Admin Center, keeping authorized destinations and old-link resolution. Do not build a new operational Admin dashboard. |
| User management | `components/user-management/UserManagement.tsx` swaps Users/Role Defaults/User Access and can drill into an account's access. `selectors/adminAccountProtection.ts`, leadership services and tests protect the last active Admin and appointed leadership. | Use people table plus inspector; preserve reasons, role defaults versus individual overrides and existing account/Head constraints. |
| Accounting | `features/role-accounting/AccountingStaffContent.tsx` maps current section IDs to `features/budget/components/AccountingStaffWorkspace.tsx` views: overview, releases, journal, audit and budgets. It is Office/fiscal-year scoped. Releases currently also contains the settlement queue. | One Accounting workspace with those canonical views; split a Settlements view only as a presentation of the existing queue, never a new settlement lifecycle. |
| Journal | `GeneralJournalWorkspace.tsx` filters entries by date/classification/search, shows debit/credit balance and permits adjustment only with `accounting.post_journal`. | Keep line detail, balance precision and existing adjustment validation. Improve display/inspector semantics rather than recalculate postings. |
| Settlement | `AccountingSettlementQueue.tsx` requires Accounting role plus explicit permission, blocks self-related funds, and waits for Head authorization for late packages. | Surface these reasons on a contextual review summary and one deliberate settlement action. |
| Office reports | `features/reports/components/HeadReportsWorkspace.tsx` uses permission-scoped analytics, seven report lenses, filters, CSV/PDF export and task drill-through. `components/workflow/ReportsWorkspace.tsx` remains another caller/surface to map. | Present personal/Office/project/system scope visibly and combine equivalent destinations only after caller/data comparison. |
| Account audit | `features/audit/components/AdminAuditLog.tsx` subscribes to latest 500 events, applies local search/action/entity filters and renders `AuditEventFeed` plus `AuditDetailDrawer`. `src/app/services/auditService.ts` supplies filtered reads and redaction. | Convert feed to table with detail inspector, retaining truthful “latest 500” coverage until pagination is supplied. |
| Backup | `features/administration/services/backupService.ts` and `components/data-tools/*` already expose preflight, mode, confirmation/passphrase, job polling/download/delete and gateway-unavailable guidance. | Adopt shared states without changing backup contents, cryptography or authorized routes. |

Relevant authority evidence: `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql` separates late-package Head authorization from Accounting settlement, checks independent settlement and narrows Admin audit RLS to administrative entity types. It sets Admin financial/operational defaults false. Read the complete migration chain and current handlers before any authority-affecting implementation; older legacy function comments are not proof of current access.

Graphify question used: `npm run graph:query -- "Admin Accounting reports audit governance proposal AI recommendation"`. Future focused questions: `AdministrationWorkspace` navigation callers; `AccountingStaffContent` section mapping; `HeadReportsWorkspace` and legacy report consumers; journal/audit service subscriptions and shared primitives. Use results to choose files, then inspect source. Update the local graph after structural moves; no full graph dump/rebuild is needed.

## Information architecture and component changes

- Global Admin Center contains People, Offices, Roles & Access, Audit, System and Backup. Roles & Access retains separate Role Defaults and Individual Access views. Administration links remain compatible adapters until all callers/tours migrate.
- Global Accounting contains Overview, Releases, Settlements, Journal, History and the existing budget ledger context where authorized. Needs Action is a filtered discovery view or Inbox handoff, not another financial engine. Name “settlement”, “liquidation”, “release” and “journal” according to existing business statuses.
- Reports use a visible scope label/breadcrumb and filters in the relevant Home/My Work, Office or project workspace. Keep export actions and existing report lenses; do not create a global catch-all report viewer. A task opened from a report gets the same permission-aware inspector as its project.
- Audit has actor, action, resource, authorized Office/project context, timestamp and details. Account Audit and Financial History may share table primitives but remain distinct datasets/permissions; no combined query that expands Admin visibility.
- Extract small feature-owned renderers/inspectors as needed. Shared table/dialog/toolbar/status controls belong in `components/ui`; budget rules and report selectors stay in their features and cross-feature imports use public `index.ts` APIs.

## Small vertical slices

1. **Scope/caller compatibility map.** Freeze old route/section IDs, permission keys, tabs, report lenses and export formats. Add table-driven tests for route→canonical-view and account-role/project-access distinctions. Check that valid old links still reach the equivalent authorized view.
2. **Admin shell and People.** Reframe existing tabs under Admin Center and move account detail/edit/access into the standard inspector/dialog patterns. Preserve server validation and last-active-Admin/leadership blockers. Check permission-denied pages, disabled actions with reasons and unsaved account/access edits before tab/route changes.
3. **Offices, access and support tools.** Migrate existing Office Structure, Role Defaults/User Access and System/Backup layouts separately. Keep effective-access explanations and backup preflight/job outcomes. Check unavailable gateway, expired archive and failed job retry without implying success.
4. **Accounting workspace navigation.** Present the existing view mapper as workspace tabs; make Office/fiscal year persistent context and settlements discoverable. Preserve Members' normal workspace access when Accounting Staff leave the financial area. Check Office-unassigned state, permission revocation and fiscal-year changes.
5. **Financial action detail and confirmation.** Introduce impact summaries for release, Head authorization, settlement and adjustment from existing facts. Show recipient, amount, evidence/version, previous authorization, accounting effect and remaining server-enforced limits. Keep one in-flight operation and refresh canonical state after success/ambiguous failure. Check Head cannot execute settlement even with a UI permission override and Accounting cannot authorize funding.
6. **Scoped report presentation.** Move one report lens at a time to shared tables/filter bars, retain export metadata and use the shared inspector. Validate filtered totals/export rows against existing selectors; warn when source facts are incomplete and offer refresh. Retire a duplicate destination only after its actions/links are mapped and no consumers remain.
7. **Audit table and scale gate.** Replace the feed renderer with shared table/detail inspection and explicit coverage. Add authorized actor/Office/date filters using available service inputs. Preserve redaction and append-only history. Implement true pagination/error-aware reads only through the separately reviewed additive service gate below.

Each slice must pass `npm run check`, `npm test`, `npm run build`, configured affected Playwright smoke and appropriate Graphify refresh after structural changes.

## API/migration impact and capability gates

**No database/RLS/business-rule changes.** Keep financial RPC arguments/returns, settlement precision, fiscal-year/time rules, permission keys, export data contracts, account protection and append-only audit behavior. UI-only grouping requires no migration.

`fetchAuditEvents` currently catches errors and returns `[]`, so the consumer cannot distinguish a failed read from a genuinely empty audit. It also exposes a limit rather than an explicit cursor/count contract. Do not claim complete history or render fictitious failure status from this shape. Gate a separate additive audit read operation with explicit success/error and stable cursor semantics, preserving old callers/return contracts; review existing audit RLS, indexes and ordering before proposing it. Never silently change `fetchAuditEvents` to throw. Office/project labels may be unavailable under Admin's account-only scope; show permitted identifiers/context rather than fetch unauthorized operational records.

Other missing report/backup capabilities need a named API decision with security tests; this phase does not implement new exports, remote storage, restores or finance endpoints. No new administrative bypass/service-role client code is acceptable.

## Authority, states and mutation safety

Admin manages accounts, Office records, defaults/access, audit/system/backup; global Admin is not Head, project manager, staffing authority or financial approver. Heads act on own-Office operational responsibilities; Task Leads remain contextual own-task execution managers. Accounting Staff executes authorized releases/settlements/journal within assigned Office and independent-person rules; Head authorization remains a different step. Project observers remain read-only. Raw PDS never appears in ordinary administrative/team/report exports; AI report briefs are advisory and contain only the report's permitted data.

| State | Required UX |
| --- | --- |
| Initial/refresh | Scope-labeled skeleton; retain rows during refresh; show partial source failure instead of silently treating unavailable facts as zero. |
| Empty/filter empty | Explain no recorded items versus no matching items, clear filters, and offer only authorized creation/action routes. |
| Pending/success | Per-record loading labels and stable confirmation; refresh to an authoritative receipt/status/reference, not a toast alone. |
| Failure/retry | Keep form values and decision reasons; show validation, authority, stale-version, limit, missing service or network problem distinctly. Verify uncertain financial/backup result before offering resubmit. |
| Disabled | Explain awaiting Head authorization, self-settlement prohibition, missing accounting permission/Office, unbalanced journal, backup preflight or last active Admin. Link permitted resolution paths. |

Level 1: search/view preferences and ordinary reversible edits, direct save/feedback. Level 2: supported profile/Office assignment and access changes, with before/after and affected-access preview. Level 3: account deactivation, Head removal, destructive backup deletion, financial authorization/release/settlement/posting and irreversible governance decisions, with strong consequence summary and existing server validation. Typed confirmation is appropriate for severe deletion/backup modes where existing contracts demand it, not every report filter. There is no Undo for immutable financial postings; correction follows existing adjustment/correction workflows.

Dirty guards cover multi-field account/access/system forms, fiscal budget/adjustment lines and unsaved review reasons; trigger on close/Escape/outside click, view/Office/fiscal-year change, route or browser back. Saved filters need no guard. Busy financial operations cannot be submitted twice, and failed mutations retain a reviewable draft.

## Responsive/accessibility and acceptance tests

Desktop uses dense tables and inspectors; tablet keeps fiscal-year/Office scope and important action summaries visible; 320/390 px uses labeled record summaries or contained table scroll and a full-height inspector. Do not squeeze financial line items into unreadable text or hide totals/actions below unreachable footers. Table headers, numeric column labels, currency formats, status text, focus order, keyboard filters/menu use, dialog traps/Escape/focus return and reduced motion are acceptance criteria. Live progress and inline field errors need appropriate screen-reader announcements.

Retain `tests/unit/adminAccountProtection.test.ts`, `adminUserDirectory.test.tsx`, `adminTaskReadOnly.test.ts`, `adminProjectReadOnly.test.ts`, `accountingRoleNavigation.test.tsx`, `accountingSettlementAuthority.test.tsx`, `accountingJournal.test.ts`, `financialReviewSwitch.test.tsx`, `departmentReports.test.ts`, `projectFinancialReport.test.ts`, `reportFormatting.test.ts` and `auditPresentation.test.ts`. Add behavior tests for route adapters, audit failure versus empty, filter/export equivalence, dirty view changes and uncertain-result retry. Extend `tests/e2e/admin-unification.spec.ts` and deterministic replacements for development-account-dependent `admin-mobile-dialogs.spec.ts`; add isolated Accounting workspace paths. Relevant server/SQL authority fixtures remain required when exercised, including Admin and financial protection.

E2E: Admin→People→access edit/cancel without operational controls; last active Admin/appointed Head blocker; Accounting→release→liquidation→late-package Head authorization through Head session→independent settlement through Accounting session→balanced journal; unauthorized/self settlement rejected; report filters→export match→authorized task inspector; Audit filters/detail retain redaction and account-only scope; backup preflight→failed job→explicit retry. Exercise backend rejection and narrow-phone keyboard use, not only screenshots.

## Rollback, done and exclusions

Revert renderer/navigation adapters per workspace slice without touching account/financial/audit data. Keep old-route compatibility until source search and tests prove callers migrated; do not retain two equivalent canonical UIs indefinitely. Done means every existing supported destination/action remains reachable under the same scope, financial separation is observable and enforced, report exports match current selectors, audit coverage is truthful, error/dirty/disabled states work and documentation/tours align. Exclude finance policy, accounting formula/status changes, Admin operational elevation, unrestricted reporting/PDS exports, new backup/restore architecture and RLS/schema rewrites.
