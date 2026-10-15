# Financial cash compatibility — 15 October 2026

Status: the base migration was subsequently confirmed installed on **`ixnfphgjyelhckjwjkdv`**; the additional [integrity follow-up](financial-integrity-follow-up-2026-10-15.md) is prepared locally for user installation. The assistant made no hosted SQL writes, permission/financial-record changes or deployments. Hosted inspection used read-only transactions. The original verification evidence below is retained as historical evidence for the first package.

## Review addendum — installed base retained, additive integrity correction prepared

The installation SQL is saved in this changeset at `docs/sql-editor/2026-10-15-financial-cash-compatibility.sql`, alongside its canonical migration and verification SQL. Saving the package does not mean it has been deployed or that the later review findings have been fixed.

The subsequent repository review found two additional financial gaps: manual journal amounts can round into an unbalanced stored entry, and the legacy non-itemized liquidation retry can alter a pending refund reference without a correction version. Both relate to the blocker's financial preservation/verification requirements. They are now corrected locally by the **additional** migration `20261015142837_financial_journal_and_refund_integrity.sql`; see its [handoff](financial-integrity-follow-up-2026-10-15.md), [complete patch SQL](sql-editor/2026-10-15-financial-integrity-follow-up.sql), and [read-only verification](financial-integrity-follow-up-verify.sql). A related ambiguous legacy journal variable uncovered by the settlement regression is corrected in the same patch. The earlier test results below remain historical results for the first package.

A later read-only inspection on 15 October confirmed **`20261015125031` is already installed** on the designated hosted target, while `eflow_r7.lock_impact(uuid)` was absent. Do not rerun or edit that first installed migration or its recorded source. Run only the new follow-up package after reviewing its handoff. The assistant has not deployed the follow-up or modified live records/permissions.

The user supplied the following verification output on 15 October 2026:

| Table | Row-level security enabled |
| --- | --- |
| `public.petty_cash_receipt_items` | `true` |
| `public.petty_cash_request_lines` | `true` |

This confirms the reported tables have RLS enabled. It does **not** establish the installed migration version, correct SELECT policies/grants, unauthorized-user denial, function compatibility, or complete financial acceptance. No hosted changes were made to obtain or record this user-supplied evidence.

See [the separate review follow-ups](repository-review-follow-ups-2026-10-15.md) for the nine findings and their relationship to the blocker: the two financial findings are corrected in the new local patch; the NW integration issue and six independent repository issues remain separate and outstanding.

## Files to use

- [Original complete SQL Editor installation](sql-editor/2026-10-15-financial-cash-compatibility.sql): retained unchanged for history. Already installed on the current target; do not rerun it.
- [Read-only verification](financial-cash-compatibility-verify.sql): inspect installation, privileges, counter high-water marks, historical unnumbered requests and funding consistency afterward.
- [Canonical migration](../supabase/migrations/20261015125031_financial_cash_compatibility.sql): the source for an isolated CLI integration, rather than the SQL Editor wrapper.

Use either the SQL Editor package or an isolated CLI migration installation, once. The reviewed new version is **`20261015125031`**, named `financial_cash_compatibility`.

Migration SHA-256: `e786df31a639771f86d81e180fa269fa9ea30f0c8e5455e2c9d561a7c3415e4e`.

SQL Editor package SHA-256: `157f71a747e0a7ea37900185b2bfa7882c00198a46953827ebd87534aeca3639`.

The SQL Editor package stores the exact canonical migration text in the new `supabase_migrations.schema_migrations` row. The source is deliberately present twice: executable SQL, followed by the literal reviewed source for migration history. The final result row reports `Financial compatibility installed`. It never marks the old petty-cash migration as installed or modifies previous migration rows. Repeating the package stops before making changes.

## Corrected behaviour

The old multi-source writer called the single-source writer with the first amount, then updated the request total. Its INSERT trigger had already recorded the first amount and the original notification already described that amount. An amount-only update did not produce a correcting audit event. The same first-amount sequence affected resubmission.

The replacement validates every source, computes the final total, and inserts the complete request and its recorded funding payload in one write. Source rows, audit, notification and command receipt participate in the same transaction. A failed line, notification or final constraint rolls the transaction back. The exact regression is **80 + 20 = 100** in the request, source rows, creation audit and notification.

An authorized correction retains the request ID and original creation event. It saves the complete revised payload in one UPDATE, emits a new `financial_override` event with `operation=cash_request_corrected` and before/after data, and notifies the current reviewer using the revised total. The existing status-transition event remains. Ordinary direct request-detail edits outside an authorized correction are blocked.

Canonical source order makes equivalent reordered lines the same command. A private immutable command receipt records creation/correction keys and payloads. Same-key/same-payload retries return the original request; changed payloads using that key are rejected. Old request keys and single-source APIs remain supported. Allocation/fiscal/request locking and a command advisory lock serialize reservation and correction races. The NW migration subsequently adds its existing root-impact lock.

Partial approvals use deterministic largest-remainder allocation in integer cents. Per-source obligations sum exactly to the approved total. Itemized spending cannot exceed a source's approved share. Settlement charges each verified source and restores unused source capacity without charging the annual commitment a second time.

Itemized liquidation preserves existing release, acknowledgment, refund, reviewer, receipt-limit and settlement commands. It requires exact receipt/item/declared totals, positive finite amounts and quantities, unique receipt paths, authorized sources, and an uploaded `budget-receipts` object owned by the recipient under that Office/request path. Submitted item packages and refund references cannot be changed or appended to; corrections require another liquidation version. A multi-account request cannot bypass item checks through an older non-itemized submission API. General-journal posting retains the single-source fallback and posts each explicitly mapped item source, cash returned and advance once, in balance.

The register now includes eligible historical unnumbered expenses and exports their canonical request reference. It never invents `PCV 00` or today's PCV date. Capability detection also works for an installed year with no sections.

## PCV compatibility policy

1. Every pre-install request is explicitly `pcv_legacy=true`, including pre-install pending requests. Existing recorded PCV numbers and dates remain exactly unchanged.
2. Historical requests without numbers keep NULL numbers/dates, even after an unrelated update or later approval. The UI labels them `Legacy · unnumbered` and identifies the original request.
3. New requests are `pcv_legacy=false`. A PCV is issued only on their actual first authorization transition. Its date is the authorization date in Asia/Manila. Further release/correction updates retain it.
4. The unique `(fiscal_budget_id, pcv_number)` index prevents duplicates. Counter rows serialize concurrent assignments and advance above both their saved counter and existing recorded numbers. Higher counters and legitimate gaps are retained.
5. Installation refuses invalid recorded numbers/dates or negative counters. A missing/low counter is aligned only to an observed existing number, with a new zero-amount `financial_override` audit describing the previous counter and recorded high-water mark. Documents are never renumbered.
6. Missing derived funding lines can be reconstructed from an existing authoritative recorded funding payload. Single-source historical lines are reconstructed from their existing source/amount fields. Inconsistent stored totals abort installation for review; no guessed source allocation or financial amount is substituted.

For an old unnumbered paper voucher, Accounting should locate the original signed document and verify its true number/date and fiscal budget; the Head should approve a reconciliation reference. Preserve that evidence and original request/audit IDs. A separately reviewed, narrowly authorized reconciliation operation must record a new immutable before/after audit, enforce uniqueness and advance the counter. This package does **not** guess or bulk assign missing historical references. A discovered old incorrect creation event likewise requires a new reconciliation event referring to the original, rather than editing that original event. The verification query reports review candidates; legitimate older corrections can also make a current amount differ from its original creation amount.

## Function inventory

Existing signatures, public return contracts and operational callers remain. `CREATE OR REPLACE` preserves pre-existing public ACLs except that the two internal trigger functions below have explicit API execution revocation. Helper snapshots retain the installed section/task-context access checks.

Public functions:

| Function | Change |
| --- | --- |
| `create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)` | Real multi-source creation/correction API |
| `create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)` | Existing single-source API routes through the complete-total writer |
| `resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)` | Existing correction API and safe identical retry |
| `submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)` | Real itemized submission API |
| `map_office_budget_account(uuid,text)` | Head/Accounting-controlled expense-account mapping |
| `task_budget_line_available(uuid,uuid)` | Source-aware balances with exact partial-approval cents |
| `audit_cash_request_change()` | Full creation totals and new immutable correction events; existing trigger retained |
| `post_liquidation_general_journal()` | Source-specific expense posting; existing trigger retained |

Private `eflow_budget` functions:

- `assign_pcv()`
- `valid_money(numeric,boolean)`
- `canonical_cash_lines(jsonb)`
- `authorized_cash_lines(uuid)`
- `request_line_obligation(uuid,uuid)`
- `partition_spent(uuid)`
- `sync_single_cash_line()`
- `guard_cash_line_identity()`
- `check_cash_line_total()`
- `cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)`
- `legacy_resubmit_cash(uuid,uuid,numeric,text,date)`
- `guard_cash_correction()`
- `map_account(uuid,text)`
- `submit_items(uuid,numeric,text,jsonb,uuid,text,date)`
- `guard_itemized_liquidation()`
- `guard_receipt_item_insert()`
- `check_itemized_liquidation()`
- `get_sections(uuid,integer)`
- `task_context(uuid,uuid)`
- `pre_financial_get_sections(uuid,integer)` and `pre_financial_task_context(uuid,uuid)`: private snapshots of the installed effective readers.

The required NW helper names **and argument names** remain: `p_task` in `cash_request_v2`, `p_request_id` in `legacy_resubmit_cash`, and `p_request` in `submit_items`. These and the existing patched public wrappers remain real PL/pgSQL writers with the BEGIN anchors expected by the unchanged NW patch.

## Tables, indexes, triggers and grants

New tables, or compatible existing tables retained:

| Table | Contract and access |
| --- | --- |
| `public.petty_cash_request_lines` | Request/source composite primary key, positive cents, restricted foreign keys, request-scoped SELECT RLS; no authenticated DML |
| `public.petty_cash_receipt_items` | Immutable receipt items and captured account labels, positive quantities/amounts, restricted foreign keys, receipt-scoped SELECT RLS; no authenticated DML |
| `eflow_budget.pcv_counters` | One counter per fiscal budget; inaccessible to public/anonymous/authenticated callers |
| `eflow_budget.cash_commands` | Immutable actor/key/payload/request receipts; inaccessible to public/anonymous/authenticated callers |

Existing table additions: `office_budget_sections.journal_account_code`; `petty_cash_requests.pcv_number`, `pcv_date`, `funding_lines_payload`, `pcv_legacy`; `petty_cash_liquidations.itemized_payload`. Existing columns/data are not overwritten. `budget_ledger_entries`, `notifications`, `audit_events` and journal tables keep their existing schemas and policies. Existing release/acknowledgment, authorization, accounting, late-liquidation and evidence guards are retained.

Indexes: section journal-account FK; unique fiscal-budget/PCV; request-line source/request; receipt-item receipt/position and allocation source. The new private tables have their declared primary-key indexes. Existing request/liquidation idempotency and journal-source uniqueness indexes remain in force.

Triggers owned by this package: `office_budget_pcv`, `petty_cash_single_line`, `petty_cash_receipt_items_immutable`, `cash_commands_immutable`, `financial_line_identity`, `financial_request_total`, `financial_line_total`, `financial_cash_correction`, `financial_liquidation_immutable`, `financial_item_insert`, `financial_itemized_total`, `financial_item_row_total`. Deferred constraints validate the final committed source/item totals. The two new public tables are added to Realtime only if not already present.

Privilege changes are object-specific. Authenticated users receive only SELECT on the two new public tables under existing-parent RLS. Existing trusted service-role table access is retained. Only the new public APIs and the three private invoker targets (`cash_request_v2`, `map_account`, `submit_items`) receive authenticated/service-role EXECUTE; anonymous execution is revoked. Internal helpers, legacy internal resubmission, reader snapshots and trigger functions are not caller APIs. No schema-wide privilege revocation, existing schema-usage change, Admin expansion or Accounting approval expansion is introduced. The regression compares every pre-existing public function ACL (excluding the two deliberately private trigger functions) and preserves an unrelated private-schema grant.

## Baseline and NW10/NW11 integration

Read-only inspection confirmed 27 hosted migration versions and absence of the old petty-cash migration, required private helpers, item tables and PCV columns. The user-facing installer checks those 27 required baseline versions before applying anything. It also refuses to replace writers after `eflow_r7.lock_impact(uuid)` is installed.

Order for the integration owner:

1. Confirm the current target/history and obtain a recoverable backup under the existing rollout process.
2. Install this financial package on the reviewed baseline and run its read-only verification.
3. Refresh the NW isolated workspace from the resulting actual history (28 versions for the reviewed baseline), preserving every deployed timestamp.
4. Add only the nine reviewed NW correction files in their existing dependency order. The new financial timestamp is later than those files, so an isolated CLI integration may need its reviewed `--include-all` selection. Never repair the ledger or push the historical repository migration folder.

Do not also apply `20261007154917_petty_cash_vouchers_items.sql`, or use the empty historical `20261007160031_office_budget_ledgers.sql` as a substitute. Those files remain unchanged for historical receipts/tests. None of the nine NW correction files was edited. No code or messages were pushed into another checkout/chat.

The integration regression applies all nine unchanged NW files and verifies that their shared writer locks patch these real financial functions. This Windows checkout contains CRLF NW source. NW2.2 normalizes catalog text to LF before matching literals; raw CRLF execution can fail its literal anchor check. The local integration runner normalizes **execution text only** to LF, matching SQL Editor paste handling, without changing source bytes or hashes. The NW11 owner must retain/review that line-ending handling for its own rollout package. This package does not alter NW functionality to work around it.

## Verification and limits

The disposable baseline reconstructs the installed public catalog, its financial constraints and generated-number/idempotency/index metadata, the 27 baseline source-equivalent migrations, and the actual private evidence guard source. Historical Phase 6 filename differences are documented in the helper; no hosted history is repaired. Native race tests use PostgreSQL 17 on an isolated localhost port with separate authenticated-role connections, not concurrent calls on one PGlite connection. Synthetic claims and provider metadata are explicitly test fixtures.

New financial commands and assertions:

| Command | Coverage |
| --- | --- |
| `node scripts/verify-financial-compatibility.mjs` | Full totals/audits/notifications; single/multiple sources; correction/legacy retries; failure atomicity; partial cents/source limits; releases/acknowledgment; itemized refund/settlement/journal; role/Office/RLS and immutability; all nine real NW corrections |
| `node scripts/verify-financial-preservation.mjs` | Existing numbered/dated documents, receipts/items, releases, journals, notifications and original audit rows; counter catch-up; missing derived line recovery; SQL Editor success, duplicate paste, and rollback on final history-write failure |
| `server/.venv/Scripts/python.exe scripts/verify-financial-concurrency.py` | Independent-session same-key retry, competing reservations, correction race and unique concurrent PCV authorization |
| `npm run verify:budget-sections` | Unchanged historical 41-assertion regression |
| `npx vitest --configLoader runner run tests/unit/financialCompatibilityPresentation.test.ts tests/unit/budgetBundleIntegration.test.ts` | 12 frontend/report/capability compatibility tests |

Final results: **484** financial/integration assertions, **61** preservation/operator-package assertions and **12** native concurrency assertions passed (**557** new database assertions total). The unchanged historical financial runner passed **41** assertions. The focused frontend compatibility run passed **12** tests. TypeScript, production build, client-secret scan and whitespace checks passed.

The full unit suite passed **1,749 tests across 291 files** using `npm test -- --maxWorkers=2 --testTimeout=15000 --reporter=dot`. The first high-load parallel run had seven timing/cascading failures across five unrelated files; all five files subsequently passed their **25** tests separately with their original default timeouts, and the complete reduced-parallel run passed without failures. No existing assertions or test source files were changed.

All **three** affected Chromium cases passed: historical unnumbered receipts and both unchanged budget-section cases. The smoke uses the production preview because development-module loading stalled before the initial login screen. Failed development traces remain in `test-results/`; the passing preview run uses `.codex-tmp/financial-browser-preview/`. Task-owned preview servers and disposable native PostgreSQL clusters were stopped/removed afterward. The local Graphify update completed with its four existing parser-warning files recorded in the receipt; no incomplete smaller graph was forced.

See the [verification receipt](financial-cash-compatibility-verification-2026-10-15.json) for exact results and checksums.

Tests of genuine hosted JWT/RLS claims, live Storage upload/signing/download bytes, real historical paper document provenance, provider delivery and production backup restoration cannot be established by this local fixture package. Those remain explicit NW11/operator acceptance gates after authorized installation. Existing financial records were not created or edited to obtain such evidence. Historical numbering/reconciliation requires the documented Accounting/Head review, not an automated backfill.
