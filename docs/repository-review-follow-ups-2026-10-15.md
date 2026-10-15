# Repository review follow-ups — 15 October 2026

Status: the two financial findings are corrected locally in the additive [integrity follow-up](financial-integrity-follow-up-2026-10-15.md), not yet deployed by the assistant. The other findings remain outstanding. This report separates additional repository findings from the original financial compatibility correction. It does not replace the blocker or authorize unrelated changes.

## Relationship to the financial blocker

The nine findings are **not all unrelated** to `eFlow_Financial_Migration_Compatibility_and_Audit_Correction.md`:

- Two are financial follow-ups covered by its cash-refund, journal-posting, retry and preservation requirements.
- One affects the NW installation compatibility/order handoff, rather than the financial business logic. The blocker expressly says not to edit the nine NW migrations.
- Six are independent application/security issues. They must not be silently bundled into the financial installation SQL.

| # | Finding | Relationship | Status / evidence |
| --- | --- | --- | --- |
| 1 | Git tracks a database dump containing password hashes, refresh-token records and an internal AI authentication key | Independent security issue | Outstanding. The dump targets the current hosted project; a read-only comparison confirmed its AI key matches the current hosted key. Token validity was not tested. No secret values are reproduced here. Credential rotation and Git/history cleanup need a separately scoped change. |
| 2 | PDS upload failure recovery removes the Storage file before checking for a committed database row | Independent PDS issue | Outstanding. A mocked lost response after database commit returned a recovered row pointing at the file just deleted. |
| 3 | Manual journal validation uses unrounded values while journal lines store two decimal places | Financial: blocker section 4 and verification item 8 | Reproduced, then corrected locally by `20261015142837`: sub-cent/non-finite input is rejected, input totals must match exactly, and stored totals are checked transactionally. Historical journals are not rewritten. |
| 4 | A changed-payload retry of the older accounting liquidation API can erase a pending legacy refund reference | Financial: verification items 7, 10 and 13; historical preservation | Reproduced, then corrected locally by `20261015142837`: current recipient/submitter authorization and persisted receipt/refund comparisons run under the request lock. Identical retries return without UPDATE; changed payloads are rejected. A new legitimate correction still creates another version. |
| 5 | Notification email accepts caller-controlled content and an unrelated recipient without relationship authorization; hosted notification INSERT policy is unrestricted between authenticated accounts | Independent notification authorization issue | Outstanding. Email behavior reproduced with mocks; hosted policy inspected read-only. This is different from the blocker's wrong financial notification amount. |
| 6 | Published-task governance routing calls an absent `set_task_governance_route` function | Independent governance/deployment issue | Outstanding. Caller traced from the published routing control; hosted catalog absence confirmed read-only. |
| 7 | General report CSV escaping leaves formula-like text active | Independent report-export issue | Outstanding. Actual formatter returns `=1+1` unchanged. Budget-specific CSV has separate protection. |
| 8 | Project-list invalidation during an in-flight load reuses the old read without scheduling a later refresh | Independent project-list issue | Outstanding. Actual service reproduced with a deferred read: one query, stale displayed snapshot, no follow-up query. |
| 9 | NW2.2 literal replacement fails when raw checked-out CRLF migration text is executed against its LF-normalized catalog definition | NW integration/packaging, not financial logic | Outstanding rollout portability issue. Raw execution reproduced the assignment-anchor exception; LF execution passes. The financial integration test normalizes execution text only. No NW migration was edited. |

## Saved financial installation files

- `docs/sql-editor/2026-10-15-financial-cash-compatibility.sql` — complete saved SQL Editor installation package.
- `supabase/migrations/20261015125031_financial_cash_compatibility.sql` — canonical additive migration.
- `docs/financial-cash-compatibility-verify.sql` — read-only verification.
- [Financial handoff and user-supplied RLS evidence](financial-cash-compatibility-2026-10-15.md).

The user reported RLS enabled on both `petty_cash_receipt_items` and `petty_cash_request_lines`. That is partial installation evidence only, not a complete acceptance result or confirmation of this migration version.

The first saved version was subsequently confirmed installed by a read-only catalog check. Preserve that version/source/history. The **new** [additive patch SQL](sql-editor/2026-10-15-financial-integrity-follow-up.sql) addresses findings 3 and 4 without reinstalling the base or changing NW files. A settlement regression also exposed an ambiguous local `code` variable in the legacy journal fallback; the patch narrowly renames it so legacy settlement can complete. The six independent issues and the NW packaging issue are not fixed by this patch.

## Review checks and limits

Repository-wide automated checks scanned 1,204 frontend TS/JS files, checked 126 direct static RPC calls for existence, checked 115 object-literal RPC argument sets (with a spread-object false positive inspected), and checked 150 direct SELECT expressions for simple column-name compatibility. Dynamic requests, complex embedded selections and every runtime branch are not exhaustively proven by those checks. Targeted source tracing and isolated reproductions supported the findings above.

Read-only hosted checks were limited to the designated `ixnfphgjyelhckjwjkdv` target. No hosted financial records, accounts, files, grants or policies were changed. No credentials were printed or used to attempt authentication. The internal-key comparison returned only a boolean.

During the review, TypeScript checking passed, all 85 backend tests passed, and 8 focused report/cache unit tests passed. Those passing tests did not cover the newly reproduced failure cases. The older complete-suite and financial-package results remain in the financial handoff as historical evidence, not an exhaustive no-bug guarantee.

Known separate security limitation: the three-attempt counter records attempts through the eFlow login gateway, not password attempts made directly to Supabase Auth. This is not included in the nine additional findings or represented as repaired.
