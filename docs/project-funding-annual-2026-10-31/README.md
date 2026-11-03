# Project funding without quarters — October 31, 2026

Removed the quarter selector and quarter labels from project funding entry, the final setup review, and task funding source selection. The form now uses fiscal year, Office Budget source, amount and authority reference. Multiple amounts for the same account consolidate into one annual project source. The displayed funding rows use a three-column source/amount/remove layout.

Installed migration `20261031124511_remove_project_funding_quarters.sql` changes authorization and task-allocation checks from quarter overlap to fiscal-year overlap. A later-year task can use a previously Q1-labeled source from that fiscal year. Project/task date bounds, available-source checks, authority checks, idempotency, and prevention of charging Office Budget twice remain in force. Separate office petty cash is unchanged.

Historical quarterly rows, their IDs, allocated amounts, references and audit payloads are preserved. Their old quarter field is historical metadata only and no longer restricts allocations. New funding uses a null legacy quarter field and a unique annual source index. Old clients/pending requests with quarter fields remain compatible; raw retry payload identity is retained.

Deployment used a fresh verified database/roles backup and an isolated workspace containing exact live migration history. Only this reviewed migration was selected. Definitions of the two replaced private functions were compared against the captured live baseline before applying; existing 115 public-table fingerprints were unchanged. See `DEPLOYMENT_RECEIPT.json`.

Verification:

- 5 focused project definition/funding UI tests passed, including no quarter control/payload, source totals, authority and retry behavior.
- 11 rollback-only database checks passed both before deployment and against the installed migration, recorded in `INSTALLED_CHECKS.json`.
- TypeScript check, production build and whitespace check passed. The build retains the existing large-chunk warning.
- Database assertions cover new annual sources, legacy quarter payloads and funding rows, late-year allocations, overbudget denial, project date shortening and task date bounds.
- No fictional funding or accounts are retained by the tests. Browser testing remains with the user; no full-system audit is claimed here.
