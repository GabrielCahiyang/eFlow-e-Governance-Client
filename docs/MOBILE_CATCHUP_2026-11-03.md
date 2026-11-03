# Mobile catch-up: web changes after the 28 October 2026 native handoff

Prepared 3 November 2026, Asia/Manila. This is a porting handoff, not a claim that these changes have been implemented or verified on mobile.

## Baseline and boundaries

- Mobile baseline: `EflowMobile/docs/PORTING_STATUS.md`, `REMAINING_PARITY_IMPLEMENTATION_2026-10-28.md` and standalone Android build 3. Its generated `WEB_CORE_MANIFEST.json` is dated 27 October UTC / 28 October Philippine time.
- Catch-up window: web changes from 30 October through 3 November. Compare native callers before changing them; this document is a change inventory, not an exhaustive native parity audit.
- Android and iOS remain equal targets. Head, Member and Accounting Staff only; Admin remains web-only. Preserve native branding, motion, reduced-motion support and standalone startup fixes.
- Both clients use the existing hosted target `ixnfphgjyelhckjwjkdv`. Installed backend changes already apply to calls made by mobile. Native screens, service adapters, selectors, routing and caches still need updating. Do not replay web migrations as part of the mobile port.
- Refresh generated headless modules through `scripts/sync-web-core.mjs`, then adapt native consumers. Do not copy HTML/CSS, browser DOM dependencies, Python endpoints or signing secrets into React Native. A sync alone does not establish screen/action parity.

## 1. Project creation and setup

- Creating a project opens setup instead of immediately opening Add people.
- One large, consistently sized setup dialog has five selectable steps: **Details → Scope → Lead & dates → Funding → Review**. Users can jump between steps, go Back/Next and save an incomplete draft. Native presentation should preserve the same flow with a keyboard-safe sheet/screen and persistent footer.
- Required definition: title, description, scope, an eligible project lead, start date, target date and authorized funding, or an explicit **No funding required** declaration. Background/objectives/beneficiaries can be written in the description; they are not separate mandatory fields.
- Complete setup before adding tasks, subtasks, additional people/offices, sharing or guests. Initial owner/lead office and selected project lead are setup exceptions. Activation additionally requires the existing plan reviews and operational readiness checks; finishing setup is not automatic activation.
- The opening step has the animated project-board illustration, live title preview and revised footer. The redundant Implementing office banner was removed.
- Readiness and completion facts update automatically. No routine Refresh checks / Refresh plan reviews action. Keep loaded content during background reads; Retry is for genuine errors. Explicit reviews, activation and completion remain manual.
- Setup & activation is hidden for active projects. Centered dialogs have close controls, internal scrolling and separated action footers.

Sources: `project-flow-redesign-2026-10-30/REPORT.md`, `project-schedule-validation-2026-10-30/AUTOMATIC_READINESS.md`; feature `src/app/features/project-setup/`.

## 2. Project, task and subtask funding

- Office Budget → authorized project funding → task allocations → optional subtask allocations/caps. Reserve Office Budget once at project authorization. Allocating to a task or subtask does not reserve Office Budget again.
- Current project sources use **fiscal year + account + amount**. The project quarter selector was subsequently removed. Preserve historical quarterly metadata; do not restore quarter restrictions from the original 30 October plan. Office fiscal scheduling/calendar is a separate feature.
- Project total is derived from source rows, not independently typed. Display authorized, allocated, unallocated, cash released, actual spent, returned cash and outstanding advances distinctly.
- Task budget supports one or multiple project-funded accounts, including adding another account to an already funded task while preserving previous lines, spending and subtask protection. Show existing budget, amount being added and resulting total.
- Pickers exclude zero-available sources. A selected account cannot be added twice in the same request. Add-row controls stop when no unused sources remain. The server also checks duplicates, concurrent allocation and account-specific balances.
- Errors name the account, entered amount, available balance and excess where applicable. Example: q1test has ₱40,000 available; ₱40,111 is ₱111 too much. Do not replace an actual overbudget error with a generic missing-fields message.
- **Cancel allocation** returns a wholly unused task line; **Return unused funding** returns only its unprotected balance to the project. Reason and confirmation are required. Spent money, live cash obligations and subtask allocations remain protected.
- Project lead requests additional funding; Head authorizes/rejects. Head can explicitly release unused project funding back to Office Budget with audit history. Archiving does not silently release commitments.
- Task-funded cash uses existing task funding. Its form is simplified; remove unrelated extra Office source selectors/add-funding controls. It is distinct from office petty cash.

Sources: `project-funding-annual-2026-10-31/README.md`, `task-budget-controls-2026-10-31/README.md`, `unique-project-funding-2026-10-31/`, `task-multiple-accounts-2026-11-03/README.md`; feature `project-setup/`.

## 3. Office Budget changes

- User-facing **Section → Account** terminology.
- Only the current appointed Head can readjust a locked annual budget, add accounts or change the Q4 target. Accounting and Members cannot readjust it.
- Prominent V1/V2/etc. banner: Head, date, reason, current total and expandable before/after account history. Invalid, unchanged or stale saves do not create a version.
- Prevent reducing an account below protected project commitments, direct-work allocations and spending. Avoid double-counting spending inside an existing commitment. Red errors identify protected projects/tasks and minimum amounts.
- Example: ₱30,000 total with ₱20,000 committed cannot become ₱19,000. Increasing the total to ₱50,000 leaves ₱30,000 available, retaining the ₱20,000 commitment.
- Multiple planned availability-release dates and amounts replace a single undated later-release figure. Calendar shows due and confirmed releases.
- **Accounting confirms availability** on or after the due date with a reference. Reaching a date alone does not free money. Head edits cannot bypass confirmation by deleting/reducing held schedules after lock. Confirmed entries retain officer/time/reference.
- Q4 utilization target is Head-editable, 0–100%, up to two decimals, with reason and audited version. It is separate from retired manually entered task-progress percentages.

Sources: `budget-versions-2026-11-01/README.md`, `budget-release-calendar-2026-11-01/README.md`; feature `budget/`.

## 4. Separate office petty cash

- One continuing shared **₱30,000 starting fund per office**, initialized once automatically on authorized first use. No Accounting opening deposit or opening approval is required. Reading/refreshing/changing projects never adds money again.
- Accessible from Office Budget and task/subtask funding screens, including tasks with no budget. It never deducts from project/task allocations and does not reset with fiscal-year selection or each month.
- **₱5,000 maximum per receipt**, not necessarily per whole advance: multiple valid receipts can support a larger advance within available office cash.
- Pending requests reserve the shared balance; rejection/cancellation releases the reservation. Physical release and settlement remain separate actions. Existing independent Head request/receipt review and Accounting release/settlement checks were retained; automatic initialization did not remove the request lifecycle.
- Only an eligible office Accounting Officer can replenish settled spending. Pending/unsettled advances cannot be replenished as if already spent. No automatic calendar refill.
- Simplified staff summary; Accounting sees replenishment details. Request form can open even at zero balance, but submission cannot exceed availability. Retain drafts while balance refreshes.

Current source: `office-cash-starting-fund-2026-10-31/README.md`. The earlier `office-petty-cash-2026-10-31/README.md` retains superseded opening-deposit notes; do not port those. Features `office-petty-cash/` and `budget/`.

## 5. Reviews, execution permissions and settlement

- A Task Lead submits parent-task final work to the **Project Lead**. If the Project Lead is the task's lead, route to an eligible independent **Head**. No self-review; missing eligible reviewers produce a clear error.
- **Subtasks complete directly** by their current subtask lead or the authorized parent Task Lead. Contributors can record work updates but cannot complete another person's lead responsibility. No separate subtask review queue, progress approval or fabricated approval event.
- Ordered subtasks wait for prior completion; containers wait for descendants. Preserve old evidence/review history without recreating retired approval actions.
- Fixed intermittent completion failures: canonical lead checks, delegated-subtask evidence permission, completion-attempt attachment paths, atomic start-and-submit, preserved retry identity and one completion notification for multiple files.
- Receipt endorsement is not financial settlement. Accounting settlement/posting remains separate, with independent actor requirements.
- Gabriel cannot settle a package where he is requester, recipient or operational lead. The user explicitly retained the requirement for another independent Accounting Officer in conflicted cases; no Head self-settlement exception was added.
- Replace vague Pending department settlement with **Awaiting Accounting settlement**. Show red **Settlement blocked** and missing appointments; distinguish inconsistent ledger/status data from ordinary waiting.
- Existing Gabriel-owned PC-00001 remains open intentionally. The port must not mark it settled locally. For a fresh three-account demo: Cheryl project reviewer, Crisostomo funded-task lead/cash recipient, Gabriel Accounting only.

Sources: `direct-subitems-2026-10-30/REPORT.md`, `work-completion-fix-2026-11-03/README.md`, `settlement-blocker-2026-11-03/REPORT.md`; features `nested-work/`, `subtasks/`, `task-inspector/`, `budget/`.

## 6. Dates and dependency rules

- Project dates contain task dates; task dates contain subtask dates. If project ends 5 November, a task cannot be due 6 November. Parent date reductions identify conflicting child work rather than silently changing it.
- UI date limits and authoritative database validation cover alternative writes and restoration. Use Philippine calendar days for date-only comparisons; exact allowed boundary dates remain valid.
- A task depending on Task 1 and Task 2 waits for **both approved completions** before it starts. Show prerequisite names/statuses and waiting counts instead of merely Linked.
- Block self-dependencies, cycles, duplicates, missing/foreign prerequisites and unsafe reopening of prerequisite work. Respect restricted record visibility.
- Deadline badges: green >3 days; amber 1–3 days or today; red overdue; neutral completed/cancelled/undated. Explicit timed deadlines can be overdue earlier today. Do not fabricate dates for Month 1 planning values.
- Refresh countdowns automatically on timer/focus; retain labels/icons alongside color. Historical activity shows urgency at the event time, not a new current warning for an old change.

Sources: `project-schedule-validation-2026-10-30/REPORT.md`, `deadline-indicators-2026-11-03/README.md`; shared `deadlinePresentation.ts`, UI `DeadlineBadge`.

## 7. Status consistency, Assigned work and notifications

- Synchronize root task status from recorded subtask activity while preserving review-pending and approved final states. Completing all subtasks does not auto-approve the parent task.
- Main table, expanded subtasks, project views, Assigned work, Leading, Subtasks, History and open details must read current authorized state consistently.
- Keep **Awaiting approval** in Leading as read-only; move approved/completed work to History. Do not hide pending review merely because it is no longer actionable.
- Shared change invalidation, coalesced refresh and stale-response protection replace isolated refresh paths. Changes during a pending read schedule another read. Account/project changes cannot receive older responses from another scope.
- Keep loaded rows visible during quiet background refresh. Initial loading uses proper skeleton/brand states; genuine failures show errors and Retry.
- Fix subtask update attachment uploads to the supported progress path. Emit work-update signals only after a confirmed mutation. A successful save followed by a read failure must not be labelled a failed write.
- Notifications and history describe updates, blockers, next steps and completion. Remove legacy generated 0% phrases without deleting user-authored notes or historical records. Link to the exact subtask.
- Do not restore manual task-progress percentages. Analytics can still calculate completion ratios from task counts.

Sources: `subtask-update-fix-2026-10-31/README.md`, `work-completion-fix-2026-11-03/README.md`, `work-status-sync-2026-11-03/README.md`; shared `workChanges.ts`, task caches/work feed and nested-work hooks.

## 8. Invitations and recipient onboarding

- Fixed Offices invitation reads through scoped authorized APIs instead of direct reads of private invitation/guest tables.
- Current sponsoring Head sees **Invite project members / Send invitations**. Other eligible leads see **Request project members / Submit for Head approval**. Dynamic copy follows actual capability.
- Sender supplies recipient email and project access/engagement terms. Recipient supplies name, own password, skills, professional summary and optional private PDS. Existing accounts retain credentials.
- Invited-email login and project-only membership stay distinct from permanent Office roles. Representative/employee is a project participation label, not promotion to permanent Head.
- Preserve request IDs and server receipts on retry; sending/approving/dispatching are not interchangeable. No real mailbox delivery was proved by the UI/SQL fixtures; controlled test-recipient configuration and device links need verification.

Source: `invitation-fix-2026-10-30/REPORT.md`; features `project-invitations/` and recipient onboarding.

## 9. Task screens, activity, dialogs and wording

- Task tabs separate **Work** from **Update work**. Update work contains status/blocker, note, next step, attachments and final submission. Updates remains discussion/history.
- Replace oversized Task team card with compact lead/contributor strip and Manage people. Prominent teal Subtask actions beside the heading.
- Centered add/edit subtask forms, grouped fields, optional people section, styled attachment picker and persistent action footer. Explicit Edit task/Edit subtask and nested Move to menu.
- Rename user-facing items/subitems/subtree commands to **tasks/subtasks**. Keep expanded subtask action buttons in the left column and centered within their cells; do not recreate the broken extra action row or force parent/subtable columns into incompatible widths.
- Activity is a structured visual history with actor, icon, action, time and readable before/after details; automatic updates replace routine Refresh history.
- Task Overview groups Status/Priority/Office and icon facts for deadline, start date, project and optional hours/program. Responsive layout; description separate; no obsolete 0% progress bar.
- Receipt label **Line amount → Actual cost**; database/API field identity is unchanged.
- Inbox decisions use centered Yes/Cancel confirmations: green success/approval, amber rejection/return, red actual failure. Retain reasons, drafts and retry identities; avoid reporting a saved decision as failed because queue refresh failed.
- Shared loaders/startup tagline: **Getting things done**. Removed redundant desktop sidebar Help/Profile controls; retain native access through appropriate existing navigation rather than mechanically deleting the only native entry.
- Preserve reduced motion, theme/dark mode, keyboard accessibility and readable red validation errors in native adaptations.

Sources: `task-work-design-2026-10-30/REPORT.md`, `task-overview-2026-11-03/README.md`, `inbox-decisions-2026-11-01/README.md`; `nested-work/`, `task-inspector/`, shared UI.

## 10. Role landing screens and unified analytics

- Head first sees an Office analytics overview: project delivery, team workload, completion trend and attention records.
- Member first sees My work overview: deadlines, returned work, pending approval and personal actions. Existing work tabs remain.
- Accounting first sees financial queues and cash charts, with existing release/settlement/Office Budget destinations retained.
- Projects have a permanent **Analytics** view in addition to Main table/Board/Gantt/Calendar/existing Dashboard, including route restoration.
- Merge Team Supervision, Team Intelligence and Employee 360 into one cohesive **Analytics** workspace: Overview, Project analytics, Employee analytics, Workload & health, Skills coverage, Monthly contribution and Team access. Preserve old link aliases and permission gates.
- Detailed Projects/People/Tasks tables: filters, current status, authorized/released/spent totals, led vs contributed work, on-time/late first submissions, overdue work, approval waiting, returns and median execution time with sample counts. Chart drilldowns open matching records.
- Completion metrics count parent tasks once; subtasks are separate execution records. Missing timestamps show insufficient data. Reviewer delay does not turn an on-time submission into late delivery.
- Workload & health means work pressure/blockers/overdue/stalled/review waiting, not medical assessment. Count unique affected work rather than adding overlapping flags. Do not invent a productivity score or rank speed without workload/sample context.
- Employee 360/coaching remains Team Intelligence permission-gated. Protect unsaved coaching drafts. Skills coverage does not silently alter skills used by AI assignment.

Source: `analytics-overviews-2026-11-03/README.md`; features `analytics/`, `team-management/`, role overviews and project routing.

## 11. Completion, archiving and blockchain publication

- Store trustworthy completion time. Day 23 sends a reminder; day 30 auto-archives eligible completed projects through existing financial/delivery checks. Reopening resets the clock. Do not guess missing historical completion dates.
- Hosted hourly scheduler handles reminders/archive; no phone timer or background job is required. Archive failures produce attention notices rather than bypassing closeout.
- Archiving never publishes automatically. Current Head manually selects **Seal on blockchain** on an archived project, prepares the full dossier, reviews records/files and explicitly consents.
- Support redacted publication copies while retaining private originals. Changed records/files invalidate unapproved consent. Previously reviewed copies carry forward into linked corrections.
- Durable backend snapshot/outbox persists signed transaction identity before broadcast and reconciles retries. Native app must use the authorized workflow, not sign blockchain transactions locally.
- Confirmed records preserve digest, archive URI, registry, chain, transaction, block, publisher and previous certificate. Immutable versions require linked corrections rather than overwrite.
- Public records are content-addressed hosted files plus an Amoy hash/URI certificate. This is an append-only registry, not NFT artwork and not full project text stored on-chain. Private personnel/PDS/health/credentials are excluded.
- Public viewer works without sign-in/AI host, verifies exact file/manifest hashes and separately checks Amoy proof. Optional IPFS exists but external pinning is not configured/proved. This is a public-record foundation, not a finished public-search website.
- Deployed 3 November: migration 20261103070206; registry `0xFF690376c2CA42ce7D64a83b00Cd60723abf470B`, chain 80002. Worker is enabled. No actual project was published by deployment. Publish only after Head consent; do not use real records as an automatic port test.

Source: `blockchain-project-sealing-2026-11-03/README.md`, `DEPLOYMENT.md`, `VALIDATION.md`; feature `project-publication/`, authenticated gateway and existing private host.

## Implementation order for mobile

1. Refresh/review headless source and native API types; fix direct completion/evidence, review routing, status/feed and notification compatibility first.
2. Port project setup, date/dependency guards and project/task/subtask funding.
3. Port budget readjustment/version history, release calendar, separate petty cash, settlement explanations and confirmation dialogs.
4. Port recipient-owned invitation onboarding and remaining task/activity/loader/deadline presentation.
5. Port role landing screens and unified employee/project analytics, retaining permission gates and draft protection.
6. Port manual archive publication review/status/public links. Keep signing/service keys on the server.
7. Run native checks/regressions and both platform exports; produce a new standalone Android APK. iOS native compilation/signing requires Xcode. Record implementation, Android verification and iOS verification separately.

## Remaining verification and earlier mobile blockers

- New web feature checks do not equal Android/iOS device acceptance. Full repository unit run is not all green; legacy contract/timing failures are recorded in the latest blockchain validation report.
- Real invitation email receipt, intended-device password/login/deep links, native file pickers/uploads, full cash conservation/reject/re-request/release/settlement, offline/retry and real publication/correction need explicit acceptance evidence.
- Original mobile handoff separately lists push backend/EAS/FCM/APNs deployment, remote call STUN/TURN, foreground-only calls, HTTPS app-link association, iOS compilation and a personal-membership eligibility proposal. Their current deployment state must be checked; do not claim this web catch-up deployed or resolved them.
- eFlow Help/Live already existed in the mobile baseline. No new post-baseline voice-model/latency work is claimed here. Existing real microphone/audio acceptance remains separate.
- Historical dummy database resets and sample-project creation were demo operations, not a mobile feature or a reset to repeat.

No mobile code, backend data, credentials or build artifacts were changed while preparing this summary.
