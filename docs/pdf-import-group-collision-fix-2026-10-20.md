# PDF import: existing group names and repeated uploads

The existing OCEDSIPP import already supplied all ten tasks to the project. A
fresh upload generated groups with `existingGroupId: ""`, and the save attempted
to insert their names again. The group-name unique index correctly rejected that
write. The client then misclassified PostgreSQL `23505` as an uncertain outcome,
so it offered an identical retry that could never resolve the name collision.

Implemented and deployed to `ixnfphgjyelhckjwjkdv` as
`20261020041402_reuse_pdf_project_groups.sql`, preserving the hosted timestamp.

- Resolve matching group names inside the project lock, using the database's
  existing normalization rules, and reuse their IDs for genuinely new tasks.
- Recognize when every requested task is already present from a previous import
  of this PDF. Return an explicit already-imported result with zero added tasks,
  leaving current people, dates, statuses and budgets intact. Record a durable
  no-op receipt so the same request remains safe to retry.
- Preserve receipt identity when automatic group resolution changes the internal
  canonical review: retain a SHA-256 fingerprint of the original reviewed input.
  A changed payload cannot reuse the same batch ID.
- Mixed existing/new task-name conflicts roll back with an actionable message.
  They do not silently overwrite or append a second copy of existing work.
- Confirmed unique violations are correctable failures, not uncertain writes.
  The PDF picker and close action unlock instead of entering an endless retry.
- Successful recognition of an existing plan also applies the existing empty-
  default cleanup. Populated and archived task groups remain protected.

The current failed import can use **Retry import** after this deployment; it
does not need another AI generation or another PDF upload.

Verification:

- `scripts/verify-pdf-project-group-reuse.sql` passed on the hosted database under
  the authenticated role and real Head RLS, with all fixtures rolled back. It
  covers normalized group reuse, source budgets, empty-default cleanup, receipt
  retry equality, changed-payload denial, fresh-upload deduplication, manual edit
  preservation, partial-conflict rollback and cross-project isolation.
- A separate rollback-only replay of the actual OCEDSIPP receipt recognized all
  ten existing tasks and verified that every stored task field, including budgets,
  stayed identical.
- 31 distinct affected client tests passed, including duplicate-error recovery,
  already-imported presentation, unknown-outcome retries and legacy import callers.
- Type checking and production build passed. The updated RPC has no findings in
  the [Supabase security advisor](https://supabase.com/docs/guides/database/database-linter).
- All three affected desktop Chromium smoke tests passed, including PDF import
  into the current table and retrying an uncertain save with the identical batch.
