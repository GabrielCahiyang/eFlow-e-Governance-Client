# Status workflow revisions — implementation and verification

Started: 18 October 2026; live closeout verified 19 October 2026 (Asia/Manila). Hosted target: `ixnfphgjyelhckjwjkdv`.

All five revision phases have implementation and acceptance evidence. Browser access was restored on 19 October and the real three-account desktop walkthrough now includes **project completion, archive and read-only reopening**. Evidence, correction attempts and independent approvals remain available. The final complete unit suite passed **1,983 tests across 327 files, with zero failures or skipped tests**. Coverage limits and one additional notification wording observation are recorded below; this is not a claim that every system path has been audited.

## What changed

1. **Status actions replace execution percentages.** Tasks and subtasks use In progress, Stuck with a reason, and Submit finished work with a completion note and evidence. Approval remains the only route to Completed. Existing percentages and evidence history are preserved; new updates do not invent percentages. Approved leaf counts explain the parent submission gate.
2. **Desktop work pages.** Task and subtask detail stay in the app's main content area. Compact context headers, an uncluttered work form, file cards and collapsible schedule/funding/history replace the narrow drawer. Child work opens its own page and Back returns to the source.
3. **Review pages.** Subtask review uses one page with submitted evidence, feedback and clear decisions. Processed attempts leave the queue cleanly. Dirty drafts, actor isolation, revoked authority and evidence access checks remain enforced.
4. **Audit corrections.** Add-only team confirmations no longer imply removals. Loading/saving no longer presents the known false authority errors. Lead/contributor summaries agree. Head review counts include assigned subtask reviews. Today uses calendar-day arithmetic. Dates are formatted, completed/archived schedule labels preserve completion, and Setup & activation is accessible directly from the project header.

The shared controls live in `src/app/features/work-state/`. Review presentation owns its CSS so its styles are loaded when Inbox is opened directly, including theme colors. Existing backend authorization and lifecycle checks remain in control.

## Database deployment

Two reviewed migrations were applied to the current hosted target using an isolated workspace populated from live migration history. Local filenames preserve the deployed timestamps:

- `20261018145003_status_based_subtask_updates.sql`: checked status-update RPC; requires current authenticated work eligibility, validates blockers/text and preserves historical percentage values. PUBLIC/anonymous execute is revoked.
- `20261018150908_work_status_snapshot.sql`: the existing authorized work snapshot includes display-only current blocker fields. Existing personal snapshots and access/capability checks remain intact.

No schema, RLS, role, project-membership or approval bypass was introduced. The SQL verification script passed 14 assertions in disposable PGlite. Separate rollback-only hosted checks exercised start/blocker/resume and rejected direct completion without retaining those temporary changes.

## Real hosted desktop walkthrough

Project: **Status Workflow Acceptance — 18 Oct 2026**, `0b38cbb7-85e4-499e-a927-3dcb5322d8dc`.

Task: **Acceptance — Prepare meeting pack**, lead Crisostomo Ibarra, contributor Gabriel Cahiyang. Two sequential steps: **Acceptance — Draft agenda** (Gabriel) and **Acceptance — Check meeting pack** (Crisostomo).

| Actual UI action | Result |
|---|---|
| Head creates project, selects people and appoints the task/step leads | Saved; add-only confirmation describes additions without a false destructive warning. |
| Gabriel starts, reports a blocker, resumes and submits agenda evidence | Saved without a slider; evidence and note required. |
| Crisostomo requests changes | Feedback recorded; processed review clears without the former withdrawal warning. |
| Gabriel submits the corrected agenda; Crisostomo approves | Second attempt preserved; first sequential step completed. |
| Parent opened with only one approved step | Final submission remains gated; Start keeps the page open. |
| Crisostomo completes and submits the second step | Routes to Cheryl instead of self-review. |
| Head dashboard and second-step review | Awaiting review shows 1; evidence opens in one page, without stacked dialogs. |
| Cheryl approves second step | Review queue clears; parent shows 2 of 2 steps approved. |
| Crisostomo submits final pack | Note/PDF saved; page changes to Review without an unsaved-progress discard prompt. |
| Cheryl approves final task | Queue becomes 0; project shows 1 of 1 tasks completed, 100%. |
| Head saves project dates through calendar and confirms three plan reviews | Nine checks confirmed; activation succeeds. |
| Live completion/archive | Head confirmed all nine completion checks, completed the project and archived it. Reopening shows Archived, Completed schedule and 1 of 1 tasks completed. |
| Retained records under three accounts | Cheryl, Crisostomo and Gabriel reopened the archived project. Work stayed read-only; agenda correction attempts, evidence and independent decisions remained available. |
| Approved task/history revisit | Fixed a stale ready-for-review label, an obsolete self-review warning and a single-attempt history panel that expanded empty. The actual final attempt now displays Approved and Decision by Cheryl Gallo. |
| Old task-review notification after approval | Opened the correct Project Tasks review destination, showing 0 awaiting review and no decision controls. |

Desktop evidence uses 1440 × 900 and 1920 × 1080, not the previous narrow audit viewport. The acceptance records and synthetic PDF evidence remain available for inspection. The earlier archived audit project was left intact.

Date-entry note: initial automation attempts to fill native date controls left them blank. Calendar selection successfully persisted project dates (18–25 October). The empty initial subtask dates are not sufficient evidence of an application defect.

## Original finding register

“Implemented” describes the source correction. “Live” describes the exercised hosted path, not blanket acceptance of every account, notification or failure variant.

| Audit IDs | Correction and verification |
|---|---|
| 1 | Add/remove-specific team confirmation; live add-only path verified. |
| 2–3 | Suppress authority errors while saving/loading; loading and authority regression tests pass. |
| 4 | Exclude lead from contributor-only summaries; live hierarchy/detail checked. |
| 5–7 | One review page, processed-attempt tracking and refreshed history; live request-changes/approvals and focused queue/privacy tests pass. Notification variants still require a complete post-change hosted sweep. |
| 8, 13 | Active execution percentage entry removed; status form and SQL preservation assertions pass. |
| 9 | Local calendar-day comparison implemented. Explicit tests cover end-of-today, tomorrow and yesterday; a complete hosted date-entry sweep is outside this closeout. |
| 10 | Start retains task context; live parent Start and lifecycle regression tests pass. |
| 11 | Head review count includes eligible assigned subtask reviews and final tasks; both live pending states showed 1. |
| 12 | Neutral assigned-reviewer language and actual reviewer directory replace the hardcoded Team Leader claim. Self-review escalation worked live. |
| 14 | Shared evidence format/size validation and visible format help; supported PDF submission exercised on both levels. |
| 15 | Development account picker uses current names and Gabriel's Financial Officer role label. |
| 16 | Shared submission/update draft owner marks committed work clean; live final submission had no discard prompt, and draft retention tests pass. |
| 17 | Project, board and timeline display format dates instead of raw timestamps. Full hosted date/time display sweep remains outstanding. |
| 18 | Direct project settings and Setup & activation; live dates, all nine checks and activation verified. Work while Planning remains existing behavior. |
| 19 | Completed/archived schedule calculation preserves Completed; hosted archive revisits passed with all three accounts. |
| 20 | Compact full pages and expandable supporting details; live desktop screenshots include light/dark at 1920 and dark at 1440. Secondary 390-pixel archive checks use synthetic fixtures. |

## Test receipts and limits

- `npm run check`: passed on the final application source.
- `npm run build`: passed on the final application source, with existing large-chunk and mixed import warnings.
- Eight affected unit files: **66 passed** (status form, inspector, review detail, separate execute/submit/review/funding permissions, draft retention, lifecycle retention and approved-task metrics).
- Additional submission-draft and completion-parity files: **5 passed**.
- Head dashboard tests: **6 passed** in the earlier focused run.
- Final review-detail rerun after removing the duplicate parent label and extracting theme-aware CSS: **16 passed**. Its account-isolation assertion checks the current authorized breadcrumb instead of the removed duplicate label.
- `node scripts/verify-status-workflow-sql.mjs`: **14 passed**. Disposable database test, distinct from hosted browser evidence.
- Final combined Playwright run: **8 passed**, including index/reload/history, board creation, canonical people editing, Member/Financial Officer/Admin visibility and light/dark completion/archive. Command: `npm run test:e2e -- tests/e2e/project-workflow-gaps.spec.ts tests/e2e/status-workflow-closeout.spec.ts --project=chromium --workers=1`, with `EFLOW_E2E=1` and an isolated managed development server. These are synthetic responses, distinct from the live account walkthrough.
- Synthetic light-mode closeout: complete → archive → return to index → reopen archived project, no arbitrary execution controls, Completed schedule, and no document overflow at 1920, 1440 and 390 pixels: **passed**.
- Synthetic dark-mode closeout: **passed** on a clean isolated development server, including 1920, 1440 and 390-pixel archive screenshots and no page exceptions. Earlier reused-server attempts failed during development module refresh with `useChatDrawer must be used inside ChatDrawerProvider`; that was not reproduced on the clean server. No authorization workaround was introduced.
- **Final complete unit suite: 1,983 passed / 0 failed / 0 skipped, across 327 files.** Command: `npm test -- --maxWorkers=4 --reporter=json --outputFile=.codex-tmp/five-phase-final-suite-verified.json`. Finished 19 October at 00:27:40 Asia/Manila. The [compact final receipt](FINAL_TEST_RECEIPT.json) records the result; the complete local JSON remains in `.codex-tmp`.
- Historical full-suite snapshot: **1,898 passed / 68 failed / 1,966 total** before test migrations. The affected-file rerun narrowed this to 26 obsolete drawer/slider/label assertions; their follow-up run passed **156 tests**. Authority, draft isolation and read-only assertions were retained. The [failure register](FULL_SUITE_FAILURE_SNAPSHOT.md) preserves the historical results, superseded by the final complete green run above.
- New terminal-review and approval-summary regressions: **7 passed**. Single-attempt submission history: **3 passed**. Review/work navigation and focus return: **27 passed**. Calendar-day boundary cases: **2 passed**.
- The first complete reconciliation run reached **1,970 passed / 4 failed / 1,974 total**. One routine-progress test still expected the removed numeric input; two history tests exposed that blocked historical updates concealed their recorded percentage. The input test now exercises a note without an impact prompt, and recorded values remain accessible under a collapsed disclosure while the main badge says Stuck/In progress. Those three files passed **31 tests**. The fourth failure was the first Vibe mount exceeding a one-second assertion deadline; its complete file passed **12 tests** unchanged in isolation. Its first-render wait is now bounded at five seconds, with all identity/authorization assertions unchanged. A final complete run includes these corrections and the subsequently added history/date tests.
- The historical nested-work SQL verifier still encounters its pre-existing baseline-helper hash mismatch. Historical migration/hash receipts were not rewritten.
- Final Graphify refresh passed: 10,175 nodes. Four known parser warnings remain (`guided-tours`, `productivity`, `ProjectTaskRow` and `work-templates`); the final TypeScript application check passes. No incomplete graph was forced over a larger extraction.

## Coverage limits

This closeout verifies the named project lifecycle and three-account review flow. It does not claim exhaustive hosted coverage of every notification variant or date/time input. Secondary responsive evidence uses explicitly labeled synthetic records. The historical nested-work SQL verifier's baseline-helper hash mismatch remains separate from the passing unit suite and current status-workflow SQL checks.

### Additional observation outside the closeout corrections

The existing database notification trigger still formats subtask-update notifications as a percentage (including a retained 0% for the new status-only update). It does not change work progress or approval, and the notification target remains available, but the wording should follow the status workflow in a subsequent database notification revision. Stored notifications and deployed historical migrations were not rewritten during this acceptance pass.

See [the screenshot walkthrough](SCREENSHOT_WALKTHROUGH.md) for the visible hosted evidence and separately labeled automated closeout screenshots.
