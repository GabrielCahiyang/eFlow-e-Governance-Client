# Independent office petty cash — October 31, 2026

**Updated starting-fund rule:** the office now starts with ₱30,000 automatically, without an Accounting opening deposit. The initial deployment notes below retain the earlier behavior as historical evidence. See [the current correction](../office-cash-starting-fund-2026-10-31/README.md).

Office petty cash is separate from annual appropriation, project funding, task allocations, and task-funded cash requests. Historical task-cash database/API names are preserved for compatibility; no historical amounts were reclassified.

## Rules and navigation

- Open **Office Budget → Budget view → Office Petty Cash · ₱30,000 fund**. Accounting uses the same view under Office Budget Ledgers.
- Staff can also use **Office petty cash · separate fund** from the task funding screen, including when the task has no budget. The request is office-scoped and does not charge that task.
- Each office has one continuing fund, independent of fiscal-year selection. Its ceiling is ₱30,000. There is no daily, monthly, or annual automatic reset.
- An uninitialized fund has ₱0 recorded cash. Accounting must record the actual opening money received using **Replenish fund**; no money was seeded by deployment.
- Active office members request against available petty cash. Pending and approved requests reserve the shared cash balance. Rejection/cancellation releases that reservation; the user can submit a corrected request.
- Zero balance no longer disables **Request petty cash**. Members can open, fill out, and cancel the form. A notice explains that Accounting must add money before submission. Submission stays blocked above the available balance; a background balance refresh keeps the draft and enables submission once enough money is available. The fund is never filled automatically.
- An independent appointed Head approves/rejects. A request is blocked if no independent Head exists, preventing self-review and orphaned approval queues.
- Accounting records physical release separately from approval. Released advances reduce cash in the fund and remain outstanding until settlement.
- The recipient submits receipt images/PDFs, vendor, receipt number, date, and amount. **Each receipt is strictly capped at ₱5,000**, without an override. Multiple receipts may support an advance greater than ₱5,000, subject to the office fund balance. Duplicate files and duplicate vendor/number/date combinations are rejected.
- An independent appointed Head endorses receipts or returns them for correction. Accounting settles after endorsement and confirmation of unspent cash returned. If nothing was spent, the recipient submits a full-return declaration without inventing a receipt.
- **Only active Accounting Officers (`accounting_staff`) in that office can replenish.** Heads, members, Admins, and foreign-office officers cannot do so. Both UI and server enforce the rule.
- Replenishment records actual money received, amount, reference, transaction date, and officer. Partial replenishment is supported. Cash plus outstanding advances cannot exceed ₱30,000; unsettled advances cannot be replenished as though spent.
- Replenishment preserves all requests, receipts, receipt correction snapshots and audit events. Duplicate replenishment references and duplicate command keys are blocked/idempotent respectively.
- Red error panels display rejected commands and invalid amounts. Uncertain submissions retain their command key/payload in session storage for retry after reload. The UI background-refreshes without a balance-reset button.

## Technical boundaries

The additive `eflow_office_cash` schema owns its fund, request, command and audit tables. Authenticated callers have no direct table-write privileges. Public RPCs are SECURITY INVOKER wrappers around private, identity/office/role-checked functions with fixed empty search paths. All private tables have RLS enabled and no client policies intentionally: only checked functions access them. The private receipt bucket restricts uploads to the recipient's released request and reads to the recipient or authorized same-office reviewers. Uploaded receipt objects cannot be overwritten or deleted by clients.

Commands serialize on the office fund row and actor/key lock. The database performs all amount and transition checks atomically. Project/task funding functions and tables were not modified. The new fund has its own cashbook/audit view; it does not generate entries in the existing task-cash General Journal or claim an annual appropriation deduction. Formal journal/account mapping for this separate fund is outside this implementation.

## Deployment and verification

Target: `ixnfphgjyelhckjwjkdv` only. Migration: `20261031094730_office_petty_cash_fund.sql`.

A fresh database/roles archive was verified before deployment. Exact live migration history was fetched into an isolated workspace; dry run selected only the new migration, without seeds or roles. All 115 existing public-table row fingerprints remained unchanged. See `DEPLOYMENT_RECEIPT.json`.

Database acceptance passed **34 assertions** using real authenticated roles, entirely in a rolled-back transaction. Synthetic receipt storage metadata is created only inside that rollback; this is not proof of browser file upload or real physical cash handling. See `INSTALLED_CHECKS.json` for the exact assertions. The **5 focused UI tests** cover role controls, an unfunded task, depletion and recovery of an uncertain command. The **3 navigation tests** also pass after adding the separate view. TypeScript and the final production build passed. Graphify refreshed with the same four known partial-extraction warnings.

Security comparison added no WARN/ERROR findings. Four new INFO findings are intentional for the private RLS-enabled tables with no direct client policies. See `SECURITY_REVIEW.json`. The unrelated invalid `N` prop in `WalkthroughButtons.tsx` was removed because it blocked the repository TypeScript check.

The complete unit run was **not fully clean**: 2,156 tests passed and 11 failed, plus an empty-suite error. Updated navigation expectations now pass, as do five initially failing/timed-out tests in a bounded single-worker followup (44 passing tests). Remaining results concern the earlier subtask header order, an empty test suite, and two concurrent-run readiness timeouts. They were not changed as part of this financial feature. Exact status is in `VALIDATION.json`; no completely clean full-suite run is claimed.

## User verification

1. As Accounting, open the new view and record the initial money received (up to ₱30,000). Verify the audit reference/officer.
2. As Crisostomo, request petty cash. Confirm the task and project balances do not change.
3. As Cheryl, reject once; request again as Crisostomo, then approve as Cheryl.
4. As Gabriel/Accounting, record release. Confirm approval alone had not reduced physical cash, but release does.
5. Upload real receipts as Crisostomo. Test ₱5,000 accepted, ₱5,000.01 rejected, and multiple distinct receipts. Test returning receipts for correction.
6. Endorse as Cheryl; settle as Accounting after actual cash return. Confirm outstanding advances clear and only unspent returned money increases the cash balance.
7. Test partial replenishment, duplicate reference, depletion and reload. Heads/members must never have a replenishment control or succeed by calling the RPC.
8. Check the native browser's file picker, signed receipt opening, responsive layout and concurrent users. eFlow Mobile requires a separate native implementation; this change is in eFlow Web.
