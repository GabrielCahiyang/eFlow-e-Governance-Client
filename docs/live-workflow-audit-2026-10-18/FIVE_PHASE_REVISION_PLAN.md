# eFlow audit revisions — five-phase implementation plan

Date: 18 October 2026; closeout verified 19 October. Status: all five phases implemented and verified for the named acceptance flow, including desktop hosted project completion, archive and read-only reopening with all three accounts. Final checks: 1,983 unit tests and eight Playwright cases passed; TypeScript and production build passed. See the [implementation and verification report](../status-workflow-revisions-2026-10-18/IMPLEMENTATION_REPORT.md) for evidence, coverage limits and the separate notification wording follow-up.

## Agreed direction

Combine the [20 live audit findings](LIVE_WORKFLOW_AUDIT.md) with the user's desktop layout revisions and the approved replacement of manual percentage sliders with status actions. Preserve the earlier project-navigation and onboarding improvements documented in the [workflow implementation report](../project-workflow-gap-implementation-2026-10-18.md), which implements the user's original workflow gap audit.

- Desktop is primary: verify at **1440 × 900** and **1920 × 1080**. The earlier live walkthrough used 568 × 663; it proves the recorded workflow observations, not desktop layout quality.
- Use eFlow's existing colors and Monday Vibe controls, with consistent spacing, readable typography and restrained icons.
- Task, subtask and review work belongs in full pages. Keep headers compact; present people as avatars, states as badges and evidence as file cards/previews. Expand supporting details and history on demand.
- Preserve role visibility, project access, Office authority, sequential dependencies, independent review, evidence history and financial clearance.

## Phase 1 — replace sliders with a shared status workflow

**Result:** people report what is happening and submit finished work without choosing a percentage.

| Control | Behavior |
|---|---|
| Not started | Existing work has not begun. Unassigned work retains its separate assignment prerequisite. |
| In progress | Start or resume permitted work; retain the current page. |
| Stuck | Require a short reason; show the blocker to the lead. Resume returns to In progress. This is an optional branch, not a mandatory step. |
| Submit finished work | Require evidence and a completion note. Validate permissions, prerequisite approvals and current workflow state before submitting. |
| Awaiting approval | Show the assigned reviewer's name and the submitted evidence; preserve submission locking. |
| Changes requested | Show reviewer feedback and a direct resubmit action after corrections. |
| Completed | Set by successful authorized approval, not by the worker selecting a label. |

Implementation requirements:

- Clicking a status opens a short menu of permitted choices; repeated clicks must not blindly cycle through states.
- Apply the same behavior to tasks and nested subtasks across My Work, project tables, boards and work-detail pages.
- Remove manual percentage sliders and percentage-entry requirements from active execution/update forms. Notes, blockers, attachments and history remain available.
- Preserve existing assigned-reviewer routing for subtasks, including escalation when the submitter would otherwise review their own work. Final task review stays with the authorized Head.
- A parent with subtasks remains gated until its required subtasks are approved. Subtasks remain optional under the current creation contract; this plan does not add a requirement that every task must contain one.
- Use one shared calculation for any necessary automatic progress display. Count approved required leaf steps once; avoid counting a parent and its descendants as separate completed steps. Display **2 of 3 steps approved** rather than guessed execution percentages. All steps approved means **Ready for final review**; the parent task is Completed only after final approval. Project completion metrics continue to reflect approved tasks.
- Preserve historical manual updates and compatibility fields. Inspect current services and deployed functions before changing how their numeric fields are populated; do not rewrite historical percentages or assign arbitrary percentages to In progress/Stuck.
- Prefer the existing blocker representation for Stuck where compatible. Any necessary backend change must be a deliberate workflow change, with regression coverage, rather than a schema change disguised as a visual refactor.

Audit coverage: **8, 10, 13, 14, 16**. Verify missing evidence/note, changes/resubmission, blocked sequences, duplicate submits and authorization failures.

## Phase 2 — rebuild desktop task and subtask work pages

**Result:** the user can see the work and its next action without scrolling through metadata.

- Give tasks and subtasks a consistent full-page layout and reliable Back navigation.
- Use a short breadcrumb, title, status, due date and compact people summary. Remove duplicated titles, repeated parent paths and empty metadata from the main working area.
- Put the status action, concise update form, evidence and child-work list in the main content. Keep secondary history and metadata expandable.
- Show clear dependency messages such as **Waiting for Draft agenda approval** with a permitted link to that work.
- Show funding information when it affects the user's action; keep detailed financial records accessible in their appropriate view.
- Correct lead/contributor summaries; retain contributor and reviewer distinctions.

Audit coverage: **4, 20**. Recheck screenshots **21–28** at desktop sizes; mobile becomes secondary acceptance. Avoid tall fixed headers, narrow drawers, nested scroll traps and stretched forms.

## Phase 3 — rebuild review and correction pages

**Result:** reviewers see the result and evidence first, with clear decisions and no stacked dialogs.

- Open one full review page from notifications or the review queue, with one return action.
- Present the current submission, useful acceptance checks and evidence previews/file cards. Show the author and submission time once.
- Keep **Request changes** and **Approve** clearly accessible. Require feedback for requested changes and preserve existing approval/clearance checks.
- Show older attempts and detailed event history in expandable sections. Keep decision attribution and the evidence for each attempt.
- Refresh the submission, task/subtask state, queue and history together after a decision. Replace a processed item with a success state, next eligible submission or normal empty queue.
- Use the actual reviewer name or **assigned reviewer** instead of a hardcoded role label. Provide direct correction and resubmission controls for the worker.

Audit coverage: **5, 6, 7, 12**. Verify review routing and denied self-review; preserve existing escalation behavior.

## Phase 4 — correct shared UI states, dashboard, dates and project setup

**Result:** the rest of the flow agrees with the new work/review pages and exposes prerequisites early.

- Correct Head task/subtask review counts and their links; use the same eligibility rules as the actual review queues.
- Separate loading, saving, unavailable and denied states. Remove false access/authority warnings during normal pending requests.
- Make membership confirmations describe actual additions/removals; show removal impact only when relevant. Update development-account names and capability labels.
- Centralize local date/time formatting and relative-day labels. Preserve today's availability, deadline validation and the optional time default of 11:59 PM. Remove raw timestamps from index, Board and Timeline labels.
- Give completed/archived projects appropriate lifecycle and schedule labels.
- Show a compact setup checklist after creation and in the project header. Provide direct actions for project dates, team and required plan reviews, with clear completion/activation requirements.
- Review the observed ability to execute work while a project remains Planning against the intended lifecycle; document the chosen rule before altering authorization or governance.
- Fix duplicate checklist keys and verify stable blocker rows during refresh. The console warning is evidence to investigate, not a proven explanation for every checklist problem.
- Keep existing + New, All projects, direct Add people, canonical task identities and view/navigation behavior working.

Audit coverage: **1, 2, 3, 9, 11, 15, 17, 18, 19**, plus the recorded completion-check console warning.

## Phase 5 — desktop acceptance and three-account live walkthrough

**Result:** a verified revision with before/after screenshots and an updated issue register.

- Run `npm run check`, `npm test` and `npm run build`; run affected Playwright smoke tests when configured. Report any remaining failures accurately.
- Test desktop at 1440 × 900 and 1920 × 1080 first, then secondary responsive and dark-mode checks. Capture key forms, menus, page layouts and decision states.
- Through the actual UI, create a clearly labeled audit project with at least one task and two sequential subtasks. Exercise Cheryl, Gabriel and Crisostomo in their current authorized roles.
- Cover Not started → In progress; Stuck with a reason → resume; evidence and note validation; submission; request changes; corrected resubmission; independent approvals; parent review gating; final task approval; project setup/activation/completion; archive and retained history.
- Verify state synchronization, notification targets, Back navigation, input retention, read-only archived work, correct counts/dates and absence of active manual sliders.
- Use permitted synthetic evidence and preserve audit history. Keep destructive cleanup and real financial transactions outside this acceptance run.
- Update every audit finding with fixed/still open/not reproduced, evidence and any remaining limitation. Keep mocked smoke coverage separate from real hosted acceptance.

## Delivery rules

Implement in these five phases, each as focused, independently verifiable slices. Add source/regression tests appropriate to the interaction; follow the feature boundaries and Graphify rules in AGENTS.md. Each phase report should show the behavior changed, verification results and remaining work.

Hosted implementation and acceptance target remains **ixnfphgjyelhckjwjkdv**. Preserve migration history and use an isolated workspace populated from live history for any necessary reviewed migration. Keep backend/API compatibility unless this explicitly requested workflow change requires a documented adjustment.

This plan records the requested revisions; creating it does not mark any phase implemented.
