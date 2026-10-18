# Require positive Office Budget amounts before locking

The Office Budget annual editor previously allowed an amount row to remain at zero when another row made the total positive. Save & lock now rejects that budget and identifies the unfinished row. Draft saving still permits zero amounts.

The same rule applies to adjustments of a locked budget. Subtotal headings keep their stored zero value because their total comes from their children. Retired history is excluded. The database lock boundary also checks legacy appropriation lines when no active dynamic sections exist.

Navigation remains Workspace → Office tools → Office Budget → Annual office budget. The existing `save_office_budget_sections` and `lock_department_fiscal_budget` callers, payloads, access checks and return values remain unchanged. No existing budget amounts were rewritten.

Deployment completed on `ixnfphgjyelhckjwjkdv` only, as migration `20261018055740_positive_office_budget_amounts`. Preparation used a separate ignored workspace populated with the 37 previously fetched live-history files, checked against the current live migration list. The CLI generated the pending migration, local PostgreSQL exercised it, and Supabase MCP applied only that reviewed migration. Local filenames now preserve the timestamp assigned by the hosted migration ledger. Historical migrations were neither pushed nor repaired.

Verification passed:

- Type checking and production build (existing chunk/mixed-import build warnings remain).
- 14 affected unit tests, including draft saving, zero-row rejection, cent values, retired rows and calculated headings.
- 12 disposable PostgreSQL assertions, including legacy lines, rollback on rejection, authorized access, valid locking and valid/invalid locked adjustments.
- 3 production-preview Chromium tests: unfinished draft save → correction → lock, unavailable section handling, and locked adjustments with persistence and money formatting.
- Hosted rollback-only checks confirmed draft saving, zero-row lock rejection, no rejected lock receipt, valid calculated headings, locked-adjustment rejection and rollback of all test writes.
- Existing function execution privileges and security configuration were preserved. The security-advisor comparison found no new findings; the pre-existing groups and remediation links are retained in the [verification receipt](office-budget-positive-amounts-evidence/verification.json).

Run the focused SQL regression with `node scripts/verify-positive-office-budget-amounts.mjs`.
