# Global UI/UX simplification — P4 implementation receipt

14 October 2026, Asia/Singapore. Baseline Git HEAD: `545245e353ad04ac47e24f95a71e06cf736ca0f8`. P0–P3 working changes are preserved. P4 is implemented and locally verified; all changes remain uncommitted. No push, deployment, migration, hosted database change, real financial/account operation or business-authority change was performed.

## Corrected behavior

- Existing Workspaces navigation now organizes supplied authorized Office tools under noninteractive Office, People and Reports headings. Office Team appears once as a destination; Team Supervision, Identity & Access and Team Intelligence remain distinct. The single Office task entrance is named **Office tasks**. Existing multipage task compatibility labels and callback values remain unchanged. Personal workspace tools retain their existing presentation.
- **Find pages and projects** replaces the misleading Search workspace label. Its overflow duplicate is removed. The dialog states its authorized-page/loaded-project scope once; authorization filtering, canonical project IDs, 50-result limit, loading notice and navigation guard are unchanged. Workspace-switcher search remains its separate list filter.
- Office Budget retains one rail destination and **one grouped local view picker** for all nine existing modes. Fiscal year, URL/history restoration, preparation, funding, request, settlement/release, expense, voucher, journal and trail owners remain intact. Head reads are not redirected into Accounting-only destinations. Accounting's embedded Budget continues receiving the supplied FY.
- A failed initial Budget read now shows an unavailable state and retry instead of claiming that no annual budget exists. Successful empty reads retain the authorized create entrance. Pending counts remain explicitly unavailable on read failure. Existing saved-data and annual-editor ownership is preserved.
- Office Team and People surfaces use current token colors, the existing WorkspaceHeader, compact spacing and truthful search-field labels. Long Office names, names/emails and status badges wrap appropriately. Budget inputs/selects and touched People controls have 44px mobile targets.
- Mobile drawer-to-search handoff now keeps focus in search and returns focus to Open navigation on dismissal. This is an opt-in extension to the existing FeatureDialog focus contract; existing dialog behavior remains the default.

## Exact application/test delta from the protected P0–P3 baseline

| File | Purpose |
| --- | --- |
| `src/app/components/ui/FeatureDialog.tsx` | Optional feature-owned close-autofocus cancellation/target; default preserved. |
| `src/app/features/app-shell/EflowAppShell.tsx` | Drawer/search focus handoff using the existing state owner. |
| `src/app/features/app-shell/components/NavigationSearchDialog.tsx` | Clear title/scope and return focus. |
| `src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx` | Office headings, Office tasks label and removal of overflow search duplicate. |
| `src/app/features/app-shell/officeToolGroups.ts` | Pure grouping of already authorized supplied destinations. |
| `src/app/features/budget/budgetViews.ts` | Nine-mode presentation contract derived from existing route values. |
| `src/app/features/budget/components/BudgetViewControl.tsx` | Shared Select with noninteractive option groups. |
| `src/app/features/budget/budgetViewControl.css` | Token layout, status and mobile controls. |
| `src/app/features/budget/components/OfficeBudgetWorkspace.tsx` | Replace the two selector layers; truthful read-error presentation. |
| `src/app/features/office-team/components/OfficeTeamWorkspace.tsx` | Selected-workflow search scope and placeholders. |
| `src/app/features/office-team/officeTeam.css` | Token styling, compact rows, wrap/focus/empty/mobile states. |
| `src/app/features/team-management/components/PeopleWorkspaceShell.tsx` | Reuse the existing WorkspaceHeader. |
| `src/app/features/team-management/peopleWorkspace.css` | Scoped token adapter and mobile targets. |
| `src/app/features/team-management/components/intelligence/TeamIntelligenceWorkspace.tsx` | Actual name/job-title/note-tag search scope and compact control. |
| `src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx` | Correct people/account-access search labels. |
| `src/app/features/team-management/components/supervision/TeamMemberBoard.tsx` | Actual name/job-title/Office filter labels. |
| `tests/e2e/context-rail-ui.spec.ts` | Updated search label; existing rail/switcher checks retained. |
| `tests/e2e/navigation-v2.spec.ts` | Search and single Office task labels; access/workflow assertions retained. |
| `tests/e2e/workspace-refinement-r2.spec.ts` | Current search/Office task labels. |
| `tests/e2e/workspace-refinement-r7.spec.ts` | Single Office task entrance label only. |
| `tests/e2e/global-ui-p1.spec.ts` | Budget view-picker interaction; FY/history and account-return assertions retained. |
| `tests/e2e/fixtures/globalUiP4.ts` | Synthetic long/empty/error Office and financial records. |
| `tests/e2e/global-ui-p4.spec.ts` | Nine views, role boundaries, drafts, search, read failure/retry, responsive and focus cases. |
| `tests/unit/remainingPhaseCoverage.test.ts` | One Budget control with all existing child/writer/FY checks retained. |
| `tests/unit/workspaceRefinementNavigation.test.tsx` | Updated search label only. |
| `tests/unit/globalUiP4.test.tsx` | Nine-view parser, one current picker and supplied authorized grouping parity. |

The audit handoff, overnight checkpoint, this receipt and the evidence directory are the additional documentation changes. The exhaustive inventory, including every evidence file, is [changed-files.txt](global-ui-p4-evidence/changed-files.txt).

## Verification

- Type check: passed. Final build: passed; existing chunk-size/mixed-import warnings remain.
- Full unit suite: **295 files / 1,771 tests passed** with an effective two-worker limit. After the final visual/focus corrections, **30 affected unit tests passed**, including existing dialog focus and foundation contracts.
- Broader Chromium/WebKit run: **151/152 passed**. The unchanged P1 account-return case timed out once waiting for Back to accounts. Manual inspection preserved selected account, filters and return focus; its isolated final browser retry passed in both engines. The earlier failure is retained in the logs and is not counted as a pass.
- Final affected Chromium/WebKit run: **24/24 passed**, no skips/flaky outcomes. Includes all eight P4 cases in each engine, the unchanged account-return case, and three affected R7 board/legacy/denied-canonical scenarios in each engine. Financial draft Keep editing/Discard and FY/history checks remain functional assertions.
- Graphify refresh: passed, **9,550 nodes / 405 communities**; the same four partial-extraction warnings remain in guided-tours/index, productivity/index, ProjectTaskRow and work-templates/index.

Results and local log paths are in [verification.json](global-ui-p4-evidence/verification.json). PowerShell's `npm.ps1` dropped worker flags in earlier attempts; `npm.cmd` applied the limit. Those failed runs remain failed evidence. Fixture error payload/delivery enum corrections followed the existing gateway contracts. The manual helper was also corrected after a normal rebuild to serve a localhost API origin; no real credentials or operational writes were used.

## Manual visual inspection and preservation

**32 direct JPEG captures** with dimensions and hashes are listed in [screenshots.json](global-ui-p4-evidence/screenshots.json). Inspection used realistic long labels, successful empty reads, denied reads and synthetic Head/Member/Accounting/Admin contracts. Expanded/collapsed desktop, 768px, 320px and both themes were manually inspected; the automated responsive matrix also covered 390px. Mobile Budget controls measured 44px and tested layouts had no document overflow. Search receives focus after the drawer handoff and Escape returns to the mobile opener.

- [Single Budget picker, light desktop](global-ui-p4-evidence/head-budget-picker-light-desktop.jpg).
- [Dark mobile funding controls](global-ui-p4-evidence/head-budget-funding-dark-320.jpg) and [collapsed Budget](global-ui-p4-evidence/head-budget-funding-dark-collapsed.jpg).
- [Dark Office Team with long rows](global-ui-p4-evidence/head-office-team-dark-desktop.jpg), [mobile invitations](global-ui-p4-evidence/head-office-invitations-dark-320.jpg), and [local search](global-ui-p4-evidence/head-find-pages-dark-320.jpg).
- [Unavailable Budget](global-ui-p4-evidence/head-budget-dark-desktop-unavailable.jpg), [successful empty Budget](global-ui-p4-evidence/head-budget-light-768-empty.jpg), [Accounting annual read](global-ui-p4-evidence/accounting-budget-annual-light-desktop.jpg), and Member/Admin boundary captures in the manifest.

Protected hashes in [protected-before.json](global-ui-p4-evidence/protected-before.json) and [protected-after.json](global-ui-p4-evidence/protected-after.json) prove unchanged baseline files outside the declared P4 delta/audit handoff. This includes prior receipts/evidence, context rails, icon registry, shared workspace header/switcher, P2 feed/filter owners, P3 review/membership authority, financial child controllers/services, permission resolution, project/Office boundaries, packages, Python and migrations. `phase02AppShell.test.tsx` remains byte-identical; no authority assertion was weakened.

## Remaining issues and continuation

- Genuine hosted accounts/JWT/RLS/Storage/provider behavior remains unverified; no hosted acceptance/deployment is claimed. Hosted target remains `ixnfphgjyelhckjwjkdv`.
- Firefox retains the earlier `spawn UNKNOWN` environment limitation; mobile verification is mobile web. The protected dark shared-header blue wordmark still has low contrast.
- The earlier intermittent P1 account-return timeout remains recorded; the final unchanged case passed both engines. Investigate again if it recurs.
- Admin duplicate category controls, Accounting general-navigation/Overview queue/data-owner duplication and unified Help remain assigned to P5a, P5b and P6. P7 is final cross-system acceptance.

The latest active objective authorizes automatic continuation after each validated checkpoint. P5a follows this receipt; no extra phase authorization is needed. All original external-operation and business-authority restrictions continue to apply.
