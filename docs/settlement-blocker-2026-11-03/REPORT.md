# Cash settlement blocker — 3 November 2026

## Finding in the real database

Target: `ixnfphgjyelhckjwjkdv`. Task-funded cash request **PC-00001**, amount **PHP 4,000**, is still open on **Customer Service Seminar → Customer Service Seminar Venue Reservation**. This is the project/task funding workflow, not the separate Office Petty Cash revolving fund.

- Request: `12450515-c5e7-4fb8-830c-d73be2a35095`.
- Liquidation: `b1562f40-69a9-40e3-b4aa-db3a4176972f`, version 1.
- Gabriel Cahiyang is the requester, cash recipient and current operational task assignee. He is also the only active Accounting Officer.
- Cheryl Gallo is the Project Lead and the recorded cash receipt reviewer/leader. Her receipt endorsement was saved on **31 October 2026, 11:46 PM Philippine time**.
- PHP 4,000 was released and PHP 4,000 declared spent, with no returned amount.
- Both request and liquidation remain `pending_department_settlement`. `settled_at` and final liquidation `decided_at` are null; the request has **zero expense-posted ledger entries**.
- The liquidation was submitted before its 15 November deadline. Late-package authorization is not the blocker.

The live review RPC returned, for both Gabriel and Cheryl: `required: true`, `eligibleSettlers: 0`, `candidates: []`, `canSettle: false`, `escalationRequired: true`.

The system has an eligibility deadlock. Receipt endorsement is saved, but there is no independent Accounting Officer available to post settlement. The existing conflict-review rule also excludes Cheryl as an independent reviewer because this cash record already names her as its receipt leader. Therefore an independent leadership review appointment is also missing for this particular case.

A real settlement call under Gabriel's authenticated identity returned SQLSTATE **42501**, `A separate eligible Accounting Officer must settle this package`. The call ran inside a transaction that was rolled back. A subsequent check confirmed the original statuses, saved endorsement and zero expense postings were unchanged.

## User's decision

The user explicitly chose **Require another independent Accounting Officer (keep current rule)**. No delegated Head settlement, self-settlement or automatic financial approval was introduced.

The existing request cannot be marked settled just because Cheryl endorsed it. It needs an eligible independent Accounting Officer and the required independent leadership review. That is an account/appointment requirement under the preserved policy, not a missing database status update.

## Changes made

- The user-facing `pending_department_settlement` label now says **Awaiting Accounting settlement**.
- Funding activity explains when receipts were endorsed but the settlement posting remains outstanding. It does not report an unendorsed submission as an approved receipt package.
- A missing eligible Accounting Officer now produces an explicit red **Settlement blocked** notice, including the independent leadership-review requirement when no reviewer is available.
- This notice also appears for ordinary cases with zero eligible settlers, where the previous independent-review card returned nothing because extra leadership review was not required.
- Existing leadership review/routing actions remain available when their reviewer is eligible, even while Accounting staffing is unresolved. The notice does not remove those workflow actions.
- An inconsistent approved-liquidation/open-cash-request combination is shown as a red reconciliation error rather than falsely reporting that the advance cleared.

No database function, schema, policy, actor role, password or account was changed. No financial transaction or journal was committed. The real PC-00001 remains open intentionally under the rule the user retained.

## How to demonstrate a complete cycle with the existing three accounts

For a new demonstration where all three remain independent:

1. **Cheryl:** Project Lead; define project details, funding and approvals.
2. **Crisostomo:** lead the funded parent task and receive/request its cash. He can create and manage its subtasks, perform the work and submit receipts.
3. **Cheryl:** review the work and endorse the receipt package.
4. **Gabriel:** handle Accounting only for that package; release cash, verify acknowledged receipt, settle the liquidation and post the journal.
5. Complete the work/project after the cash request is actually settled, then archive through the existing checks.

Gabriel must not be the requester, recipient, operational task lead or receipt reviewer on a package he is expected to settle. Making him the funded parent-task lead and expecting him to settle it later recreates the conflict, even if a subtask is assigned to Crisostomo.

This is a recommended fresh demo arrangement; no demo records were created or reassigned during this investigation. To finish the existing Gabriel-owned PC-00001 instead, resolve its independent Accounting and review appointments through the authorized management workflow.

## Validation

- Live current-state inspection, role-scoped review RPC for both actors, rolled-back negative settlement call, and unchanged ledger/status readback.
- **58 targeted tests passed** across seven files: endorsement versus settlement, missing appointments, retained leadership actions, independent posting, correction/retry behavior and task completion's financial blocker.
- **Two desktop Chromium cases passed:** independent Head review followed by a separate Accounting settlement, and the explicit zero-eligible-actor blocker. The initial browser attempt had a cold-start timeout and an incorrect test URL; the test now uses the actual Settlements sidebar entry and both cases passed.
- Type checking and production build passed. Logs and desktop evidence are saved alongside this report.
- Browser fixtures are synthetic and intercepted, not proof that PC-00001 was financially settled.
