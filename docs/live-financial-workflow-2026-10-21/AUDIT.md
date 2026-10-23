# Live project and finance workflow audit — 21 October 2026

Status: targeted walkthrough complete. This file retains the working chronology; see [REPORT.md](REPORT.md) for final results and [GALLERY.html](GALLERY.html) for 45 screenshots. Desktop browser at 1440×1000, with final archive checks at 1918×914; real localhost app and hosted target ixnfphgjyelhckjwjkdv. User approved labeled QA records and existing test accounts. No invitation emails or bank/payment transactions were part of the run.

## Test records

- Project: QA 21 Oct 2026 — Cash and Delivery.
- Office: LEDIPO; appointed Head Cheryl Gallo.
- FY 2026 initially had an empty draft budget, approved amount zero, no sections. Added QA 21 Oct — Workflow verification, PHP 10,000, held zero, explicit QA notes. Daily ceiling PHP 30,000; receipt review threshold PHP 5,000; liquidation due 15 days. No unrelated section was replaced. Saving/locking is recorded test authority, not actual money movement.

## Verified steps

1. Head development-account login; role-appropriate dashboard and Office Budget navigation.
2. Annual-budget invalid hold PHP 12,000 against PHP 10,000: save and lock blocked with validation. Restored hold zero.
3. Saved draft and locked with the confirmation screen. Hosted read confirmed status locked, approved amount 10,000, version 3. Money input displays 10,000.
4. Created the labeled project through its normal creation UI.

Screenshots are numbered in this folder. This working chronology is completed by the evidence-linked continuation below; REPORT.md remains the final result. A navigation click or server response alone is not counted as a passed end-to-end workflow.

## Verified continuation

5. Set project dates 21–31 October 2026. Added Crisostomo and Gabriel through Add people. Root task QA Purchase registration supplies: Crisostomo lead, Gabriel contributor, start 21 October, due 28 October at default 11:59 PM. Gabriel-led child QA Buy supplies and collect receipt, due 25 October.
6. Exact duplicate subitem rejected and no extra row saved. Discarded its failed draft.
7. Funding PHP11,000 from PHP10,000 rejected by server for insufficient released budget. Authorized PHP2,000 instead; source balance PHP8,000. Mapped source to journal expense account 50299990.
8. Confirmed the three Head plan reviews and activated the project (9/9 checks).
9. Crisostomo started root work. Requested PHP100 (FR-00001); pool reduced to PHP1,900. Cancelled with reason; pool restored to PHP2,000 and cancelled record retained.
10. PHP2,100 cash request against PHP2,000 task pool disabled submission. No write occurred. This exposed missing inline explanation; fixed.
11. PHP500 FR-00002 submitted by Crisostomo. Cheryl declined with reason; status rejected, queue cleared and pool restored to PHP2,000. This is a terminal rejection, not the correction/resubmit branch. FR-00003 explicitly replaces it with one lot of supplies, receipt requirement, planned PHP400 spent and PHP100 returned. All values simulated.

## Reproduced bugs and fixes in progress

- B01: Appointed Head could fund manually/imported work through Office Budget but task Overview hid the same action unless the Head also happened to be the task lead. Separated fiscal oversight from contributor/execution eligibility; current appointed responsible Office Head only, closed/unresolved work and refresh locks retained. No backend permission changes.
- B02: A confirmed schedule still displayed 'Set both project dates in the Timeline view.' Confirmed checks now state that the dates and schedule are valid; failing checks retain server guidance.
- B03: Over-budget cash form only disabled Request cash, without explaining the failed amount. Added inline source/amount feedback and duplicate funding-source feedback; kept server and disabled-state enforcement.
- B04: Requester saw Rejected without the Head's reason. Cash timeline now shows reviewer feedback and distinguishes terminal rejection (new request) from correction (same request). Receipt corrections show existing review feedback too.
- B05: Cash form, funding metrics and timeline used 8.8–10.5px text, difficult to read at desktop 100%. Raised these scoped cash controls to 12–13px and form buttons to 40px. Background authority verification now explains why the form is paused and says the draft is retained.

At this stage B01–B05 changed UI only. The three subsequently reviewed database migrations are documented below. Application record writes used the real browser UI; hosted reads supplemented the evidence.

## Additional requested scope

The user requested two tasks with all supported columns exercised, renamed Budget (not Budget estimate), with actual fiscal impact. The table now reads approved root allocations rather than task.budget_impact. The column opens the existing audited funding authorization for the appointed responsible Office Head. Imported plan figures remain visibly labeled as a plan until authorization; they are never silently charged. Group totals sum approved root allocations only, excluding subitem caps and unrelated work. One Office ledger subscription is shared across table rows. No new financial mutation/RPC was introduced.

## Additional reproduced issue

B06 — Release date mismatch: 21 October Manila morning was still 20 October UTC. The dialog offered an early override for today's tranche, and normal server release rejected it. Changed the dialog to the shared Philippine calendar helper. Live inspected functions also used session current_date and released_at::date; added function-local Asia/Manila settings for scheduling, normal/accounting release, audited override and journal trigger. Bodies, grants, RLS, locks and daily ceilings preserved. Applied reviewed migration only to ixnfphgjyelhckjwjkdv through the migration tool, with live-history manifest and isolated pending workspace in C:/Users/gabri/AppData/Local/Temp/eflow-qa-manila-migration-20261021. Live timestamp preserved in repository: 20261020232324_cash_release_manila_calendar.sql. Same QA release then succeeded normally, voucher DV-2026-00003-817060; no override or duplicate release was used.

Gabriel submitted child evidence; Crisostomo requested changes with explicit return-balance feedback. Crisostomo acknowledged QA release and submitted itemized liquidation v1: fictional vendor, QA receipt PNG, PHP400 expense, PHP100 return reference QA-RETURN-100. It routed to independent Accounting settlement because requester is the task lead. Real bank transfer/purchase did not occur.

## Budget column and full-column QA

Two actual browser-created tasks now use all nine supported columns. Task 1: LEDIPO, Crisostomo lead/Gabriel contributor, in progress → final review, 21–28 Oct at default 23:59, high priority, 2 hours, no prerequisite, PHP2,000 authorized. Task 2 (505eb89d-8e11-475e-a3fd-2411aca662d1): LEDIPO, same team, 28–30 Oct with explicit 15:30 deadline, low priority, 3 hours, depends on task 1, PHP1,000 authorized through its Budget cell. Group footer shows 5h and PHP3,000 actual approved funding, not old estimates. Hosted read confirmed all persisted values, including exact ISO deadlines and dependency UUID. Attempting a dependency cycle was rejected without saving.

B07 — Table budget was disconnected: PHP2,000 was reserved but the old cell and total showed blank/zero because they read budget_impact. Replaced the column editor with an authorized-ledger budget cell and funding dialog, renamed the catalog to Budget, summed root allocations only, and preserved source-PDF plan amounts as visibly unapproved suggestions. One subscription per Office is shared across the table; joined Office funding remains permission-scoped. Realtime refresh retains an open funding draft, with actions disabled until verified. Existing funded rows cannot be authorized twice.

B08 — Dependencies were stored and cycles validated but final submission did not enforce them. QA demonstrated parallel preparation could start. The Work screen now explains waiting prerequisites and prevents final submission until approved; the database independently guards entry to for_review/completed. Missing/restricted/cancelled prerequisites do not count as approved. Preparation remains possible. Server guard tested transactionally on a disposable temporary table: pending prerequisite rejected, preparation allowed, approved prerequisite allowed; rolled back. Reviewed migration deployed to ixnfphgjyelhckjwjkdv only, live timestamp 20261020234944_task_dependency_final_review_guard.sql. Existing task-status transition guard, grants and RLS retained.

B09 — Project completion blockers told the Head to settle receipts even though independent Accounting owns the decision. Updated pending-settlement guidance to Accounting → Settlements.

B10 — Settlement journal still used UTC business dates. QA settlement entry dated 20 Oct while Manila was already 21 Oct. Applied function-local Asia/Manila to post_liquidation_general_journal (20261020234410_liquidation_manila_calendar.sql). Existing immutable QA journal row intentionally retained as before-fix evidence; release entry is correctly dated 21 Oct. No historical financial records were rewritten.

Accounting settlement succeeded independently under Gabriel: PHP400 expense + PHP100 cash return = PHP500 advance cleared. Trial balance debit PHP1,000 = credit PHP1,000 across release and settlement. Original receipt evidence and the rejected first child submission remain immutable. Second child submission includes the requested return reference and was approved by Crisostomo. Parent final submission blocked self-review and was sent to Head.

## Recorded final continuation (cross-linked 22 October)

This section completes the original October 21 working chronology from its retained report and captures. It does not represent a new live execution or additional transactions on October 22.

| Step | Recorded action/result | Retained evidence |
|---|---|---|
| 32–33 | Head inspected the first task after independent cash clearance and approved it. | [Cash clearance](32-head-review-cash-clearance.jpg), [first task approved](33-first-task-approved.jpg) |
| 34–35 | Second task's blocker was recorded and cleared; its final submission followed prerequisite approval. | [Blocker](34-second-task-blocker.jpg), [submission](35-second-task-submitted.jpg) |
| 36 | Both required tasks approved; supported table columns and the 5-hour / ₱3,000 totals retained. | [Approved work](36-both-tasks-approved-all-columns.jpg) |
| 37 | Completion checks passed after work review and settlement. | [Completion checks](37-completion-checks-passed.jpg) |
| 38–39 | Completed project archived and opened read-only. The old autosave wording shown here became B12. | [Archive](38-project-archived.jpg), [read-only page before wording correction](39-archived-read-only.jpg) |
| 40–41 | Separate disposable unstarted work used soft-delete confirmation; another unfunded task was cancelled with a reason. These were not a permanent project purge. | [Delete confirmation](40-disposable-delete-confirmation.jpg), [cancellation](41-task-cancellation-with-reason.jpg) |
| 42 | Annual authority ₱10,000; commitments ₱3,000; available ₱7,000; expense ₱400; return ₱100; unsettled ₱0 reconciled. | [Office Budget](42-final-office-budget-reconciliation.jpg) |
| 43–45 | The recorded restore → complete → archive continuation ended archived. Authorized budgets stayed intact; read-only wording and cancelled-task denominator were corrected. Final view shows 2/2 required tasks, 100%, with cancellation retained. | [Final archive](43-final-archive-desktop.jpg), [retained authority](44-authorized-budget-preserved-after-archive.jpg), [final table](45-final-table-budget-progress.jpg) |

All 45 original images and original failed/partial test logs remain unchanged. The older unit and browser receipts were fragmented, as disclosed in REPORT.md; the separate [October 22 remediation status](../financial-qa-remediation-2026-10-21/STATUS.md) records the new verification runs and their limits.
