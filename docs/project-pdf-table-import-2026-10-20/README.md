# PDF import inside the project table

Latest correction: [dedicated server operation and Cloudflare verification](SERVER_FIX.md). This supersedes the ordinary-chat enrichment and client-only cost-repair details in the original implementation receipts below.

This replaces the former **+ New → Import proposal / Create a work plan** entry. The old creation modal has been removed. Existing saved plans and their governance/history remain readable through their existing destinations.

## Current flow

1. Create or open the project and finish or leave Add people.
2. Choose **Import PDF**, immediately beside **Add people** in the project header.
3. Check **Schedule starts**. It defaults to the project's future/current start, or today for an undated/past-start project.
4. Select the PDF. Processing and saving happen in a small in-page panel; there is no separate work-plan creation modal or proposal publication step for this import.
5. The existing project's main table refreshes with the imported groups/tasks, priorities, effort, due dates and budget estimates. Its Budget estimate column becomes visible. Filters are cleared and focus moves to the first imported group.

Existing project details and work are preserved. The import does not create a second project, assign people, invite Offices, approve funding or release money. Task staffing, activation and review still use the existing authorized workflows.

## Source fidelity and AI

The ruled OCEDSIPP table is read directly from the PDF: eight Parts become group titles and ten numbered actions remain separate tasks. Each task keeps its source methodology and relative month schedule. The verified inception methods are separated between Kick Off Meeting and preparation of the detailed work plan. Other ambiguous merged methods are explicitly labelled as shared group methods.

Month 1 begins on the selected schedule date. Each interval ends the day before the same date in the following month, with month-end/leap-year handling. A date-only due date is persisted by the canonical task API at **23:59 Philippine time**. The three-/ten-year output horizons do not become execution deadlines.

One AI request enriches the fixed source tasks with priorities, estimated effort and cost placement. A malformed/incomplete source-cost mapping gets **one** references-only repair request. The importer stops if the repaired mapping is still incomplete, duplicated or invalid; it does not save a partial source budget.

All 16 source cost lines total **₱2,156,500**. Source values and fund labels come from the validated PDF table. Subtotals are not counted as expenses. Shared cost placement and priorities are suggestions; the Head can adjust estimates in the table. Source cost particulars and fund labels remain in task descriptions and in the import receipt.

## Database deployment

Hosted target: **ixnfphgjyelhckjwjkdv**. Live history was read into an isolated local migration workspace before applying the reviewed pending SQL. The repository's historical migration directory was not pushed, and deployed history was not repaired.

- `20261019212209_project_pdf_table_import`: additive, invoker RPC `import_project_pdf_work(uuid,uuid,jsonb)`.
- `20261019212408_project_pdf_import_validation_access`: performs validation within the invoker RPC rather than calling private helpers that authenticated users cannot execute. Private helper permissions were not widened.
- `20261019212642_qualify_project_import_hierarchy_aliases`: fixes an existing `g`/`t` alias collision in the canonical importer, preserving its signature, body behavior, role checks and nested-import rejection.

Canonical groups/tasks and their estimates are written in one transaction. The existing project lock and import receipt prevent duplicate batches. Retrying a committed batch returns the receipt without overwriting later manual estimates. Detailed reviewed costs are retained in that receipt; `tasks.budget_impact` supplies the table estimate. These are not financial allocation writes.

## Sidebar favorites

A starred project appears under Favorites and is omitted from the other project lists. Unstarring it returns it to its normal active/archived list. The project and its access rules are unchanged.

## Verification

- Production build passed after the final source changes (6,303 modules); existing bundle-size/mixed-import warnings remain.
- Focused project-PDF, import-validation and retry-safety unit tests: **20/20 passed**. Affected date validation and editing tests also passed (**25/25**, including the six PDF cases shared with the first run; **39 distinct affected cases**).
- Disposable PostgreSQL wrapper tests: **13 passed**; canonical importer/patcher dependencies are explicitly stubbed there.
- Actual hosted, authenticated Head rollback: imported eight source groups and ten tasks with a saved estimate sum of **2,156,500**, preserving the first due date at `2099-11-19T23:59:00+08:00` for the chosen `2099-10-20` test anchor. The entire transaction was rolled back.
- Four additional hosted rollback checks passed: saved fields, same-batch retry retaining a later manual estimate, mismatched source-total rejection, and Member denial. No QA tasks or groups remain from these checks.
- Real local DeepSeek returned ten valid priority/effort records, but initially only ten cost references. The bounded references-only pass returned all sixteen valid references. This validates coverage and format, not the semantic correctness of every shared-cost placement.
- Desktop browser acceptance exercises the actual PDF with mocked AI/persistence, canonical source task/method fields, table refresh and estimates, same-request retry, and preservation of the selected project. Favorites/unstar behavior and a 320-pixel in-page import panel are covered separately. A cold app-shell timeout passed on retry; fixture screenshots are not presented as hosted production data.
- The previous pre-integration full unit run completed **2,013/2,013**. A new full collection runs separately for this integration; its final result must not be inferred from the focused pass.

Final source checks:

- `npm run check`: passed after the date-cell layout change.
- Final `npm run build`: passed, 6,303 modules.
- `npm run graph:update`: passed, 10,259 nodes / 33,080 final edges; the same four existing extraction warnings remain.
- The new-project browser scenario additionally creates the project through the current creation UI, leaves Add people, verifies the adjacent Import PDF button, imports into that new project, and proves unrelated existing task records unchanged. The final screenshot assertion confirms the date button fits its cell.
- Normal import, same-batch retry, favorites/unstar and 320-pixel panel scenarios all reached a pass. A cold app-shell fixture timeout was retried; no functional source/budget/retry assertion was removed or weakened.
- Live preservation check: zero remaining rollback QA tasks/receipts, anonymous RPC execution denied, authenticated execution allowed with the Head checks, and the new RPC remains SECURITY INVOKER.

Screenshots are synthetic browser fixtures using the actual PDF and mocked model/persistence: [project header before import](project-header-desktop.png), [imported main table with readable dates](project-table-desktop.png).

Broad-suite final receipts:

- Full collection: **2,021 tests; 2,013 passed, eight timed out** during the concurrent run. All eight were the original five-second timeouts, across seven files.
- Serial rerun of all seven affected files: **47/47 passed**, retaining the original time limits and assertions. Both JSON receipts remain in `.codex-tmp/project-pdf-table-suite.json` and `.codex-tmp/project-pdf-suite-rerun.json`. This reconciles the failures; the initial full command did not exit green.
- Final date-layout browser check passed through actual new-project creation, the adjacent Import PDF action, automatic table insertion, preservation of unrelated work and the no-overflow date-cell assertion. Its cold app-shell fixture timed out once, then passed on retry. Screenshots above show the final layout.
- The final screenshot was inspected: the date range and time occupy separate lines and no longer spill into Priority.
- Both final type check and production build passed, and `git diff --check` is clean.
