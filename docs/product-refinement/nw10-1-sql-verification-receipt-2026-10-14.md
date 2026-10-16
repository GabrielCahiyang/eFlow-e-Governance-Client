# NW10.1 SQL verification receipt

Status: **completed locally**, 14 October 2026. Next eligible task: NW10.2, automatically authorized. No hosted operation, commit or push occurred.

Starting/ending branch and HEAD: `main`, `545245e353ad04ac47e24f95a71e06cf736ca0f8`. Pre-existing unstaged UI work is preserved. [Starting inventory](../../.refinement/nw10-20261014/checkpoint-nw101/starting-source.json) records all 4,551 existing tracked/untracked files; [prerequisite audit](../../.refinement/nw10-20261014/checkpoint-nw101/prerequisites.json) verifies twelve receipt hashes and 124 actual output paths. Fourteen later source/test changes require current verification rather than historical hash equality. NW1 contracts, NW2/NW4/NW5 migrations, NW3 checked staffing and NW9.6 final Activity integration were inspected directly. The old NW9.7 receipt's branch/dirty-set assertions are historical and were not executed as current requirements.

Changed files: [correction runner](../../scripts/verify-nested-work-correction-sql.mjs), [existing untracked evidence helper](../../tests/sql/helpers/nestedWorkCorrectionEvidence.mjs), new [final integration helper](../../tests/sql/helpers/nestedWorkFinalVerification.mjs), this receipt and the [durable status](nw10-nw11-overnight-status.md). The runner preserves every earlier assertion, records ordered migrations/stages, installs the accepted NW9.6 migration and verifies combined final behavior. The evidence helper's unfinished R9 anchor now verifies the actual reviewed removal-lock path plus its completion/row locks. No application behavior, migration, RLS, schema, historical runner or API changed.

`npm.cmd run verify:nw-correction` final attempt 5: **exit 0, 5,212 assertions** (5,149 original plus 63 final combined assertions), **39 distinct migrations / 45 applications** including explicit idempotency reruns, **512 effective function definitions**. [Machine receipt](../../.refinement/nw10-20261014/correction-final/receipt.json) records exact ordered filenames, SHA-256 hashes, stage counts and final scenarios; [definitions](../../.refinement/nw10-20261014/correction-final/effective-definitions.json) records bodies, definition hashes, privileges and paths. [Successful log](../../.refinement/nw10-20261014/checkpoint-nw101/nw101-correction-attempt5.log).

Coverage retains NW-F01–NW-F14: action maps/selected membership/branch rights (initial stage); own-Lead execution, formal authenticated synthetic Storage INSERT/sealing and evidence denial cases (Execution); own-Lead-first/ancestor/Task Lead/Head candidate routing and independent review (Review); descendants/prerequisites/manual root progress (Completion); transfer/history/direct-table/legacy/import/template/R9 removal/financial boundaries (OperationSafety and R9StaffingRemoval); exact retry/stale impact/late history/rollback (Impact); material dates and preserved commitments (MaterialDate). The final installed-state suite independently exercises depth eight/ninth-level denial, Lead-only progress, contributor submission/own-Lead decision, independent parent/root state, immutable evidence, checked retry/stale revision, RPC/direct-table contributor denial and recorded Activity/current expiry. Missing RLS rows are distinguished from exceptions: expired Activity returns an empty authorized page rather than inventing an exception contract.

| Exact command | Result |
| --- | --- |
| `npm.cmd run verify:r7-hierarchy` | Exit 0; 102 checks. Historical routing baseline only. |
| `npm.cmd run verify:r9-access` | Exit 0; 81 checks. |
| `npm.cmd run verify:r9-compatibility` | Exit 0; 102 checks. Historical source-rewrite compatibility, not new-install proof. |
| `npm.cmd run verify:merge-integrated` | Exit 0; 86 cumulative checks. |
| `npm.cmd run verify:r13-integrated` | Exit 0; 86 cumulative checks. |
| `node scripts/verify-nested-work-completion-concurrency.mjs` | Exit 0; 45 completion and 22 removal assertions, actual separate local PostgreSQL sessions. |
| `node scripts/verify-nested-work-impact-concurrency.mjs` | Exit 0; 78 assertions, both history lock orders, date races, concurrent exact retry and stale Repeatable Read denial. |
| `$env:EFLOW_TEST_PG_BIN='C:/Program Files/PostgreSQL/18/bin'; node scripts/verify-task-evidence-sql.mjs` | Exit 0; five groups, including two-connection cleanup/finalization in both orders. |
| `node --check scripts/verify-nested-work-correction-sql.mjs` and `node --check tests/sql/helpers/nestedWorkFinalVerification.mjs` | Exit 0. |
| `npm.cmd run graph:update` | Exit 0; 9,605 nodes / 30,736 deduplicated edges / 430 communities. Four existing partial AST warnings (guided-tours, productivity, ProjectTaskRow, work-templates); no deletion/incomplete overwrite. |
| `node test-results/nw10-preservation.mjs scripts/verify-nested-work-correction-sql.mjs tests/sql/helpers/nestedWorkCorrectionEvidence.mjs` | Exit 0; 4,549 protected files unchanged, only two reviewed existing-file edits, same HEAD/main, no staging. |

All command logs, including original failures, are archived under [.refinement/nw10-20261014/checkpoint-nw101](../../.refinement/nw10-20261014/checkpoint-nw101). This avoids loss when a later Playwright command cleans its default test-results directory.

Failed extended-run attempts remain separate: (1) final view install under authenticated role, corrected harness reset; (2) self-review matcher, tightened to actual explicit denial; (3) direct-table matcher, tightened to versioned-operation denial; (4) all final assertions passed but evidence helper expected a nonexistent generic lock comment, corrected to the reviewed R9 lock chain. No failed assertion was removed or runtime protection weakened. Attempt 5 passed the entire unchanged stage matrix plus final cases.

Limitations: synthetic `auth.uid()` claims do not prove signed JWTs/provider expiry or hosted RLS. Storage rows/metadata do not prove real bytes/uploads/signed URLs. PGlite is sequential; native runners separately prove local transaction concurrency, not hosted independent-session acceptance. Historical helper live-history mode still expects eighteen entries, not today's dated 27-entry target. No live install, backup/restore or deployment readiness is claimed. NW10.2 owns the full current repository/security/gateway gates before browser freezing.

Resume: inspect this receipt, durable status and current Git state; verify archived evidence exists, then run NW10.2 on current source without overwriting any prior log. Do not replay or repair hosted history.
