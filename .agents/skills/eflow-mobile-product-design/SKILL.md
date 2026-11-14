---
name: eflow-mobile-product-design
description: Senior product-design, UX-writing, and interaction-quality workflow for eFlow Mobile (Expo/React Native), especially task/subtask execution, nearest-lead review, completion percentages, project and financial tables, role-specific Home/Accounting navigation, activity, Inbox, and meeting revisions. Use for audits, UX critiques, design proposals, acceptance criteria, and implementation planning. Inspect the newest Web and Mobile code before deciding what to change; do not edit code, Git, or hosted Supabase without separate explicit approval.
---

# eFlow Mobile — senior product-design skill

## Mission and non-negotiable outcome

Make eFlow Mobile **effortless for frequent work without weakening eFlow's government-accountability controls**. It is a native companion to eFlow Web, not a shrunken Web dashboard. Design for a person who has one hand, a small screen, a deadline, and incomplete connectivity.

Optimize for **clarity, correctness, recoverability, accessibility, and speed of deciding what to do next**. A beautiful screen with misleading progress, an unapproved mutation, or an unclear financial value fails this skill regardless of aesthetics.

**Default mode = design/review, no writes.** First provide a source-grounded audit and proposed design. Do not create branches, commits, PRs, source edits, migrations, live test records, database changes, or deployments without an explicit, separate user authorization for those actions. Approval to critique or design never authorizes implementation. Distinguish a proposal from an implemented/tested behavior.

## Start here: verify what is already shipped

1. Read current **Mobile `main`** and **Web `main`** commits, not recollections, old screenshots, or historical QA reports. Web owns canonical business rules and Supabase migrations; Mobile owns native presentation and client execution. Review the latest code, changed files, current documentation, and relevant tests.
2. Produce a **delta ledger** for each requested change: `DONE IN SOURCE`, `DONE BUT NEEDS UX POLISH`, `BLOCKED ON SHARED CONTRACT`, `NOT IMPLEMENTED`, or `VERIFIED ON DEVICE`. Attach the exact file/flow and what evidence supports each status. Do not confuse automated tests or emulator sign-in screens with signed-in end-to-end acceptance.
3. Read [references/current-state-2026-11-11.md](references/current-state-2026-11-11.md) for the last inspected baseline. Treat its SHAs as a *historical checkpoint*, not the latest truth. Re-audit before using it for decisions.
4. Read the existing native design source `docs/mobile-redesign/design-system.md` and the shared UI components before proposing any new visual vocabulary. Reuse its established eFlow identity; do not import monday.com products, trademarks, colors, or React Web components into React Native.

### Current checkpoint (must be reverified when invoked)

- Mobile `main`: `53d4d794fcb4303ee4a0a11fc4cb164b4ac402b9` (2026-11-10 UTC), including meeting-related v41 changes.
- Web `main`: `4ff217b84e3e8128555ffc87f0514253cd576399` (2026-11-10 UTC).
- Latest Mobile source already has the **Subtask** UI term, task start dates, inline activity, a child-count completion display, project directory/main-table redesign, role-specific Home, optional evidence copy, `Mark as complete`, separate Reviews, and review button stacking.
- **Still blocked** at this checkpoint: persisted Subtask `start_date` and a server-authorized, nearest-lead **pending-contributor-change → review → accepted-apply** contract. The current UI refuses some contributor execution rather than pretending approval exists.
- Recorded evidence: 274 passing tests in 84 suites and a v41 Android emulator cold launch; no signed-in full acceptance for this build and no native iOS device validation. Do not call these flows production-verified.

## Working method

### 1. Diagnose the job before the screen

For each feature, write this compact **job statement**:

`As [permitted actor] in [Office/Personal context], I need to [make one decision or action] so that [observable result], subject to [approval/data rule].`

Then map: entry point → first meaningful information → permitted action → confirmation/feedback → persisted outcome → Inbox/Activity/Web reflection → failure/retry/back behavior. Include a second account if review or delegation is involved.

Before drawing UI, answer:
- What does this person need to **know** now?
- What do they need to **do** now?
- What must **not change** until approval or server confirmation?

A screen has one dominant objective; details and advanced controls belong in contextual menus or Web handoffs. Do not hide a required action behind more taps merely to look minimal.

### 2. Design for authority, not just roles

Distinguish permanent account roles (`head`, `member`, `accounting_staff`; `admin` is Web-only) from contextual appointments (Task Lead, Subtask Lead, contributor, eligible independent reviewer, responsible Office Head). Role alone does not authorize a mutation. Validate Office, project, root, nearest eligible lead, status, revision, self-review and financial restrictions **on the server**.

If a requested interaction needs a missing backend contract, specify it and return `BLOCKED`. Never remove an existing write guard, fabricate a local approval, silently update an authoritative progress value, bypass journal separation, or repurpose a financial posting RPC.

Read [references/workflow-integrity.md](references/workflow-integrity.md) whenever the change concerns contributor work, reviewer selection, percentage computation, status, dates, cash, or financial totals.

### 3. Create a focused experience spec

For each affected screen supply:

1. **Job and actor**, scope, and opening path.
2. **Information hierarchy**: title/context; status/one key metric; immediate action; supporting details; history.
3. **Compact layout** in a phone-width sketch or textual wireframe; call out scrolling, pinned columns, responsive states and safe areas.
4. **Exact copy** for headings, buttons, confirmation dialogs, empty states, blocking messages, pending states and uncertain outcomes.
5. **State matrix**: loading, empty, ready, pending approval, changes requested, blocked/unauthorized, stale, offline, error, successful persisted outcome.
6. **Source contract**: actual columns/RPCs/types/events, guards, calculations and permissions; no placeholder fields passed as real.
7. **Acceptance criteria**, including multi-account and cross-app consistency.

Read [references/screen-patterns.md](references/screen-patterns.md) for the requested design decisions, hierarchy, layouts and native conventions. Read [references/ux-writing.md](references/ux-writing.md) when writing any user-facing copy.

### 4. Choose the smallest coherent action set

- One main action per active workflow state, and a very small number of secondary actions.
- Minimize **decision count** rather than button count alone. A button must tell users the real outcome, especially for approvals.
- Prefer context-specific rows, sheets, one clearly labeled ellipsis menu, and progressive disclosure over nested cards or toolbar collections.
- Prefer a plain chronological activity timeline, readable table cells, and explicit information states over decorative illustrations.
- Preserve the table's **pinned Task identity** and consistent header/row alignment. Always disclose horizontal scrolling and maintain first-column/controls usability.
- Keep a user's filter, list position, task path, draft, and workspace context when entering/exiting details.

### 5. Apply the existing eFlow visual system

Use existing native `theme.ts`, `Appearance.tsx`, `Typography.tsx`, `Screen`, `Button`, `Card`, table components, and Figtree assets. Reuse eFlow navy/blue brand accents, semantic status colors, dark/light mode, existing Lucide iconography, and motion tokens. Start with **16dp page insets**, **4/8/12/16/24/32 spacing**, **48dp touch targets**, legible **15px body / 13px metadata**, and generous vertical touch rhythm—adjust only in accordance with current theme tokens and tested device constraints.

**Visual quality gate:** a calm hierarchy, consistent alignment and data density, distinct actionable and nonactionable states, no clipped touch labels, no overlapping buttons, no all-card nesting, no loss of information in dark mode. At 200% text scale, prefer wrapping/stacking over shrinking or truncating core data. Color never communicates status alone.

Monday Vibe is a **pattern reference for UX writing and task-management clarity**, not an instruction to reproduce its trade dress. The supplied handbook URL is catalogued in [references/ux-writing.md](references/ux-writing.md); if a reference page cannot be opened, do not invent quotations or claim to have reviewed its exact contents.

### 6. Protect consistency and release quality

Design and implementation acceptance must check the following:

- **State alignment:** Mobile vs Web vs backend reports the same official status, task/child counts, authorized budget and settled expense; distinctions are labeled honestly.
- **Approval boundaries:** a pending contributor submission never changes canonical progress, completion, project aggregates or financial data.
- **Stale and offline safety:** client restores drafts and verifies receipt IDs rather than replaying irreversible operations; a cached view never grants new authority.
- **Native accessibility:** Android/iOS, 360/390/430dp, dark/light, 150%/200% font, landscape, keyboard, reduced motion, TalkBack/VoiceOver, screen-reader row/amount labels, safe areas and Back behavior.
- **Data access:** Office and Personal workspaces are isolated; hidden fields do not leak into accessibility labels, notifications, cache or logs; role switches clear prior actor data.
- **Observability:** state and approval history are auditable; errors explain what happened and what the user can safely do next; no false success toast.

Read [references/acceptance-and-handoff.md](references/acceptance-and-handoff.md) and use its release gates. If permitted to implement, do one scoped batch at a time and attach typecheck, tests, Hermes exports, visual/accessibility evidence, integration checks and explicit **NOT TESTED** items. Do not equate a successful build with live financial approval or signed-in device acceptance.

## Required output format for a design request

Use this order; omit unnecessary prose:

1. **Executive recommendation:** what to keep, refine, eliminate, and defer; one paragraph.
2. **Current-state delta ledger:** source-evidenced done / polish / blocked / new; no work claimed as complete without proof.
3. **UX design decisions:** concise, concrete spec for each affected screen, with microcopy.
4. **Cross-role/cross-system impact:** Head, Member, Accounting Staff, contextual leads, and Web/shared backend.
5. **Risks and unresolved product decisions:** especially approval policy, zero-child progress, start-date bounds, finance disclosure.
6. **Acceptance scenarios and verification status:** show pass/fail/blocked/not tested clearly.
7. **Approval gate:** distinguish proposed next work from any actual authorized changes.

If the user asks for a **design review only**, finish with the recommendations and do not write code. If they explicitly authorize implementation, first establish scope and permissions, then use the same checks as implementation gates. Never claim a push, migration, build, or hosted action without actually verifying it.
