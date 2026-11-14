# Production screen and interaction patterns

Apply current native eFlow components and tokens; these are **design specifications**, not a request to write code. A design is good only if it survives actual small devices, live permissions, empty states and slow connectivity.

## One-screen hierarchy

For every destination, organize in this order unless the task demands otherwise:

1. **Identity/context:** back, title, Office/Personal workspace and (only when needed) parent breadcrumbs.
2. **State:** legible status + one meaningful fact (deadline, completed count or amount). Avoid three competing colored badges.
3. **Primary action:** one label reflecting the present capability/transition; secondary action near it only when required.
4. **Essential detail:** owner/lead, dates, responsibilities, financial data if authorized.
5. **Proof and history:** relevant Activity, evidence, work decisions, contextual children.

On an activity-forward Subtask screen, show the state/lead summary then **Activity directly**, without a “Show activity” tap. Present Child subtasks in a compact section that does not crowd out history. The goal is *less cognitive load*, not deletion of required facts.

## Home, personalized by role

| Actor | Most useful visible signal | Main tap target | What not to display |
| --- | --- | --- | --- |
| Office Head | 3 most urgent *current* projects; on-hold first, then active, each with status and task-completion count/percent | Exact project | Recently visited feed, full portfolio charts, unreadable micro-stat cards |
| Member | 3 personal work priorities; overdue and due-today tasks first, exact Office/Personal context | Exact Task/Subtask | Unfiltered organizational portfolio or unrelated people's tasks |
| Accounting Staff | **Accounting** main tab (no duplicate Home); Requests & releases, Assigned reviews in Accounting; Reviews in More for any assigned work | Exact authorized finance record or review | Busy general dashboard or duplicate navigation tab |

Keep Favorites/Workspaces shortcuts where they serve frequent navigation but not at the cost of the urgent top 3. Authorized workspace switch must re-scope and invalidate stale view data without flashing a blank page. Show `Last updated` only when staleness matters.

## Projects directory — one compact table

Use existing shared `ProjectDirectoryCells`/`WorkTableRow` patterns rather than a separate card system.

Recommended first-level columns: **Project | Status | Type**. A row opens its project; favorite is a separate 44–48dp tap target. Search and a single status filter sit above the table. Hide redundant `Recently visited` grouping here if it undermines a clean scan; preserving recent navigation preference internally is okay.

On 360dp phones, prioritize project title, wrap rather than ellipsize identity beyond recognition, and avoid squeezing `Status` or `Type` below readable size. Use a consistent header, status chips with text, subtle separators and clear active-row feedback. When too narrow, restructure secondary data into a two-line cell rather than violating minimum touch/font sizes; the user asked for a table **type**, not desktop-grade density at any cost.

Table states: skeleton aligned with actual columns; no accessible projects; filtered empty; interrupted/refreshing; revoked access while open. Loading additional pages must not reset the search/filter or duplicate rows.

## Project Main table — data-first, horizontally scrollable

Columns currently shipped: **Task (pinned) | Status | Owner | Start date | Due date | Budget | Actual expense**. Do not bring Office back as a column. The project/workspace context already supplies Office context.

- Reuse the same cell, status, typography and separator vocabulary across the Projects directory and project Main table.
- Keep **Task** pinned while one horizontal gesture scrolls the other columns. Keep grouped headers and row cells aligned during pagination, filtering and refresh.
- Present amounts as `₱1,250.00` (locale/format consistent with project conventions), `₱0.00` only if a verified zero, and `—` if unavailable. Avoid cut-off currency values; use tabular numerals and spoken labels (`Budget: ...; Actual expense: ...`).
- Show `Swipe to see more columns` only when necessary; don't repeat it for every group.
- Never fabricate financial values on a skeleton or infer from budget impact estimates. Stale expense reads should have a targeted recovery state.

## Task inspector

**Above the fold:** Title, `Status`, start/due date, lead, `2 of 3 subtasks complete · 67%` where relevant, and one primary action if eligible.

- `Start work` or `Resume work` only when the server allows.
- `Update work` belongs to the current lead/capability; contributor pending-submission only after backend contract exists.
- `Mark as complete` is a **user intention**, not a promise that approval is done. Confirmation and result must reveal whether it sent for review or completed outright.
- `Subtasks` show one level at a time with compact child rows, status and counts; breadcrumb return to the root.
- `Activity`/evidence/funding are accessible and relevant. Don't replicate Web planning, journal or AI import forms.

When a task has no subtasks, use its *canonical approved status* for 0/100 rather than a fake 100% empty checklist.

## Subtask inspector

**Summary:** status, `x/y subtasks complete` when children exist, due date, appointed lead and contributors. Avoid redundant `Subtask details`, `Level 3`, `Activity updates` labels in the same vertical area; if level/path is needed for navigation, use a breadcrumb or small secondary context.

**Activity:** immediately visible chronological timeline; one heading **Activity**. Each item: meaningful action (`Work updated`, `Submission sent`, `Approved`, `Changes requested`), author, time, note/difference, accessible evidence, and related decision. Avoid nested cards for every event; use restrained timeline rail, dividers and whitespace. Deduplicate events representing the same update when merged from two APIs; do not mis-order missing timestamps as recent. Older history loads deliberately without shifting focus.

**Actions:** contributor without pending backend contract sees a concise explanatory nonactionable state, not a fake approval button; eligible lead sees one relevant action. Child management in a contextual action sheet. Office funding is distinct and permission-scoped.

## Add Subtask sheet — intended complete design (backend dependent)

```text
Add subtask
Title *                       [single-line field]
Start date                    [Today; calendar picker]   ◀ not yet persisted
Due date                      [date picker]
Lead                          [eligible Task/parent Lead preselected]
Contributors                  [selected people, optional]
[Create subtask]              [Cancel]
```

Prefill on first open; preserve user edits across temporary interruptions; show inline validation and disabled/busy states. Preselected lead remains editable *only* by a capable actor and eligible person. For a child Subtask, consider nearest parent lead by explicitly agreed rules; latest code currently uses eligible root Task Lead. Missing start-date contract means this field remains *proposed/unavailable* until Web schema + RPC + mobile projection + tests are deployed through approved steps.

## Evidence and completion composer

- Label: **Completion note** or **Completion note (optional)** based on the actual field rule.
- Label: **Evidence (optional)** only when files may genuinely be omitted.
- Put **Choose files** and **Take photo** behind concise, accessible actions; show file name, type, size, remove and upload state.
- User sees one clear primary **Mark as complete**; for a review path, the confirmation says `This will send your work to an eligible reviewer.` The successful intermediate state says `Awaiting approval`, not `Completed`.
- Recover interrupted upload and command receipts without duplicating attachments/submissions.
- Do not use a bright success icon for a request that is merely pending.

## Review panel — prevent overflow and ambiguity

Show work context; submitter/time/status; note and attachments; verified clearance; reason field (`Feedback (required if requesting changes)`); then **stack** full-width `Approve work` and outline `Request changes` vertically when space is limited. Do not put two long labels in an inflexible `Row` at 360dp or 200% scale.

- Disable approval while cash blockers, attachments or latest submission state are unresolved. Explain why; offer refresh/recheck.
- Capture a reason for changes; block self-review; require a stable receipt.
- On approval, show final actual state only after server confirmation; on an unknown response, direct to **Check current decision**.
- Keep all actionable areas visible above the keyboard via scroll/safe area.

## Notifications, Reviews, More and Accounting

- **Inbox/Notifications:** `All` / `Unread` and concise recent updates. Remove the **Assigned decisions** section/label from the default Inbox layout, not the review capability.
- **Reviews:** discoverable from **More**; organize assigned decision queue with precise destination and actor. Do not conceal urgent Head/Accounting review behind an unexpected number of taps. Evaluate urgency badges rather than another permanent tab.
- **More:** Reviews, Messages, Announcements, authorized Office petty cash, Account & settings, Sign out; do not create an AI/voice distraction or duplicate the Accounting tab.
- **Accounting:** main nav tab for `accounting_staff`, with readable Office/FY, requests/releases, review queue and clear statuses. Advanced journal/annual planning stay Web-only.

## Native visual and interaction constraints

- Follow `docs/mobile-redesign/design-system.md` for exact native token values. Current reference uses light canvas `#f5f7fc`, dark `#0a1028`, navy primary `#00006b`, accent blue `#0073ea` in identity, and documented semantic status tones. Design components against **both** themes, not pasted flat hex values.
- Use Figtree styles already bundled; scale text with the device. Target 48dp min hit areas, 16dp page gutters, meaningful 8–12dp row spacing, concise metadata, consistent alignment; no illegible 10px columns.
- Use lightweight, intentional transitions. Reduce/discard decorative motion under reduced-motion settings and when app backgrounded. A refresh must not blank a loaded view or animate a misleading state.
- Every pressable icon and row needs a screen-reader label/context; status and progress have verbal equivalents; finance values are read with units; focus returns after sheets; Back returns to prior location; invalidation follows active workspace/account.
- Every surface supports: initial loading, retained-data refresh, no content, filtered empty, denied/not authorized, unsupported Web handoff, stale conflict, offline/unconfirmed action, success with actual receipt.

## Mobile design review scorecard (0–3 per criterion)

| Criterion | 0: fail | 1: weak | 2: good | 3: release quality |
| --- | --- | --- | --- | --- |
| Decision clarity | Action unclear | Needs explanation | Direct | Immediately obvious + honest outcome |
| Information hierarchy | Dense/duplicated | Mixed priorities | Clear | Role/context-driven within 1 glance |
| Business correctness | Misstates authority/data | Partial | Accurate | Accurate across Web/mobile/receipts |
| Visual craft | Misaligned/overlap | Inconsistent | Cohesive | Refined in both themes/scales |
| Accessibility | Inaccessible | Gaps | Usable | Device assistive-tech verified |
| Recovery | Data lost/retries unsafe | Basic | Safe | Durable, idempotent, actor-scoped |

**Never release at any score** if a critical business integrity, privacy, approval, financial amount, or accessibility blocker remains. A 3 requires device evidence; code review alone can only earn a provisional 2.
