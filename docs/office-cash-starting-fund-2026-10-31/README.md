# Office petty cash and simpler task cash — October 31, 2026

## Corrected behavior

- One shared ₱30,000 starting fund per office. No Accounting deposit or approval is required to initialize it. An authorized office member's first read creates the starting balance and an automatic setup audit event exactly once.
- Every project/task in that office sees the same fund. Reading again, changing projects, or refreshing never adds more money. New offices initialize on first authorized use. Existing fund activity is preserved.
- Petty cash stays separate from project/task budgets. Each receipt is limited to ₱5,000. Requests reserve available cash; releases reduce the fund; settlement returns unspent cash. Existing Head request approval, Accounting release/settlement and receipt-review rules remain unchanged. This change removes the **opening deposit requirement**, not those request lifecycle checks.
- Only the Accounting Officer can replenish settled spending. Pending requests and unsettled advances cannot be treated as money already spent and replenished. No automatic calendar reset.
- The petty-cash panel shows available cash, pending requests and unsettled cash. Accounting's detailed fund figures and audit history are collapsed.
- Task cash asks for amount, needed-by date, purpose and an optional attachment. It uses existing task allocations automatically. The add-funding/source-row controls are removed. Requests spanning several existing allocations retain a read-only breakdown; source selection remains only for older single-source APIs with multiple task allocations.
- Subtask caps, overall task availability, source availability and cents are checked before submission. Database funding, approval and cash-release checks remain authoritative.
- Funding breakdowns and accounting figures are available under **Budget details**, rather than filling the task's main screen.

## Deployment and verification

Only migration `20261031140336_automatic_office_petty_cash_starting_fund.sql` was installed on `ixnfphgjyelhckjwjkdv`. A fresh database/role backup was verified first. Deployment used an isolated folder populated with the 68 live migration versions. Dry run selected only this delta, without seeds, roles, timestamp repairs or historical migration replay.

The migration changes the private fund default and adds an actor/office-checked internal initializer. Snapshot/command functions call that initializer; the initializer is not directly executable by public, anonymous or authenticated clients. Existing wrappers and role checks are preserved. All 119 captured public/petty-cash table fingerprints remained unchanged during deployment.

The supported snapshot was then called for LEDIPO as an active Member. The office has **₱30,000 cash and ₱30,000 available**, one automatic setup event, no requests and no replenishment transaction. A second read did not add money. See `LIVE_STARTING_BALANCE.json`.

Candidate and installed database acceptance each passed **35 assertions** in rolled-back transactions. These cover initial funding without a deposit, no repeat initialization, sharing/reservations, request/release/settlement, ₱5,000 receipts, overspending, duplicate retries and references, Accounting-only replenishment, anonymous/foreign-office denial and unchanged project/task/annual funding. No test requests, receipts or settlements were retained.

The 25 focused UI/selector tests passed for simplified requests, multi-source automatic allocation, exact cents, subtask caps, excessive amounts, cancellation, role controls, funding office scope and retry recovery. TypeScript and production build passed. Browser interaction remains for the user's manual verification.

Supabase advisors still report existing wider-system warnings. No advisor finding names the new private initializer; direct execution is denied. This is not a claim that unrelated warnings were resolved.

## Manual checks

1. Refresh LEDIPO and open Office petty cash from any task. Confirm ₱30,000 initially; another task/project must show the same balance.
2. Submit a request. Confirm the shared available amount decreases once. Cancel/reject it and confirm availability returns. Follow the existing approval, release and receipt flow; check each receipt's ₱5,000 limit.
3. Settle actual spending, then replenish as Accounting. Members and Heads must not see or execute replenishment.
4. Open Request task cash. Enter an amount and purpose without choosing another office-budget source. Confirm over-budget requests show a red error and are blocked.
5. For a task with several allocated sources, request across them. Check the recorded breakdown and verify project/office budget authority is not charged again.
6. Open a subtask during loading: spinner and skeleton are shown, Back to work stays usable, and Retry appears after a failed load.
