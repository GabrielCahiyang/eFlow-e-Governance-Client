# Project workflow redesign — agreed scope and delivery gates

## Status
Implemented in the web application and deployed to `ixnfphgjyelhckjwjkdv`. The workflow-data reset is complete; protected accounts and configuration were verified unchanged. See [REPORT.md](REPORT.md) for acceptance results and explicit verification limits.

The main migration and setup-guard follow-up were applied through isolated migration workspaces populated from exact live history. No historical timestamps were repaired and no unrelated pending migrations were applied.

Direct subtask completion was installed earlier; its evidence remains in `../direct-subitems-2026-10-30/`.

## Stage 2 — reset and project definition
Back up first. Remove dummy workflow data and its dummy attachments/history, preserving LEDIPO, all its accounts/emails/passwords/skills, Admin accounts and operational service configuration. Verify retained account IDs, identities and skill hashes before/after; do not print credentials.
Creation must open project details, not Add people. Required: title, description, scope, project lead, implementing office, start/target dates and funding setup or explicit no-funding declaration. Save incomplete drafts; block work/import/additional team until setup complete at both UI and backend. Project lead selection is a setup exception, not an automatic permanent role change.

## Stage 3 — project funding
Head authorizes a funding envelope from named Office Budget lines and fiscal quarters: e.g. FY2027 Q1 300000 + Q2 400000 = 700000. Total is derived, not independently entered. Reserve Office Budget once; tasks divide project funding, subtasks divide parent task funding. Preserve source identity through cash release and settlement. Validate source/fiscal period, currency precision, balances and concurrent operations atomically. Reject reductions below allocations or financial obligations. Funding changes proposed by project lead require Head authorization. Explicit audited release on closeout, no silent release on archive.
Display total authorized, allocated, unallocated, released, actual spent, outstanding advances/returned cash separately.

## Stage 4 — task review route
Task leader submits to project lead. If task leader is project lead, route to Head. Backend prevents self-review, checks current eligible appointments and handles reassignment/stale submissions explicitly. Missing eligible reviewer produces a visible red error, never silent fallback/self-approval. Parent project closeout goes to Head. Subtasks complete directly by contextual lead; no separate review.

## Stage 5 — cash review route
Task lead requests cash within eligible task funding. Project lead reviews; if requester/recipient is project lead, Head reviews. Approval reserves against task allocation; reject/cancel returns reservation without duplicate Office Budget deduction. Accounting releases only approved amounts once. Recipient submits receipts and returns unused cash. Project lead endorses unless conflicted, then Head. Accounting validation, settlement and journal posting remain separate permissions with independent-review/conflict guards. Open cash blocks final task approval.

## Stage 6 — dates, dependencies, editing and presentation
Project Oct30–Nov5 forbids task Nov6, including manually typed dates/import/API. Subtasks fit task and project ranges. Shortening parents reports conflicting records, never silently edits child dates.
Task3 depending on Task1+Task2 requires BOTH to reach final approved completion before Task3 starts. Prevent self-links/cycles/foreign project dependencies; missing/restricted prerequisites block. Guard all start/submit/approve/reopen routes and dependent work. Explain prerequisite statuses/counts and schedule conflicts.
Rename items/subitems to tasks/subtasks in UI/help. Add explicit Edit task/subtask centered modals. Nested Move to submenu, grouped reorder, matching icons, separated delete. Desktop layout/zoom and keyboard checks.

## Stage 7 — acceptance
Realistic QA with quarter sources, overspend/invalid dates/cycle rejection, task/subtask assignments, project lead vs Head review, petty cash reject/resubmit/release/settlement, project completion/archive and audited unused-funding release. Record screenshots, errors and fixes. User manual email/device checks separate. Never label intercepted browser tests as hosted finance acceptance.

## Error presentation
Failed saves, completions, approvals and money operations must use role=alert, red text, red-tinted bordered panel and an error icon/title. Explain why and corrective action; retain unsaved evidence/notes and use same request identity for uncertain-result retries. Success and informational states must not appear red.
