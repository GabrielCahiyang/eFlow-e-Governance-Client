# Project definition, quarterly funding and review workflow

Implemented 30 October 2026. Hosted target: `ixnfphgjyelhckjwjkdv`.

## What changed

| Area | Previous problem | Implemented behavior |
| --- | --- | --- |
| Creation | Creation jumped to Add people before defining the project | Creation opens project details. Save incomplete drafts; finish required details and funding before adding work or additional people. |
| Definition | No explicit project scope or operational lead | Required title, description, scope, active implementing-office project lead, project start and target dates. Implementing office remains the selected workspace. |
| Setup enforcement | Alternate destinations could bypass the setup order | Database guards cover tasks, subtasks, memberships, invitation requests, additional offices, sharing grants and guests. Initial lead office and owner/selected project lead are setup exceptions. |
| Money | Task budgets directly consumed Office Budget without an explicit project envelope | Head authorizes named fiscal-year/account/quarter sources. Q1 ₱300,000 + Q2 ₱400,000 derives ₱700,000. Tasks divide the project envelope; subtasks divide task allocations. No second Office Budget reservation. |
| Funding changes | Unclear authority and unused money | Project lead requests additional funding; Head authorizes/rejects. Return unused task funding to project; Head releases unused project funding to Office Budget with an audit reason. Existing spending and obligations stay protected. |
| Balances | Estimates did not explain the financial position | Authorized budget, allocated to tasks, unallocated, cash released, actual spent, returned cash and outstanding advances are separately displayed. |
| Task review | Head was always the task reviewer | Ordinary task-lead submission goes to project lead. Project lead's own task goes to independent Head. Backend rejects self-review and missing eligible reviewer. |
| Subtasks | Separate progress/approval workflow | Subtasks complete directly under task leadership. No new subtask approval queue. Earlier evidence remains readable; old notification links open current work. Retired queue adapters no longer poll or subscribe. |
| Cash | Review conflicted with task leadership/accounting | Project reviewer reviews cash and endorses receipts; conflicted project lead falls back to independent Head. Accounting release, settlement and posting remain distinct permissions. |
| Dates | Parent dates could strand child work | Project bounds constrain tasks; task bounds constrain subtasks. Parent shortening rejects conflicting child dates. Task date controls use project min/max; server rejects bypasses. |
| Dependencies | “Linked” did not explain execution behavior | Displays waiting count/readiness and each prerequisite status. ALL selected prerequisites must be completed and approved before start. Cycles, self-links, duplicates, missing/foreign prerequisites and unsafe reopening are blocked. |
| Closed history | Releasing all funding could make the setup gate hide archived work | Completed/archived work remains readable through the existing read-only permissions, even when the live funding envelope is empty. |
| Editing | Hidden editing and long flat move list | Explicit Edit task and Edit subtask dialogs; centered forms; nested Move to submenu; grouped reorder and separated destructive action. |
| Errors | Failures looked informational | New setup/funding/dependency/edit errors use red text, red-tinted bordered alerts and actionable reasons. Drafts remain. Uncertain funding retries retain the original request and freeze its terms. |

## Financial walkthrough proved against the installed database

1. Create draft; prove adding tasks/sharing/guests/another office is blocked.
2. Save project description, scope, lead and Jan–June dates.
3. Authorize Q1 ₱300,000 + Q2 ₱400,000 from a ₱2,000,000 appropriation: project total ₱700,000; Office source reserved ₱700,000.
4. Repeat the same authorization request: no extra reservation.
5. Allocate ₱200,000 to a task: project unallocated becomes ₱500,000; Office reservation stays ₱700,000.
6. Allocate a ₱50,000 subtask cap: parent available drops within its allocation; Office reservation remains unchanged. Excessive cap is rejected.
7. Return unused task funds and release unused project funds with audit records; no duplicate return on retry.
8. In a current-quarter fixture, request ₱5,000 for supplies, reject, re-request and approve. Approval does not claim a cash release and does not reserve Office Budget twice.
9. Accounting records ₱5,000 release once; recipient acknowledges it.
10. Submit an itemized ₱4,000 receipt and ₱1,000 refund. Project reviewer endorses; separate Accounting officer settles. Returned and outstanding cash totals reconcile.
11. Ordinary task final evidence is approved by project lead. Project lead's own final evidence is approved by Head. Self-approval is rejected.
12. Return ₱16,000 unused from the ₱20,000 task allocation; release ₱96,000 unused from its ₱100,000 project envelope. ₱4,000 actual spending remains protected.
13. Confirm plan reviews, activate, complete and archive while preserving the spending history.

The full hosted probe contains **55 assertions**, including negative permissions and date/dependency cases. All probe records and synthetic storage metadata are rolled back.

## Reset and deployment

- Backed up before reset and deployment. Removed 543 dummy rows across 114 workflow tables and backed up/removed 11 workflow attachments.
- Verified 23 protected account/configuration tables. Kept LEDIPO, accounts, identities, passwords, roles, skills, private personal documents and profile avatar.
- Final read: projects 0, tasks 0, subtasks 0, fiscal budgets 0, cash requests 0, project-funding rows 0; profiles 8, profile avatars 1.
- Applied `20261030074704_project_definition_and_funding_flow.sql` and `20261030083920_complete_project_setup_guards.sql` only. Deployment receipts include hashes, exact migration selection and unchanged public-row fingerprints.
- Security advisor: 5 existing findings before and after; no new findings. Authenticated-only API wrappers, private RLS tables and unauthorized/anonymous denial verified.

## Evidence

- [Hosted verification](HOSTED_VERIFICATION.json)
- [Reset receipt](RESET_RECEIPT.json), [storage reset receipt](STORAGE_RESET_RECEIPT.json)
- [Main deployment](DEPLOYMENT_RECEIPT.json), [setup guards deployment](GUARDS_DEPLOYMENT_RECEIPT.json)
- [Security review](SECURITY_REVIEW.json)
- [Desktop screenshots](GALLERY.html)
- Frontend check/build/regression results are recorded in `VALIDATION.json` when final execution completes.

## Verification limits and retained rules

- Desktop browser tests intercept API responses to check interaction, layout, red errors, routing and request payloads. The 55 hosted SQL assertions separately exercise real installed commands with real role identities inside rollback-only transactions. These are different forms of evidence.
- Receipt/evidence metadata in hosted SQL tests is synthetic; this run does not prove delivery of real email or uploading a physical receipt from a phone. Invitation email delivery/acceptance remains on the user's separate manual checklist.
- Project funding can span fiscal years, with explicit source quarters. A single task allocation uses sources from one fiscal year, matching the existing annual cash/accounting allocation contract. Split multi-year work into separately funded tasks.
- No automatic refund on archive: unused money requires an explicit audited release. Settled spending is retained.
- This delivery changes the web application and hosted backend. It does not generate a new Android APK or test eFlow Live microphone behavior.
