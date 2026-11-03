# Verification receipt

3 November 2026. Deployment was explicitly approved and completed. Local/synthetic feature tests and live read-only deployment checks are distinguished below. No actual project was published as a test.

| Check | Result | Evidence |
| --- | --- | --- |
| PostgreSQL 17 disposable cluster | Passed: migration compilation, day-23/day-30 boundaries, reminder deduplication, financial blockers, unknown historical dates, reopen/recompletion, Head authority, source changes, private-data exclusion, task/subtask locks, exact-byte consent, publication-copy restrictions, simulation separation, retained failed transaction attempts, linked corrections and restrictive storage policies | logs/project-seal-sql.log; tests/sql/project-seal.sql |
| New Python archive/worker/contract tests | 16 passed | logs/server-publication.log |
| New public verification/unit tests plus affected project workspace contracts | 17 passed | logs/project-seal-focused-tests.log |
| Desktop Chromium walkthrough | 2 passed: Head preview/publication-copy change resets consent, simulation never claims verified publication; anonymous archive view works without AI/login and rejects tampering | logs/project-seal-browser.log; GALLERY.html |
| TypeScript | Passed | logs/project-seal-check.log |
| Production build | Passed; existing chunk-size/mixed-import warnings remain | logs/project-seal-build.log |
| Built-client secret scan | Passed | logs/project-seal-secrets.log |
| Graphify | Refreshed; four existing partial-parser warnings remain | logs/project-seal-graph.log |
| Hosted database backup/history/preflight | Verified backup; isolated dry run selects only the new migration; 74 existing migration versions and 125 operational/account tables fingerprinted | DEPLOYMENT_PREFLIGHT.json |
| Amoy preparation and approved deployment | Chain 80002, reviewed empty registry deployed/finalized; actual fee 0.018082110037972431 test POL, below 0.03 cap | AMOY_DEPLOYMENT_PLAN.json; AMOY_DEPLOYMENT_RECEIPT.json |
| Hosted deployment | Migration applied; 125 existing tables preserved; hourly cron active; no private snapshot/public certificate created | DEPLOYMENT_RECEIPT.json; HOSTED_ACCEPTANCE.json |
| Live runtime and final frontend bundle | Mode live/configured/worker enabled; contract bytecode/publisher/finality verified; website, gateway and private API HTTP 200; production build and client secret scan passed after setting trusted registry | RUNTIME_ACCEPTANCE.json; logs/project-seal-live-build.log; logs/project-seal-live-secrets.log |

Test counts overlap between groups and must not be added as a unique total. The public-page screenshots show synthetic intercepted records, not an actually published project. No tests published actual receipts or personal information.

## Bugs caught while implementing

- Publication initially depended on the AI endpoint's advisory status. It now uses the control gateway directly, and an offline host does not hide a saved database preview.
- The new project action initially required authentication context even for planning-project test renderers. It now mounts its authenticated archived-project behavior only for archived projects; the affected workspace regression suite passes.
- A simulated retry of an already-started live publication could have unlocked the project. Both database and worker now reject this transition.
- Wallet release needed to occur after, rather than before, durable transaction persistence. The database wallet lease and unresolved-transaction checks now enforce that ordering across processes.
- Failed mined transactions needed a recovery path distinct from uncertain broadcasts. Only verified finalized reverts can allocate a new attempt; the original signed identity remains recorded.
- A changed publication copy could otherwise leave old consent checked. Consent resets after every copy change, and the database checks the reviewed fingerprint again.
- Correction previews could otherwise revert to private originals. Previous reviewed publication copies are carried forward and verified.
- Financial JSON serialization could round very large decimal values. Server parsing/serialization now preserves exact decimal numbers.
- A pre-existing settlement display used a missing `leaderDecidedAt` type/mapping. The optional timestamp is now mapped from the existing database field. Settlement authorization was not changed.

## Full existing suite remains partly red

The full run completed with **2,283 passed / 20 failed tests**, across **378 passed / 13 failed files**, plus an existing empty-suite error. This run happened before the archived-action context fix described above. The affected project/publication tests were then rerun and passed.

The remaining full-run failures include older cash-form expectations, retired subtask progress/review expectations, previous hierarchy/action-column/deletion wording, an empty subitem review suite, static markup expectations, and loader/time-limit failures in several large parallel tests. Files recorded in the full log:

- workBudgetCallerGates, nestedWorkCollapsedReadiness, reviewEvidenceDetails
- subitemInspector, subitemReviewDetail, nestedWorkHierarchy, nestedWorkCommandForms
- workspaceRefinementHierarchy, nestedWorkDraftRecovery, workspaceRefinementMembers
- budgetDesignSystemPresentation, workspaceRefinementR13Artifact
- workspaceRefinementProject (the new context issue, subsequently fixed and rerun successfully)

A smaller rerun showed the artifact test passing and exposed remaining loader timing issues in members/draft-recovery tests. These are recorded as unresolved tests, not silently reclassified as harmless or as full-system acceptance. The older analytics validation report records most of the same legacy-contract failures. No unrelated workflow was changed merely to make those assertions pass.

The initial secret scan overlapped a production build replacing dist files and encountered a missing generated asset. Running the scan after the completed build passed. One local PostgreSQL init exceeded its original timeout during the parallel suite/indexing run; the isolated harness timeout was increased and the SQL checks passed.

## Deployment completed; real-project acceptance remains separate

The approved hosted schema/cron/contract are deployed and the publication worker is live. Deployment preserved existing records and created no project snapshots/certificates. A read-only check found no publisher transaction after contract creation. The provider rejected a broad historical eth_getLogs request; receipt, bytecode, publisher, finality and wallet nonce checks succeeded.

A real end-to-end publication, linked correction and laptop-offline public download still need a separately reviewed archived project and explicit Head consent. Synthetic fixtures/local EVM tests are not represented as that live acceptance.

Post-deployment advisors are retained in POST_DEPLOYMENT_ADVISORS.json. The four new private eflow_seal tables intentionally use RLS without client policies and deny client schema access; service RPCs mediate access. The public upload predicate is callable anonymously because restrictive storage policies evaluate it; it returns false with no authenticated user (verified live), reveals no records and grants no upload access. Authenticated SECURITY DEFINER publication RPCs are intentional and enforce the current appointed Head inside the function. Existing unrelated advisor warnings remain; no broad permission cleanup was mixed into this deployment. See the linked remediation URLs in that receipt.

The optional Kubo IPFS adapter is implemented but has no configured external pinning target/live retention proof here. The default content-addressed hosted-storage path does not depend on that optional provider.
