# eFlow live workflow audit — 18 October 2026

Status: completed. The audit project is archived; its completed task, two approved subtasks, evidence attempts and decision history remain readable. Findings below are observed through the actual localhost UI against hosted target ixnfphgjyelhckjwjkdv. No application code or database schema was changed for this audit. Test records and synthetic evidence were created through normal UI.

Project: Workflow Audit 2026-10-18 — Browser QA (6388d5b9-5402-43aa-90de-8f3c2ce9efb7).
Task: Audit — Prepare meeting pack. Lead Crisostomo Ibarra; contributor Gabriel Cahiyang.
Subtasks in sequence: Audit — Draft agenda (Gabriel); Audit — Check meeting pack (Crisostomo).
Accounts used: Cheryl Gallo (Head), Gabriel Cahiyang (lands in Accounting), Crisostomo Ibarra (Member). Default browser viewport approximately 568 x 663; findings are scoped to this viewport unless stated otherwise.

## Observed UI/UX findings (20)

1. **P2 — Add-only membership confirmation warns about removing access.** Create project; select three people; Save project team. Confirmation says it unassigns current tasks/descendants, clears Leads and ends access even though Removed: None. Expected: summarize additions only; show destructive warning only for actual removals. Evidence: 05-add-only-team-warning.jpg.
2. **P2 — Normal subtask saves briefly claim authority changed.** Head adds either subtask with lead selected. During Saving the editor says “Your current branch authority changed. Reload the tree before saving.” Then save succeeds without reload. Expected: saving state without false authorization error. Reproduced twice. Evidence: AX observations; 08-subtask-save-authority-message.jpg captures resulting transition and may already show success.
3. **P2 — Loading subtask details displays an access error before loading succeeds.** Open a subtask from My Work or notification. Initially “Subtask unavailable. Verify current work access.” and Retry while title says Loading subitem; next observation succeeds. Expected: loading skeleton; error only after a failed load. Reproduced across both member accounts.
4. **P2 — Contributor summary includes the lead when there are zero contributors.** Subtask hierarchy/review says Contributors (0): No contributors; detail definition lists Gabriel or Crisostomo under both Lead and Contributors. Expected: consistent contributor-only list. Evidence: 11-gabriel-subtask-before.jpg; 17-sequential-subtask-locked.jpg.
5. **P2 — Successful review decision leaves a stale access/withdrawal warning.** Open review from notification; request changes or approve. Success toast appears; dialog and underlying review page then say submission withdrawn/outside access/ambiguous label. Expected: decision confirmation and next queue item or normal empty state. Reproduced for member and Head approvals. Evidence: 16-stale-submission-after-decision.jpg.
6. **P2 — Review navigation stacks two detail dialogs.** Notification Open subtask review opens a review dialog over a subtask detail dialog; Close exposes the second dialog requiring another Close to return to queue. Expected: one coherent review surface and one return action.
7. **P2 — Post-decision history remains stale in underlying detail.** After approval, subtask header says completed but Attempt 2 still Pending and current reviewer unavailable until reopen. Changes-requested decision similarly left attempt Pending initially. Expected: update decision/history together. Evidence: 20-agenda-approved-stale-history.jpg.
8. **P2 — 99% correction progress disagrees with slider.** After changes requested the text says99%, native slider value100 with step5; End alone makes no change. Moving left then End updates form to100 and activates evidence submission. Expected: slider and stored/displayed percentage agree; clear resubmit action. Evidence: 18-gabriel-corrections.jpg and DOM value inspection.
9. **P2 — Due today is labeled tomorrow in task Overview.** Task due18Oct2026,23:59 (blank time default verified); on18Oct local dashboard/date and subtask detail show today, parent Overview says Due tomorrow. Expected: same local calendar-day calculation. Evidence: 24-task-deadline-due-tomorrow.jpg.
10. **P2 — Start work unexpectedly closes full task page.** From My Work open task, Updates, Start work. Task becomes In progress, but UI returns to list and requires reopen. Expected: keep task open in context. Evidence: 25-start-work-closed-task.jpg.
11. **P2 — Head dashboard Awaiting review count is wrong for both subtask and final task submissions.** First Crisostomo's second subtask awaited Cheryl while dashboard showed0. Later the parent task was For Review; the same dashboard showed0 in the summary/filter while its project card said1 awaiting review and the review queue contained1. Expected: a single consistent count scoped to the current Head, with clear task/subtask coverage. Evidence:27-head-zero-review-with-pending.jpg;34-head-review-count-contradiction.jpg plus live AX state (the lower project card is outside the captured viewport).
12. **P3 — Review gate identifies wrong reviewer role.** Parent Updates says1 awaiting Team Leader review while second subtask explicitly routed to Cheryl, Head. Expected: actual reviewer/name or neutral assigned-reviewer wording. Evidence: 26-parent-review-gate.jpg.
13. **P2 — Parent progress form offers100 but rejects it.** Updates instructions say At100 submit below; slider accepts100, Save update returns “Progress must be a whole number from0to99. Completion requires approval.” Expected: max99 with explicit final-submit instruction, or consistent100 handling. Evidence: 29-parent-100-rejected.jpg.
14. **P3 — Evidence format rules are inconsistent and undisclosed before selection.** Subtask successfully accepts.txt evidence; parent rejects same format and requests image/PDF/Word/Excel only. Expected: consistent documented supported types beside both upload controls. No security conclusion drawn from this UI observation.
15. **P3 — Development account picker labels are stale.** BPLO Head signs in as LEDIPO Cheryl; TDFRO Member signs in as LEDIPO Crisostomo; Gabriel labeled MEMBER but lands in Accounting and has Accounting navigation. Expected: current display names and actual roles/capabilities. Do not infer authorization vulnerability from visible navigation alone.

16. **P2 — Successful final submission triggers an unsaved-progress discard prompt.** After Save update rejected100%, complete the separate final submission. It succeeds, then automatic navigation asks whether to discard Task progress update. Keep editing returns to For Review. Expected: clear or reconcile drafts and keep confirmation in context. Evidence:32-submit-triggers-discard-dialog.jpg;33-parent-for-review.jpg.

17. **P2 — Timestamp values leak into project and board labels.** After a task receives a due time, open All projects before explicit project target-date setup: Target date is2026-10-18T23:59:00+08:00. Board card shows the same raw value; Timeline shows10-18T23:59:00+08:00. Expected: consistent localized date/time. Evidence:38-project-raw-target-date.jpg and live DOM observations of Board/Timeline. The All projects target became a clean date after explicit project dates were saved.
18. **P2 UX gap — Activation and closeout requirements are discovered late.** Create the title-only project, add team/work and complete both subtasks and final task. Project remains Planning; only Completion requirements exposes missing structure/schedule/budget reviews and both project dates. Its schedule link goes to Gantt; Manage plan opens Timeline; a second Manage plan opens a right inspector; Project Settings finally exposes dates. Expected: persistent visible setup/checklist and a direct project-dates action; clarify whether executing all work while Planning is intended. This is an observed discoverability gap, not a claim that activation must be a security gate. Evidence:39-project-completion-blockers.jpg;40-project-date-setup.jpg;42-all-completion-checks-pass.jpg.
19. **P2 — Archived completed project is labeled Due soon / At risk.** Complete and archive all work. Archived index initially shows Due soon; after project data resolves, header shows At risk while1/1 tasks and100% are completed. Completed lifecycle had correctly shown Completed schedule before archive. Expected: archived completion-neutral schedule or preserved completion outcome. Evidence:46-archived-project-index.jpg;52-archived-final-state.jpg.
20. **P2 responsive UX — Subtask fixed header consumes most of a short viewport.** Open a subtask at the browser's568x663 viewport. Title/status/path plus Lead, Contributors, Parent, Children, Due and Mode consume about420px; the work form scrolls in the remaining space. Review-from-notification stacks an additional dialog over it. Expected: compact summary, expandable metadata and a wider in-page execution layout with useful working space. Evidence:11-gabriel-subtask-before.jpg;22-crisostomo-submit-not-advancing.jpg;16-stale-submission-after-decision.jpg. This finding is specific to the tested viewport, not a desktop-wide claim.

## Successful checks

Project creation, default group and optional people step worked; team and task assignment persisted; today's due date saved and blank time became11:59PM. Gabriel submitted required note/evidence, Crisostomo requested changes, Gabriel saw feedback and submitted attempt2, Crisostomo approved. Second sequential subtask was correctly locked before first approval and unlocked after it. Crisostomo saved50% progress then submitted evidence; reviewer correctly escalated to Cheryl instead of self-review. Parent submission gate correctly prevented final review until all subtasks approved. Cheryl approved final subtask. Parent empty submission was rejected for missing completion note.

## Completed walkthrough and evidence map

| Stage | Actor and verified result | Screenshots |
|---|---|---|
| Create project | Cheryl created named audit project and default To do group |03|
| Add team | Cheryl added herself, Crisostomo and Gabriel |04–05|
| Assign task | Crisostomo lead, Gabriel contributor; saved successfully |06|
| Set deadline | Today accepted; blank time saved11:59PM |07|
| Build subtasks | Gabriel agenda, then Crisostomo pack check; In sequence |08–09|
| Member execution | Gabriel completed agenda, note and evidence required |10–13|
| Request changes | Crisostomo received notification and sent required feedback |14–16|
| Sequence validation | Crisostomo's second step stayed locked before first approval |17|
| Revision | Gabriel received feedback and submitted attempt2 |18–19|
| First approval | Crisostomo approved revised agenda; second step unlocked |20|
| Progress and final evidence | Crisostomo saved50%, then submitted second subtask |21–23|
| Parent progress | Crisostomo started parent and saved50%; final submission blocked until subtasks approved |24–26|
| Independent review | Cheryl received and approved Crisostomo's subtask instead of self-review |27–28|
| Final task submission | Crisostomo supplied completion note and supported JPG evidence; task became For Review |29–33|
| Final task approval | Cheryl inspected full evidence/attempt history; confirmed approval; task Completed |34–37|
| Closeout setup | Project dates saved; unfunded budget inspected; three Head reviews confirmed |38–42|
| Lifecycle | Project activated, then completed through checks |43–44|
| Archive | Archive reason saved; project removed from Current projects and found under Archived |45–46|
| Retained views/history | Board, Calendar, Dashboard and archived task review/activity readable; task/date edits disabled |47–52|

Screenshot filenames are chronological labels; some screenshots capture the transition after a transient warning has cleared. For these issues the report explicitly relies on the live AX/DOM observations. Full-page capture does not expand independently scrolling application panels; several screenshots show the relevant visible portion rather than every nested panel at once.

## Additional technical warning

Opening/refeshing project completion checks produced repeated React duplicate-key warnings for governance-6388d5b9-5402-43aa-90de-8f3c2ce9efb7. The checklist's detailed blocker rows also disappeared on some refreshes while the blocker count remained. This is correlated evidence, not a proven root-cause diagnosis. Save source review for implementation. See console-errors.json. No other console errors were seen during the earlier assignment checks.

## Recommended order for follow-up

The user's subsequent revisions are consolidated in the [five-phase revision plan](FIVE_PHASE_REVISION_PLAN.md). The original observations above remain historical evidence.

1. Replace manual task/subtask percentage sliders with status actions, evidence submission and the existing authorized approval flow.
2. Rebuild desktop task and subtask work pages with compact headers and fewer repeated labels.
3. Rebuild review/correction pages and synchronize decision, queue and history updates.
4. Correct shared states, dashboard counts, dates, lifecycle labels and project setup discoverability.
5. Verify at desktop sizes first, repeat the real three-account workflow through archiving and publish before/after evidence.

The status action opens permitted choices: Not started, In progress, Stuck (reason required), and Submit finished work (evidence and note required). Submission becomes Awaiting approval; authorized review produces Completed or Changes requested. Stuck is optional. No worker-facing manual percentage sliders remain under the proposed revision. These changes are planned, not implemented in this audit.

## Scope and practical limits

This is one real LEDIPO office-project lifecycle with three existing accounts. Gabriel executed a subtask and handled its correction loop; Crisostomo executed the parent task and second subtask, and reviewed Gabriel; Cheryl created/closed the project and reviewed Crisostomo. It does not claim each account executed every possible role or action.

The browser's default568x663 viewport was retained. A wide-desktop and dark-mode visual pass remains separate. No mocked API responses, direct SQL changes, RLS changes or permission bypasses were used. No application code was edited and no build/unit checks were needed for this read/write UI audit. Normal UI actions created the archived test project, memberships, notifications, progress updates, synthetic evidence and review records. No real financial transactions or emails were sent by the agent.

Not covered: Admin-only setup, password recovery/activation, external Office invitations, proposal governance variants, financial release/settlement transactions, recurring work, deep nested sub-subtasks, group/task deletion, project restore, race/concurrency and multiple browser sizes. These are additional coverage areas, not asserted bugs. Native calendar/locator automation glitches were not counted as product defects; successful date entry used the actual input's keyboard segments.

Keep the archived audit project and evidence for reproductions. No fixes were applied during this audit.


