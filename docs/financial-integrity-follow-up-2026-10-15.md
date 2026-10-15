# Financial integrity follow-up — 15 October 2026

Target: **`ixnfphgjyelhckjwjkdv`**. Status: implemented locally; installation is reserved for the user. No live SQL writes or deployment were performed by the assistant.

## What to install

1. The first financial version `20261015125031` was confirmed installed through a read-only hosted check. **Do not rerun it, edit its source, or repair its migration history.**
2. Review and run the entire [additional SQL Editor package](sql-editor/2026-10-15-financial-integrity-follow-up.sql) once.
3. Run the [read-only follow-up verification](financial-integrity-follow-up-verify.sql).

Canonical source: `supabase/migrations/20261015142837_financial_journal_and_refund_integrity.sql`.

New version: **`20261015142837`**, `financial_journal_and_refund_integrity`.

Canonical SHA-256: `fde5e5db2f88b489f37e09f1e89eb9f3446d1659e053110e53b182610ab7b467`.

SQL Editor SHA-256: `71b12532a3d7c947122439467feed43608c9e7adbd3570e5a5a9a6157254824b`.

The package executes the new migration and stores its exact source in one **new** migration-history row, in the same transaction. An existing version or a missing base version is rejected. A failure writing that row rolls back all writer changes. Source hashes and the original installed version are preserved.

Narrow `.gitattributes` rules retain LF bytes for these two reviewed financial migrations and their two operator packages across Windows checkouts. No historical or NW migration is normalized or edited.

Read-only inspection found the installed base source was recorded with 568 CRLF line endings: raw SHA-256 `eb477cf4b9f7a2ebdd4f858f823672c928a32aa8c39ffa79ceccaab16394e42d`. Its LF-normalized comparison matches the reviewed base SHA-256 `e786df31a639771f86d81e180fa269fa9ea30f0c8e5455e2c9d561a7c3415e4e`. This is a paste line-ending difference, not a reason to repair history. The raw installed source is left untouched. The follow-up regression also executes the base as CRLF before applying the correction.

## Fixes

### Exact-cent journal posting

The manual journal API now rejects fractions of a cent, negative/non-finite amounts and unequal totals before calling the effective original writer. After posting, it verifies that the stored debit and credit totals are equal; a mismatch rolls back the whole command, including its audit. The original writer still checks Accounting role/capability, active chart accounts, reference and memo. The frontend validates integer cents and explains the two-decimal rule.

The exact regression `100.004 + 100.004` versus `200.008` previously saved `200.00` versus `200.01`. It is now rejected. Ordinary `0.10 + 0.20 = 0.30` remains accepted. Existing unbalanced historical entries are only reported for review; they are not silently rewritten. Their correction requires a new authorized accounting entry.

### Legacy liquidation retry/refund preservation

Both older public liquidation entry points validate the active recipient and original submitter before returning an existing request-key result. Request-row locking serializes concurrent submissions. Persisted spending, note and receipt fields are compared, with the legacy writer's trimming/defaults and order-independent receipt comparison. The accounting wrapper also compares the recorded refund reference/date using the **stored** returned amount.

An identical retry returns the original liquidation without an UPDATE, even after settlement. A changed amount, note, receipt or refund reference is rejected and leaves all original evidence, versions, audits and notifications unchanged. A reviewer-requested correction with a new key continues through the existing writer and creates a new version. Itemized submission retains its stricter item/payload validation; release acknowledgment, refund requirements, late authorization, evidence checks, settlement and journal posting remain in their established writers.

Completing this legacy settlement regression uncovered `a.code=code` in the existing journal fallback, which PostgreSQL rejects as ambiguous. The follow-up renames only that local variable in the effective trigger definition; it does not replace accounting logic or alter earlier journal records.

## Functions and privileges

Existing public signatures, OIDs, return values and ACLs are preserved:

- `post_general_journal_adjustment(uuid,date,text,text,jsonb)`.
- `submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)`.
- `submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)`.
- `post_liquidation_general_journal()` — local variable ambiguity corrected only.

New private helpers in `eflow_budget`:

- `pre_integrity_journal(uuid,date,text,text,jsonb)`.
- `pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid)`.
- `pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)`.
- `integrity_receipts(jsonb)`.
- `integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid)`.

The three snapshots retain the **effective** original writers and their existing checks, rather than overwriting them with a historical body. All five helpers explicitly deny public/anon/authenticated execution. There are no table/column additions, table-grant changes, RLS changes, broad revocations, historical-row updates or Admin authority expansions.

## NW compatibility

No NW migration file is edited. The follow-up can precede NW (the public wrappers retain the expected real PL/pgSQL BEGIN anchors and arguments) or follow NW (snapshots retain its installed root-impact guards). The retry helper obtains the optional NW impact lock before the cash-request row lock, retaining the root -> request lock order.

Both installation orders are exercised locally. The independently reported CRLF matching issue remains an NW packaging prerequisite: reviewed execution text must retain the documented LF normalization. This follow-up does not claim to repair that separate rollout issue.

## Verification

The regression runner first reproduces both reported bugs against the base-only fixture, then applies the patch and verifies rejection, atomicity, existing historical preservation, public ACL/OID preservation, private helper isolation, original version retention, duplicate-paste refusal, failed final-history-write rollback, current-user/Office restrictions, valid exact cents, new and historical identical retries, new correction versions, settlement and both NW installation orders.

- `node scripts/verify-financial-integrity.mjs`: **89 assertions passed**, including saved package/source equality and equivalent receipt-order/decimal representations.
- `node scripts/verify-financial-compatibility.mjs --with-integrity`: **484 existing financial/integration assertions passed with the follow-up installed**, including real itemized submission, refund and settlement.
- `server/.venv/Scripts/python.exe scripts/verify-financial-concurrency.py`: **18 assertions passed**, using real independent local PostgreSQL 17 connections, including competing refund payloads and identical liquidation retries. Task-owned temporary cluster removed afterward.
- `node scripts/verify-financial-preservation.mjs`: **61 original preservation/operator assertions passed**.
- Frontend journal/date-picker/ownership/cancellation tests: **16 passed**, including seven new money-validation cases.
- Chromium production-preview smoke: **7 passed**, including the new fractional-cent blocking case, existing journal confirmation/uncertainty and settlement flows, historical PCVs, and both budget-section cases. Backend calls in this browser fixture are intercepted; live financial records are not used.

The full unit suite passed **1,756 tests across 291 files** using `npm test -- --maxWorkers=2 --testTimeout=15000 --reporter=dot` (1,312.92 seconds). No existing assertions were weakened or removed. TypeScript checking, production build (6,222 modules; existing chunk warnings), client-secret scan and whitespace checking passed. The unchanged historical budget runner passed **41 assertions**. Graphify refreshed successfully with its four existing parser-warning files.

Exact results are saved in [the follow-up verification receipt](financial-integrity-verification-2026-10-15.json). Prior results in the base handoff remain historical evidence, not a substitute for these new regressions.

Hosted JWT/RLS behavior, Storage provider bytes, real historical reconciliation provenance and production restoration remain operator acceptance gates. Two user-supplied `rowsecurity=true` results alone do not establish those gates. The unrelated repository security/application findings remain separately listed in the [review report](repository-review-follow-ups-2026-10-15.md).

The Supabase/Postgres skill review reinforced the existing object-specific privilege and consistent-lock-order checks. Current function security guidance was checked against [Supabase database function documentation](https://supabase.com/docs/guides/database/functions); no new platform feature, live policy change or deployment was introduced during that review.
