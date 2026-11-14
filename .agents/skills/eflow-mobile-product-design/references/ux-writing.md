# eFlow Mobile UX writing and content design

## Source provenance and limits

User-supplied inspiration: monday.com Vibe **UX Writing Handbook**, `https://vibe.monday.com/?path=/docs/foundations-ux-writing-handbook--docs`.

At skill-authoring time the exact Storybook document did not load through the available browsing source. **Do not represent the rules below as quotations or verified extracts from that handbook.** They are original eFlow content guidelines built around common, independently documented UX-writing practices and the actual eFlow workflow. If future authorized work can open the official source, compare/adjust deliberately and note the version. Vibe patterns should inform clarity, not cause visual brand copying.

Related accessible references:
- `https://www.mass.gov/info-details/user-experience-ux-microcopy` — plain-language interface microcopy, useful labels, actionable instructions.
- `https://www.ucl.ac.uk/brand-and-experience/experience/content/interface-content` — concise, consistent interface content.
- `https://vibe.monday.com/` — original Vibe design system, if accessible.

## eFlow content principles

**Voice:** professional, calm, plainspoken, respectful, precise. Government-auditable actions require exceptionally accurate language; don't cover uncertain outcomes with reassurance. Avoid excited marketing copy, unnecessary exclamation marks, bureaucratic passive voice, internal RPC names, and developer-only jargon.

**Term system:**

| Concept | Always use in UI | Avoid as a user-facing substitute |
| --- | --- | --- |
| Nested work unit | **Subtask** | Subitem, node, leaf, NW7 |
| Work owner | **Task Lead** or **Subtask Lead** | Owner when responsibility is unclear |
| Additional worker | **Contributor** | Executor, selected person, assignee where ambiguous |
| Submitted-but-unapproved work | **Awaiting review** / **Awaiting lead approval** | Complete, Approved, Updated project |
| Finalized work | **Completed** | Done if backend still pending |
| Reviewer work area | **Reviews** | Assigned decisions in Inbox |
| Finance status | **Requested**, **Released**, **Settled**, etc. | Money spent when only requested/released |
| Unavailable data | **—** with accessible explanation | ₱0.00 or 100% unless known |

Preserve canonical backend status names in code; this table governs **presentation strings** only. Historical activity should preserve original quoted content even if a surrounding label changes from Subitem to Subtask.

**Sentence case:** `Add subtask`, `Actual expense`, `Mark as complete`. Use title case for proper names and acronyms, not every word. Buttons normally have no final punctuation; descriptive error sentences do.

**Write the outcome, not the mechanism:** `Request changes`, not `Execute rejection RPC`; `Check current decision`, not `Retry commit`; `Show older updates`, not `Load pagination cursor`.

**High-stakes outcomes:** always distinguish intention, pending, confirmed, failed, stale and uncertain. `Mark as complete` may be the short button label, but immediately explain if it triggers a review; do not show a success toast until authoritative completion is observed.

## Component copy contracts

### Headings and navigation

- Prefer one clear screen title: `Projects`, `My Work`, `Reviews`, `Notifications`, `Activity`, `Accounting`.
- Breadcrumbs supply context: `Citizen Services / Counter inspection / Verify documents`; don't repeat `Subtask details / Subtask information / Details`.
- A title and status already explain type; avoid redundant metadata labels like `This is a subtask`.
- More entries name exact jobs; `Reviews` is preferable to `Assigned decisions` for concise navigation.

### Primary and secondary actions

| Context | Primary action | Secondary action / note |
| --- | --- | --- |
| Create nested work | `Create subtask` | `Cancel` |
| Start work | `Start work` | `View activity` where helpful |
| Resume work | `Resume work` | `View activity` |
| Update lead-owned work | `Save work update` | `Cancel` |
| Intended finish | `Mark as complete` | Confirmation tells truth about review |
| Contributor submission (future contract) | `Send for lead review` | Exposes pending state; not currently active |
| Eligible nearest-lead decision (future contract) | `Accept work update` | `Request changes` |
| Existing independent task review | `Approve work` | `Request changes` |
| Unknown server response | `Check current status` | Never blindly repeat a mutation |
| Interrupted upload with same request ID | `Resume submission` | Use original receipt/draft |
| Scroll pagination | `Load older activity` | Retain scroll/focus |

Use labels that fit narrow screens; place long consequences in helper or confirmation copy rather than forcing five-word buttons to coexist side by side.

### Field names and helper text

| Field | Label | Helper / validation when needed |
| --- | --- | --- |
| Subtask title | `Title` | `Enter a subtask title.` |
| Newly created Subtask date (future) | `Start date` | Prefill today, then validate parent/project dates |
| Deadline | `Due date` | `Choose a due date on or after the start date.` |
| Default responsible person | `Subtask Lead` | `Must be an eligible member of this project.` |
| Others | `Contributors` | `Choose people who will work on this subtask.` |
| Work outcome | `Completion note` or `Completion note (optional)` | Do not mark optional if backend demands a note |
| Attachments | `Evidence (optional)` | `Add photos or documents, if helpful.` if file not required |
| Review feedback | `Feedback (required if requesting changes)` | No lengthy helper unless validation fails |
| Financial value | `Budget` / `Actual expense` | Show `Settled transactions only` if that is the approved definition |

Avoid always-visible walls of help text. Keep one short line where it prevents a predictable error. Use contextual constraints when invalid.

### Status and confirmation microcopy

| UI condition | Text |
| --- | --- |
| Contributor work sent for approval (when supported) | `Sent for lead review` / `Waiting for Gabriel to review this update.` |
| Root work sent for final review | `Awaiting approval` / `Your work was submitted. It is not complete until an eligible reviewer approves it.` |
| Officially completed | `Work completed` / `Your completion is confirmed.` |
| Changes requested | `Changes requested` / `Review the feedback before resubmitting.` |
| User lacks reviewer authority | `You're not assigned to review this work.` |
| Approver changed while open | `The reviewer changed. Refresh to see who can review this work.` |
| Rejected stale edit | `This subtask changed while you were editing. Review the latest details before saving.` |
| Unknown command outcome | `We couldn't confirm the result. Check the current status before trying again.` |
| Missing or unauthorized financial value | `Amount unavailable` (accessible explanation; visible cell can be `—`) |
| Server refuses current contributor mutation | `Lead review isn't available yet. This update won't change official progress.` |
| No Activity | `No activity yet` |
| No project rows | `No projects here yet` |
| Search returns zero | `No matching projects` / `Try a different name or filter.` |
| No reviews assigned | `You're all caught up` / `No reviews need your decision.` |
| A bank/cash/settlement outcome is unknown | `Settlement not confirmed. Check the original record before retrying.` |

Name the problem and the safe next step. Never use `Something went wrong` when a clearer known reason exists. Don't blame the person (`You failed`), and don't hide a denial behind a fake network message.

## Suggested detailed copy flows

### “Mark as complete” when independent approval is required

```text
Button: Mark as complete
Confirmation title: Send work for approval?
Body: Your completion note and any evidence will go to an eligible reviewer.
      This task will stay awaiting review until approved.
Confirm: Send for approval
Cancel: Keep editing
Receipt (confirmed): Awaiting approval
Description: Submitted for review. The task isn't completed yet.
```

When a Subtask Lead has **existing authorized direct completion** and the business rules allow it, adapt the confirmation to say `Mark this subtask complete?` and show final completion only after a verified server receipt.

### Proposed nearest-lead contributor review

```text
Contributor CTA: Send for lead review
Confirmation: Send this update to Gabriel?
Body: Your work will be recorded as pending. Official progress won't change
      until Gabriel accepts it.
Receipt: Waiting for Gabriel
Lead queue item: Andres submitted a work update
Lead actions: Accept work update / Request changes
Accepted receipt: Update accepted
Changes receipt: Changes requested
```

If a backend staging contract is absent, **do not display the send/accept actions as functional**. Present an accurate unavailable reason and an authorized fallback only if one exists.

### Financial information clarity

```text
Header: Actual expense
Value: ₱1,250.00
Accessible label: Actual expense: one thousand two hundred fifty pesos
Unresolved: —
Accessible explanation: Actual expense is unavailable for your current access.
```

Do not present an amount without Office/FY/record context in a financial decision form. Never conflate an allocation, release and settled expense.

## UX writing QA

Review every screen for:

1. **Terminology:** no stray `subitem` in visible UI; no new hidden distinction between `lead` and `reviewer`.
2. **Predictability:** button + confirmation + receipt all tell the same authorized state transition.
3. **Consistency:** the same action is named the same way in Task, Subtask, Inbox, Activity and More.
4. **Brevity:** remove repeats and filler; don't remove essential dates, actor, status, amount or approval explanation.
5. **Recovery:** failures tell users what they can do without duplicate posting or unsafe retry.
6. **Optionality:** if text says optional, server actually permits omission in the specific workflow.
7. **Inclusive access:** screen-reader labels include identity/context/units; don't rely on color or abbreviations.
8. **Layout:** no truncation of critical buttons or statuses at 200% text; long localized strings wrap or stack.
9. **Truth:** no “completed” before confirmation and no ₱0 for unavailable value.
10. **Audit:** immutable activity wording remains historically faithful; a display rename must not rewrite past evidence.
