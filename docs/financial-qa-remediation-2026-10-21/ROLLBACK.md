# Rollback and recovery

These changes are pending locally; no hosted rollback is currently necessary. Preserve the original catalog hashes, migration ledger, QA journal rows and historical receipts.

1. Before deployment, save a recoverable database backup and the **current live** definitions, grants, trigger bindings and policy list for each exact touched signature. Recompare the deployment target with `ixnfphgjyelhckjwjkdv`.
2. Deploy only from a new isolated migration workspace populated from the live ledger, followed by the two reviewed pending migrations in order. Do not push the repository's historical migration directory or repair the live ledger to match filenames.
3. On application-only regression, revert the frontend source/build to the recorded baseline. New review records and their audit history remain in the database. Do not delete journals, receipts, cash releases or review decisions.
4. On financial/authority regression, pause the affected write path first. Inspect transaction receipts and immutable journals. Use a reviewed forward correction rather than dropping populated tables/private audit history or relaxing self-approval checks.
5. Private wrappers retain captured original settlement/release bodies under `eflow_finance_review`; they are not a general client escape hatch. Restoring an old public body or grants requires a separate exact-signature reviewed migration. Never re-enable the demonstrated anonymous scheduler exposure or restore the role-revocation race as routine rollback.
6. Dependency guard rollback must first establish that no approved dependent would become invalid. Do not silently reopen prerequisites or downgrade approved descendants.
7. Keep independent-review audit/command records even if the UI is disabled. Reconciliation must distinguish a reviewed package from a separately posted Accounting settlement.

No executable destructive rollback script is provided: a data-bearing deployment requires a snapshot-specific reviewed forward repair. The pending scripts are transactional; a failed migration rolls its transaction back. Investigate any migration failure before retrying, and never mark a failed migration applied by ledger repair.
