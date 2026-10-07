# Office Budget rework — final plan for confirmation

Date: 7 October 2026 (Asia/Manila)  
Status: Approved by the user on 7 October 2026; staged implementation in progress.  
Target: Office · Fiscal control → Office Budget, with the connected task, subtask, project and Accounting Staff screens.  
Hosted database target: `ixnfphgjyelhckjwjkdv` only.

## 1. What this plan is based on

The five attached images were inspected again at their original resolution. They define the report structure. Current source code and read-only live checks establish the existing behavior. Recommendations below supply the connections that a photograph cannot establish.

| Reference | Visible evidence | Planned result |
| --- | --- | --- |
| Images 1 and 3 (the same photographed page) | “Summary of Petty Cash Expenses”; PCV headings; Store, Receipt No., Date, Quantity, Particulars, Amount, Total, Purpose, Expense Account; receipt and voucher totals | A voucher register containing receipt groups and purchased items, with a matching print report |
| Image 2 | PCV 13 covers June 26 and 30; PCV 14 covers June 27 and July 7; several vendors/receipts; different purpose/account labels within a voucher | Independent receipt dates, voucher date/covered period, multiple vendors, and per-item expense-account assignment |
| Image 4 | Annual summary with appropriated, for later release, released, obligated, utilization against total appropriation and against each account, and balances; MOOE/MOE group with Generic Accounts, Business Development and Investment Promotion; OCIIB, Capital Outlay and Personal Services shown separately | Configurable budget partitions, account breakdowns, and both utilization measures |
| Image 5 | Appropriation, Hold, Release/Added, Usage/Obligated/Augmentation, User and Running Balance; negative balances displayed in red | A dated utilization ledger with clearly identified additions, deductions, responsibility, and a signed running balance |

The photos do not establish approval authority, cash limits, legal account definitions, voucher-to-request cardinality, or the database meaning of “obligated.” Existing permissions and cash controls remain the baseline; proposed choices are stated explicitly below. Cropped account lists are not treated as complete.

The photographed amounts are reference examples and test fixtures. They will not replace the live appropriation or create real transactions.

## 2. Current system, checked again

Read-only checks on the main project found:

| Record | Count |
| --- | ---: |
| FY 2026 annual budget | 1, locked |
| Annual budget lines | 1 |
| Proposal commitments | 0 |
| Task/subtask allocations | 0 |
| Cash requests, releases and liquidations | 0 each |
| Fiscal ledger and general journal entries | 0 each |

The budget's update time is 27 September 2026, 9:38:54 PM Manila time, matching the user's quoted screen. Its update timestamp is not evidence of the last financial transaction or real-time freshness.

Verified source findings:

- Annual setup saves one generic appropriation line. It cannot prepare the photographed partitions.
- The older proposal-publication workflow supports commitments and approved task allocations. Creating work directly in the current project table or importing work does not itself approve funding. Its budget cell is a planning estimate.
- A contextual cash request currently selects one task allocation line. Receipts contain vendor/date/number/description/amount/file, without separate purchased-item records.
- The general journal supports an allocation-line account mapping but can fall back to a generic expense account. Itemized mixed-account settlement needs explicit mappings and multiple expense postings.
- The project budget selector filters records by task but retains the Office-wide summary. Project figures need their own rollups.
- Task budget cards load the current fiscal year. They need to follow the allocation's actual fiscal year for older or continuing work.
- The current audit view reads the latest 100 fiscal events and only matches selected journal links through release/voucher metadata. Complete history and links to liquidation/correction records need improvement.
- Current cash execution belongs to authorized Accounting Staff. The Head authorizes funding; Accounting Staff release cash and settle receipts. Late liquidation has an additional Head authorization. Earlier descriptions assigning ordinary settlement to Head/Assistant Head are superseded by this source check.

The broad live-schema checker still reports the pre-existing missing `set_task_governance_route` RPC. Its listed financial objects are present. Object presence and zero record counts do not prove an end-to-end financial workflow has passed live acceptance.

## 3. Dynamic annual budget builder — user's confirmed direction

The budget is built from user-created sections. There is no fixed or mandatory list of MOOE, OCIIB, Capital Outlay, Personal Services or program sections. The names in the photographs are examples the user may choose to enter.

Place a prominent **Total Budget: ₱…** counter at the top of the annual setup. It automatically sums the amounts in the budget and updates immediately when the user adds/deletes a section or changes an amount. Show zero for an empty draft. This counter is the total of the sections; the user does not have to type the same total separately.

The builder provides:

- **Add section** with a custom name and amount.
- Rename, reorder and delete sections while preparing the draft.
- Add optional subsections and expense-account rows where a detailed breakdown is needed.
- Show each section's subtotal and keep the overall Total Budget visible while editing.

A simple section can hold its amount directly. When it has a detailed breakdown, its subtotal comes from its child rows. The total counts each amount once; it must not add a parent subtotal to the same children's amounts. Converting a simple section into a detailed breakdown retains its existing amount until the user distributes or explicitly revises it.

Example only:

```text
Total Budget: ₱450,000

Office Supplies      ₱300,000    [Rename] [Delete]
Training             ₱100,000    [Rename] [Delete]
Travel                ₱50,000    [Rename] [Delete]

[Add section]
```

Expense-account rows store their code, name, approved amount and place in the user-defined sections. Account codes shown in the photos may be configured as reference labels; they must map explicitly to the journal account catalog before posting. Unreadable or missing account codes remain unmapped for review. A section called “OCIIB,” if added by the user, does not itself confer inter-Office transfer authority.

The Head prepares the dynamic sections and locks the approved plan. At lock, the calculated Total Budget becomes the approved annual total. Later additions, reductions, reclassification and transfers require an audited adjustment. Unused sections can be removed through that adjustment; sections already referenced by funding or expenses can be retired from future use while their financial history remains available. The existing locked annual amount cannot silently change when sections are added or removed.

## 4. Money meanings and calculation rules

| Term shown to users | Meaning |
| --- | --- |
| Appropriated | Approved annual amount for that account |
| Hold / for later release | Portion of annual authority currently withheld from use |
| Budget released | Authority now available to fund work |
| Obligated / committed | Authority charged once for approved work, including its eventual verified spending |
| Cash released | Money actually handed to a recipient |
| Verified expense | Spending accepted after receipts are checked |
| Available to fund | Budget released minus commitments already charged |
| Cash awaiting receipts | Cash handed out that has not yet been settled |

Annual withholding and a pending cash request's temporary reservation are different records. The interface will name both clearly.

Proposed application rules for confirmation:

1. Net appropriation = original appropriation + approved signed adjustments.
2. Budget released = net appropriation − the portion still held for later release.
3. Available to fund = budget released − commitments charged to that account.
4. Published proposal funding or an approved direct-work allocation charges the commitment once. Requests, releases and settlement move money inside that commitment; they do not deduct it again from the annual budget.
5. Verified spending is tracked separately as a part of committed authority. When work closes, only the unused portion may be explicitly decommitted; recorded expenditure stays charged.
6. Returned cash restores the task's requestable balance. It does not automatically free the entire proposal/task commitment for other work.
7. Utilization against the account = its obligated amount ÷ its net appropriation. Contribution against total appropriation = that account's obligated amount ÷ total net annual appropriation. Show actual-spending utilization separately, because the current app uses verified spending for its existing Q4 signal.
8. Zero denominators show an understandable empty percentage. Calculations use exact cents.
9. Historical/reconciliation deficits remain visible as negative balances. New funding that would exceed an account's available authority is blocked; one account's surplus cannot silently cover another account's deficit.

These formulas are the proposed eFlow convention. The photographs show the columns and sample totals, but not their formulas or the Office's formal obligation policy.

Example: an account has ₱50,000 appropriation, with ₱10,000 held. It has ₱40,000 available authority. Approving ₱10,000 for a task leaves ₱30,000 available for other work. The task later receives ₱4,000 cash, spends ₱3,500 and returns ₱500. Its remaining task balance is ₱6,500; the account still carries the original ₱10,000 commitment until unused authority is explicitly freed.

## 5. Connect the current work routes

Every approved funding line points to a real FY account partition.

- **Proposal route:** select partitions in task budgets; publication atomically creates the commitments, task allocations and account charges once.
- **Current project route:** add a Head-controlled “Fund this work” action for manually created or imported tasks. It creates a real authorization and allocation against selected accounts without inventing a proposal. The planning estimate alone cannot reserve money.
- **Subtasks:** retain the shared task pool and optional protected caps. They inherit the funded lines and cannot allocate the same amount twice.
- **Routine Office spending:** permit an approved Office-operations funding context with purpose, responsible person and account, so supplies are traceable without fabricating a project proposal.
- **Other recorded spending:** allow authorized obligations/verified expenses backed by PO, payroll or other existing document references, so non-petty spending can appear in the annual utilization view. This is a finance record and evidence connection; it does not build a procurement or payroll processing engine. Its funding charge and accounting posting must not duplicate a transaction already recorded elsewhere.

Preserve the actual funding Office and requester Office as separate values for shared work. The existing owner-funded model remains; a ledger label does not authorize inter-Office transfers.

Office, project, task, subtask, petty-cash and accounting screens will read the same underlying records and correct fiscal scope. Project totals will aggregate that project's funding; Office totals will aggregate the whole Office.

## 6. Petty-cash voucher and purchased items

Add a stable PCV reference while keeping existing request, cash-release voucher and liquidation-version references.

Proposed initial grouping: one PCV belongs to one approved request/funding context and one recipient. It may link several partial cash releases, vendors, receipt dates and expense accounts. The photos establish multi-receipt PCVs; the one-request grouping is an implementation recommendation, not a proven property of the paper process.

Support several requested funding lines inside that request so one voucher can legitimately contain different approved expense accounts. Reserve each line atomically. Existing single-line requests continue through a compatibility adapter.

```text
PCV number, voucher date and covered dates
  → Store / receipt number / receipt date / uploaded receipt
      → Quantity / unit / particulars / line amount / purpose / expense account
  → Receipt totals
  → PCV total
  → Returned cash and refund evidence
```

The pictured Amount is treated as an item-row total. Unit cost may be entered when known, but the app will not multiply an already-totaled amount by quantity a second time.

Each purchased item is linked to an approved account/source line. The receipt can be split across different approved accounts. A change outside the request's authorized accounts goes back for authorization. Correction packages retain earlier receipts and item versions.

Numbering is unique per Office and fiscal year, with a short display such as “PCV 08.” Existing DV and LIQ references remain usable. Receipt numbers preserve letters and leading zeroes. Date ranges are derived from the included receipts instead of forcing all purchases onto one date.

Settlement requires item totals = receipt totals, receipt totals = declared spending, and spending + returned cash = acknowledged cash released. A package cannot be counted as verified merely because its files were uploaded.

Keep existing configurable daily release ceilings, per-receipt rules, partial release scheduling, acknowledgement, deadline and late-authorization rules. The current defaults are ₱30,000 daily release, ₱5,000 per-receipt control and 15 days for liquidation; these come from the system, not from the photographs.

## 7. Office Budget screens and reports

Keep the Office Budget navigation destination and current deep links. Add the new views within its existing workspace groups:

| Area | Views |
| --- | --- |
| Overview | Annual position and partition utilization table |
| Planning & Allocation | Annual partitions; proposal, project and task funding |
| Petty Cash / Requests & Settlement | Request queue, PCV register, cash releases, receipts and settlement, verified expenses |
| Ledger & Audit | Fund Utilization Ledger, Audit Trail, existing General Journal |

The annual setup starts with the live Total Budget counter and the user-controlled section builder described above. Report rows and account filters are generated from those sections; they do not depend on a hard-coded list of budget groups.

The overview reproduces Image 4's information: Appropriated, For Later Release, Budget Released, Obligated, both utilization percentages, and Balance. Expand a group to inspect its expense accounts and transactions.

The utilization ledger reproduces Image 5's useful columns: date/reference/particulars, appropriation, hold, release/added, usage/obligation, responsible unit/person, and running balance. Explicit transaction types show whether an augmentation adds money or a usage entry deducts it.

The petty-cash summary reproduces Images 1–3: voucher header, Store, Receipt No., Date, Quantity, Particulars, Amount, Total, Purpose, Expense Account, receipt subtotals and PCV totals. Export CSV and produce a dedicated print/PDF layout with repeated headers, continuation labels and correct totals across pages.

The photos contain financial registers, not a complete audit screen. The audit view is a system recommendation: who changed what, when, reason, before/after balances, work/account/PCV links and supporting evidence. Provide filters and paged complete history beyond 100 records. Connect releases, liquidations, returns and corrections to their actual journal entries using stored references.

## 8. Roles, old records and delivery

Preserve the current role model: Head funding authorization; Task Leader endorsement where required; recipient acknowledgement and receipt submission; independent Accounting Staff cash release and settlement. Late packages retain the additional Head check. Prevent self-approval and do not add an Assistant Head role from historical documentation. If an eligible independent reviewer is missing, show the existing authority requirement instead of allowing self-approval.

The current locked annual total remains the opening authority. Initially represent its amount as “Unclassified opening appropriation.” Distribution into real groups and accounts is an audited setup operation, with amounts entered/reviewed by authorized users. No photo-based amounts, inferred historical cash transactions or test purchases are inserted into the live budget.

Add new records and versioned operations with compatibility adapters; preserve old references and public callers. New tables, views and receipt access follow the existing Office/task permissions and [Supabase's grants and RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Deliver in small tested slices:

1. **Dynamic budget foundation:** add/rename/reorder/delete sections, top Total Budget counter, optional account breakdowns, original allocation, holds/releases, audited adjustments and legacy classification.
2. **Funding connections:** proposal publication, direct project work and Office operations, correct fiscal year and scoped summaries.
3. **PCVs and items:** multi-line request funding, receipt/item entry, stable numbering and versioned corrections.
4. **Accounting:** explicit expense-account mapping, mixed-account settlement, return handling and source-linked balanced postings.
5. **Workspace and reports:** overview, account ledger, PCV register, audit history, responsive forms and dedicated exports.
6. **Acceptance and rollout:** prove balances, roles and persistence, then use the approved main-project migration workflow with an isolated workspace populated from live migration history. Never apply the historical repository migration folder wholesale or rewrite deployed timestamps.

Each implementation slice requires `npm run check`, `npm test` and `npm run build`; run relevant configured browser coverage and database allow/deny, idempotency and concurrency tests. Refresh the local Graphify map after structural edits. The pre-existing broad-schema failure is recorded separately and cannot be called a passing global verification.

Acceptance must prove: users can add/rename/reorder/delete draft sections; the top Total Budget counter updates immediately and counts nested amounts once; removing the final draft section shows zero; recorded sections retain their history when retired; partition totals match the annual total; held funds cannot be committed; simultaneous authorizations cannot overspend an account; retries cannot duplicate charges; project/imported tasks can obtain approved funding; estimates remain estimates; mixed-account receipts settle into the right accounts; returned cash restores the correct task line; older fiscal years load correctly; complete ledgers and print reports agree; corrections preserve evidence; and each role sees/actions only its permitted records.

Use the photographed PCV 08 item totals (₱873 + ₱570 + ₱330 = ₱1,773), PCV 13's multiple dates/vendors, Image 4's total appropriation of ₱6,919,995 and obligated total of ₱4,302,676.49 (62.18%), and Image 5's hold/release and negative-balance cases as synthetic verification examples. These are not live opening balances.

## 9. Confirmation

The user approved implementation with “alright lets go implement it” on 7 October 2026. The dynamic builder, financial meanings, direct-work funding route, multi-account PCV structure, current role split, ledger/report layout and staged implementation above are the implementation scope. Local implementation, database rollout and live acceptance are tracked separately; approval is not a claim that any stage is complete.
