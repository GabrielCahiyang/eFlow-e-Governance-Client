# Web workflow parity verification — 16 November 2026

This note records verification evidence only. It does not establish deployed or authenticated acceptance.

## Focused checks that passed

- `npm.cmd run check` — TypeScript check passed.
- `npm.cmd test -- tests/unit/nestedWorkDetailEditing.test.ts` — 7 tests passed.
- `npm.cmd test -- tests/unit/workDetailsEditorPolicy.test.tsx --maxWorkers=1` — 2 tests passed.
- `npm.cmd test -- tests/unit/nestedWorkEditorDraft.test.ts tests/unit/nestedWorkDraftRecovery.test.tsx --maxWorkers=2` — editor draft file passed (114 tests); the combined command's DraftRecovery file was blocked by a missing import described below.
- `npm.cmd test -- tests/unit/nestedWorkRequestRecovery.test.tsx --maxWorkers=1` — 39 tests passed.
- `npm.cmd test -- tests/unit/nestedWorkCommandForms.test.tsx --maxWorkers=1` — 28 tests passed.
- `npm.cmd test -- tests/unit/nestedWorkAdvisoryAppointment.test.tsx --maxWorkers=1` — 4 tests passed.
- `npm.cmd test -- tests/unit/nestedWorkDraftRecovery.test.tsx --maxWorkers=1` — 28 tests passed.

## Broader regression audit

The requested unrelated regression batch ran 9 files: **41 passed, 12 failed out of 53 tests**. Full output is in `.codex-tmp/workflow-parity/unrelated-audit.log`.

Failures:

- `phase10ProjectWorkspace.test.tsx` (1): expected legacy project tabs; current output includes Tasks, Reviews, Members, Budget and Analytics.
- `phase16FinancialScope.test.tsx` (2): forced budget refresh expected 2 reads but got 3; another refresh/realtime case never received its expected `known` summary and logged undefined budget data.
- `workspaceRefinementWorkRefresh.test.tsx` (1): expected the slow source to be called twice; observed once.
- `reviewEvidenceDetails.test.ts` (1): expected visible `75%` text was absent.
- `globalUiP3.test.tsx` (3): test Supabase mock lacks `channel`.
- `financialRemediationPresentation.test.tsx` (1): expected “Financial Officer”; current text says “Accounting Officer”.
- `globalUiP5a.test.tsx` (1): expected 10 Admin leaves; found 11.
- `navigationDestinationIcons.test.tsx` (1): Admin destination icon count expected 11; found 10.
- `neutralSurfacePresentation.test.ts` (1): stale assertion expected `bg-primary/5` in `BudgetPositionSummary`.

These failures are in project, finance, navigation, review and feed tests, outside the nested-work changes.

## Limits

- The full suite was interrupted after stalled output; it has no final summary and is not reported as passed.
- Graph verification was blocked because the local Graphify setup/map is missing.
- Four browser checks could not launch because Chromium is unavailable.
- A DraftRecovery run was initially blocked by the missing `src/shared/prerequisiteLinkingError` import from `taskMutationService.ts`; its later standalone test run passed.
- No hosted queries, hosted SQL execution, deployment, or authenticated production acceptance were performed. The dependency review separately records disposable local PGlite assertions. Source checks do not verify installed server policy or RLS behavior.

Final Task/project-table batch: **66 tests passed across 9 files**, including the started due-date correction that sends only the due date and reason, plus retained Start/resume behavior. Log: `.codex-tmp/workflow-parity/task-final.log`. It completed before the user's request to stop testing was processed. No further tests were started after that request. Final build completed successfully; TypeScript passed.
