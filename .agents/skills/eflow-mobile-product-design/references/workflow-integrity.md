# Workflow integrity: product rules that design must preserve

Use this reference when designing task/subtask dates, delegation, approval, progress, finance, notifications, or activity. It deliberately distinguishes **existing behavior** from **proposed shared contracts**. Backend/DB modifications require explicit separate approval.

## 1. Canonical work hierarchy and status

- eFlow Office work has a root **Task** and nested **Subtasks**, up to the server-supported maximum depth. Personal work has its own context and commands.
- A user can have one of several *contextual* responsibilities: Task Lead, a Subtask Lead at a particular node, contributor, eligible reviewer, responsible Head. This is not a new account role.
- Historical APIs/database tables still use `subtasks`, `personal_subtasks`, some `subitem` identifiers and `r7`/`nw` operations. The **UX language** changes to `Subtask`; schema renaming is outside the requested feature.
- `todo`, `in_progress`, `for_review`, `changes_requested`, `completed` and other live statuses remain canonical; do not create shadow mobile status enums merely to display new words.
- **Pending review is not completed.** An authorized click on **Mark as complete** can *request* completion rather than finalize it. Tell the truth in the confirmation and receipt.

### Progress rule — current source baseline

```text
Project percentage = completed eligible root tasks / eligible root tasks × 100
Task percentage    = completed eligible direct subtasks / eligible direct subtasks × 100
Subtask percentage = completed eligible direct child subtasks / eligible direct child subtasks × 100
Leaf percentage    = 100% if canonical status = completed; else 0%
```

Round display to nearest integer once; example `2/3 = 67%`. Use direct children **once** at each level to avoid double counting. A parent with child progress of `2/3` can still have canonical status `in_progress` or `for_review`, and may not contribute to its parent/project's **completed item** count until its own approved completion. Different hierarchy levels are *not* identical metrics: label what is counted.

When there are no eligible children, do not claim fully completed on the basis of empty denominator. Display `0%` for open leaf, `100%` only for canonically completed leaf, or a purposeful `Not started` summary. If eligibility/counting of cancelled, archived, optional, blocked or inaccessible children is ambiguous, record an explicit **product decision** and align Web/Mobile/server selectors. Never compute percentages from a partial page if more records may be paged; get an authorized complete count or show an unresolved state. Do not let submitted/unaccepted contributor work enter numerator or canonical progress.

**Data-integrity requirement:** if the UI displays `2/3` but a backend field reads `percent_complete=45`, do not silently overwrite the DB with `67`. Present the completion-based metric as its clearly named metric until a shared canonical progress contract is approved. If the product chooses to make completion-based progress canonical, design a migration and update every source, analytics, closeout and notification consumer in Web/Mobile simultaneously.

## 2. Nearest-lead approval — target behavior, NOT yet implemented

The latest Mobile baseline blocks contributor direct execution because the shared server currently has no universal pending state. This is safer than applying unapproved work. **Do not lift the guard until the server supports the workflow.**

### Recommended scope of review

Require lead acceptance for changes that would modify **authoritative work state**, including progress, completion, blocker/resolution state, acceptance status, and edits to formally verified evidence or milestones. Make comments, draft text, in-progress uploads and ordinary conversation free from a separate approval unless their effect changes the official record. This is a proposed refinement of “every action needs validation”; record whether the product owner wants a stricter policy before implementation.

### Server-enforced state machine

```text
Contributor drafts work locally
  └─ Submit work update (idempotency key + base revision)
       └─ PENDING_LEAD_REVIEW (submission stored, canonical node UNCHANGED)
            ├─ Eligible nearest lead accepts
            │    └─ Recheck authorization + revision + descendant/finance rules
            │         └─ atomically apply approved change; append audit events;
            │            notify affected users; refresh project/task percentages
            ├─ Eligible nearest lead requests changes (with reason)
            │    └─ CHANGES_REQUESTED (no authoritative work mutation)
            └─ Lead changes / actor loses access / scope closes / revision stale
                 └─ REVALIDATE or BLOCK, preserve the submission and history
```

At root Task level, use the authorized Task Lead for contributor progress where allowed, **not** automatically the Office Head. At a specific Subtask, first identify the *nearest eligible appointed lead* for that node. For a nested child, propose parent/ancestor fallback **only if** formally approved and server-authorized; do not route silently to whoever happens to be listed in the directory. Keep server-side independent final-task/finance review **separate** from this contributor acceptance.

### Required backend capabilities before changing Mobile from read-only/blocked

Propose (do not assume installed) an actor-scoped, versioned submission record or equivalent RPC contract with:

- Stable submission ID, idempotency key, base entity revision, Office/project/root/node IDs, writer and intended approver IDs, proposed diff, evidence references, timestamps, decision state and decision reason.
- Server-resolved approver from current hierarchy; validation against membership, role, Office access, appointment, reviewer self-decision and withdrawn access at **decision time**.
- Atomic accept or reject with pessimistic/optimistic locking, duplicate-call receipt lookup, immutable recorded evidence/history, precise audit and notification/deep-link data.
- No upstream status/progress/project-finance mutation while pending; accepted changes publish through normal Realtime invalidation. No backdoor client patch to `tasks`, `subtasks`, project totals or notifications.
- Correct behavior when an ancestor is transferred, an Office member is removed, a branch is moved, the due date passes, the project closes, the user retries offline, or the same submission is decided twice.

### Example (proposal, not executable API)

```text
Andres — contributor on “Inspect client counter”
  1. Opens Subtask → enters update/evidence → taps "Send for review".
  2. Sees "Waiting for Gabriel"; his draft becomes a recorded pending submission.
  3. Subtask canonical progress and project completion remain unchanged.
Gabriel — appointed nearest Subtask Lead
  4. Sees "Review work" with author, timestamp, exact differences, evidence.
  5. Accepts, or requests changes with a reason.
  6. Only accepted work updates canonical status/activity and dependent metrics.
Root Task final approval, independent reviewers and finance remain separately controlled.
```

Where an approved participant is also the lead, preserve existing direct-authorized flow unless the product explicitly changes it. Avoid a review loop that requires the lead to approve their own work.

**Release block:** until the server and both Web/Mobile clients implement and test this, show an honest limited state instead of a tappable action that cannot complete. A disabled CTA is better than an insecure one, but add explanation and an alternative (contact lead/use Web only if truly supported).

## 3. Subtask start dates — target behavior, NOT yet implemented

The existing root Task `start_date` is persisted and exposed on mobile. Existing Office/Personal subtask nodes and nested-work commands do **not** yet have the needed shared start-date field/round-trip support.

**Proposed contract before UI becomes editable:**

1. Persist nullable `start_date` on both Office and Personal nested nodes through canonical migrations and safe backfill policy; revise read projections, serializers, types and commands on both Web and Mobile.
2. On **Add Subtask**, prefill **today** in the user's intended work timezone (for eFlow Philippines: `Asia/Manila`) *on opening the form*. Keep date only in draft until submission. Don't change it at midnight while the sheet is open.
3. Establish explicit bounds: project start/target, parent Task/Subtask start and due, and child due. Product decision: block or warn when `today` is outside those bounds; do **not** silently write a nonsensical date. Offer a clear alternative if historical work needs a past date.
4. Prefill lead with nearest eligible parent lead for a nested Subtask if the business policy permits; otherwise eligible root Task Lead. The latest Mobile code currently preselects the **root Task Lead** when eligible.
5. Validate again on the server; protect an in-flight draft against stale schedule/appointment changes; use command receipts for retries.
6. Preserve old rows with blank start date until a deliberate migration/backfill policy is approved; never pretend all historical subtasks started today.

**Copy:** `Start date` · default today · helper only if needed: `Must be on or after the parent start date and on or before the due date.` Do not show `Start date` as editable while backend rejects it; the current unavailable message is acceptable interim truth.

## 4. Finance columns and the difference between allocation, release and expense

Existing v41 Task Main table includes **Budget** and **Actual expense**. Current client (`projects/projectTaskFinance.ts`) uses *approved root allocations* for Budget and *settled authorized cash records*, including matching descendant Subtasks, for Actual expense. This is a particular source definition; it is not a universal General Ledger balance.

- Display `₱` with consistently formatted numeric values. Treat `0` as **known zero**, `—` or `Unavailable` as **not established/not authorized**. Do not turn `null` into zero.
- Never add unsettled/requested/released cash as *actual expense*. Preserve project/task/Office/FY scope and avoid double counting child amounts already represented in a parent summary.
- Visibility is determined by server RLS and role, not by a client column being present. Empty or partial RLS data must not be portrayed as complete Office totals.
- Advanced funding edits, annual budgets, mappings, journals, approval/settlement and ledger posting retain existing controlled workflows and Web handoffs.
- Product decision: whether UI title should be `Actual expense` or `Settled expenses` based on the approved accounting definition. Do not casually relabel without finance approval.

## 5. Reviews, Inbox and receipts

- **Inbox** should highlight updates and unread records; **Reviews** is reachable from More as an explicit queue. Removing a heading must never delete required review capability or critical actions.
- An item opens the **exact work, financial record, Office and fiscal year**. Back returns to the same filter and position. Authorized user changes invalidate previous cached destinations.
- **Review decisions:** no self-review, server revalidation of latest submission, cash-clearance checks before task approval, confirm intended effect and collect a reason when returning work.
- **Status messages:** `Submitted for approval` when pending; `Completed` only after final server confirmation. On uncertain response say `We couldn't confirm this action. Check its current status before trying again.` Never auto-repeat a financial or approval command without checking its original receipt.

## Product decisions that must be explicitly closed

1. Does the completion-based percentage replace the *canonical* progress field, or is it a labeled *display-only completion rate*?
2. Are cancelled and optional children included in the denominator? Are there zero-child exceptions?
3. What exact contributor actions need lead acceptance? Is commentary/evidence-upload submission-only exempt?
4. Can a parent lead review a nested Subtask when its appointed lead is absent? What is the explicit fallback?
5. What if a Subtask is due before today's default start date?
6. Is the financial `Actual expense` metric specifically settled cash, or must it reconcile with general-ledger expense postings?
7. What happens to active pending submissions when a lead transfers or a project closes?

Until closed, label these **design decisions**, not functioning code.
