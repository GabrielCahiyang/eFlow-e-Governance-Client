# Global UI/UX simplification — P5b Accounting implementation receipt

14 October 2026, Asia/Singapore. Git HEAD `545245e353ad04ac47e24f95a71e06cf736ca0f8`. Protected starting point includes P0–P5a. All work remains local and uncommitted. No migration, hosted write, push, deployment, real financial/account operation or business-authority change occurred.

## Corrected behavior

- The existing six Accounting rail destinations are the sole general selector while available. Collapsed, mobile and standalone composition use one compact shared Select derived from the existing `ACCOUNTING_VIEWS`; it disappears while the mobile destination drawer is open. Route values, permissions and normal Member workspaces remain intact.
- Accounting Overview is a compact financial summary with a guarded View settlements handoff. It no longer mounts an actionable settlement queue. Only the existing Settlements leaf owns that controller. Counts remain truthful; failed reads show Unavailable, and missing annual authority is Not configured rather than a false zero. Scheduled/due amounts, daily room, journal count and actual spending remain distinct.
- Embedded Budget consumes the existing parent budget/journal bundle and refresh functions. Standalone Head Budget retains its own scoped owners and passes its existing journal into the already implemented owned Journal composition. There is no app-wide cache or replacement financial controller. Actor/role/Office changes remount the owner; existing FY/request generation protections remain.
- Budget ledger has one page heading and the P4 nine-mode picker, with budget status, update time and FY intact. The already implemented guarded mode/FY URL/history writer remains. Heads retain lawful local Journal/Trail/Releases reads and their preparation/funding operations without redirecting to Accounting-only routes.
- The mandatory [financial-stage comparison](global-ui-p5b-evidence/financial-stage-parity.md) found different record/receipt/verification contracts. All distinct write adapters are preserved. Head fiscal and late-package authorization, contextual Lead endorsement, independent Accounting settlement, physical release/cheque/override/acknowledgement and immutable history remain separate.
- Touched financial screens use WorkspaceHeader, Figtree, semantic tokens, compact summary/table patterns, readable 12px+ data labels and 44px mobile controls. Static authority/posting explanation is contextual help; operation-specific warnings remain at the operation. Manual dark inspection found the Vibe success palette's text contrast problem; settlement action uses the existing primary palette and status/Balance/Trail labels use the shared Badge with semantic tokens. No handler or guard was changed.

## Exact application/test delta

- `src/app/features/budget/accountingWorkspace.css`
- `src/app/features/budget/components/AccountingDestinationControl.tsx`
- `src/app/features/budget/components/AccountingOverview.tsx`
- `src/app/features/budget/components/AccountingSettlementQueue.tsx`
- `src/app/features/budget/components/AccountingStaffWorkspace.tsx`
- `src/app/features/budget/components/AccountingTrailPanel.tsx`
- `src/app/features/budget/components/BudgetReleasesPanel.tsx`
- `src/app/features/budget/components/GeneralJournalWorkspace.tsx`
- `src/app/features/budget/components/OfficeBudgetWorkspace.tsx`
- `tests/e2e/fixtures/globalUiP5b.ts`
- `tests/e2e/global-ui-p5b.spec.ts`
- `tests/e2e/phase16-support-finance.spec.ts`
- `tests/e2e/phase18-release.spec.ts`
- `tests/unit/budgetDesignSystemPresentation.test.ts`
- `tests/unit/globalUiP5b.test.tsx`

Documentation: this receipt, audit handoff, mutable overnight checkpoint and [evidence inventory](global-ui-p5b-evidence/changed-files.txt).

## Verification

- Final type check/build passed (`check-accepted.log`, `build-accepted.log`; build 14.69s). Existing chunk/import notices remain. `git diff --check` passed after trimming one extra EOF newline.
- Full unit: 297 files / 1,781 tests passed with two workers. Final ownership/scope/authority/presentation follow-up: 38/38, then 14/14 after the final status-badge correction. Existing financial handlers, service signatures/payloads and backend rules remain unchanged. [Settlement handler parity](global-ui-p5b-evidence/settlement-handler-parity.json) verifies the entire pre-JSX guard/confirmation/decision/verification/evidence-signing block is byte-identical to HEAD.
- Broad browser gate: 22/28 passed. Six failures used an obsolete “FY … Budget position” text assertion; corrections assert the current Office/FY header and actual Budget position region, preserving the scope check. Final Chromium/WebKit gate: 16/16 passed, including both themes, rail/collapsed/mobile fallback, single embedded heading/initial owner reads, zero-versus-unavailable, FY/draft guards, one settlement decision and its balanced posted Journal, plus responsive Journal Axe/keyboard/overflow checks at 320/390/768/1024/1440. The earlier valid cases also verify own-funds exclusion, separate late Head authorization, uncertain settlement reason/verification, physical release uncertainty, Journal correction and P1 Budget history. Failed runs remain recorded separately.
- Manual CUA: 21 direct captures covering light/dark desktop, collapsed/restore, 768/390/320, long task/purpose labels, summary handoff, settlement evidence/control layout, release schedule, embedded mode picker, empty/unavailable reads, immutable history presentation and Head local ledger reads. [Screenshot manifest](global-ui-p5b-evidence/screenshots.json). Actual theme state was checked; an initial fixture preference-table typo was corrected before dark acceptance and affected evidence refreshed.
- Dark computed contrast: settlement action 7.87:1; financial status labels 8.54–9.68:1. [Measurements](global-ui-p5b-evidence/dark-financial-contrast.json). No page overflow was observed in the inspected mobile cases; settlement controls measured 44px.
- Graphify refreshed: 9,586 nodes / 425 communities; same four partial-extraction warnings (guided-tours/index, productivity/index, ProjectTaskRow, work-templates/index). No forced incomplete graph replacement.
- 4430 protected existing files outside this declared delta remain byte-identical, including P0–P5a receipts/evidence, business services, migrations and distinct review/release adapters. [Before](global-ui-p5b-evidence/protected-before.json), [after](global-ui-p5b-evidence/protected-after.json).

## Evidence and limits

![Accounting summary](C:/Users/james/projects/eflow-e-Governance-Project/docs/product-refinement/global-ui-p5b-evidence/accounting-overview-light-desktop.jpg)

![Mobile financial evidence and controls](C:/Users/james/projects/eflow-e-Governance-Project/docs/product-refinement/global-ui-p5b-evidence/accounting-settlements-dark-390.jpg)

Browser operations used synthetic intercepted local role contracts. Genuine hosted JWT/RLS/Storage/provider acceptance, real financial operations, native phone and screen-reader acceptance remain unverified. Firefox retains the prior spawn UNKNOWN environment limitation. The protected shared dark wordmark contrast issue is carried to P7. P6 Help is the next authorized checkpoint; P7 follows its gate.
