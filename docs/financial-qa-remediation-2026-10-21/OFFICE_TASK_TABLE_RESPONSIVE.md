# Office tasks table: responsive layout correction — 22 October 2026

## Reported problem

Completed rows could wrap the task title a few letters at a time and collide with the owner, status and action controls. The old seven-column grid reserved 692px for fixed columns before padding, leaving an unbounded `1fr` task column to absorb the shortage. A second project rail narrowed the table even on a desktop monitor. The header also used different horizontal padding from the rows. The old viewport-only mobile override hid owner, priority and date rather than adapting to the actual table pane.

## Correction

- The header and rows now use the same column definitions and padding.
- Container queries use the actual board width. Wide panes retain all seven columns. Below 940px, the owner moves beneath the task in the same main column, leaving useful room for the title. Below 600px, the row stacks into a readable arrangement with owner, priority, due date, status and actions all retained.
- Long titles wrap normally, long tags truncate within their cell, and avatars/names cannot push adjacent columns aside. The existing initials helper replaces clipped full names inside avatars; the full owner name remains beside the avatar.
- Status groups, search, project selection, work-details disclosure, drag/drop rules and all role-controlled menu callbacks are retained. No task status, assignment, budget, database policy or endpoint changed.

Files: `tasks/components/board/ListBoardView.tsx`, `ListTaskRow.tsx`, `taskList.css`; removal of the obsolete task-specific mobile override in `src/styles/globals.css`.

## Browser acceptance

`tests/e2e/office-task-table-responsive.spec.ts` uses synthetic records and intercepts backend traffic against the production build. It covers physical desktop sizes 1920×1080, 1440×900, 1366×768 and 1280×800, with a 12-case matrix of 100%, 125%, 150%, 175% and 200% page-zoom layout equivalents where applicable.

Each case sets the effective CSS viewport to desktop dimensions divided by zoom, with matching DPR and desktop browser mode. This exercises reflow and container breakpoints; it is not pinch zoom or a claim that browser chrome was operated. Live browser control remains disabled, and these screenshots are not new hosted account interactions.

The test checks long completed task titles, a long unbroken tag, owner initials/name, visible priority/date/status, non-overlapping cells, no page/row horizontal overflow, header alignment, menu bounds, Escape focus restoration and completed-group collapse/reopen. Empty status groups are collapsed through the existing controls for useful screenshots; their drop targets remain part of the product. Tests open menus without submitting mutations.

## Receipts

Final browser, type-check, build, graph and full-unit results are recorded in `tests/office-task-table-*.log` and their exit files. Screenshots are under `screenshots/isolated-browser/office-task-table/` and included in GALLERY.html. Existing chunk warnings and the four known Graphify parser limitations remain separately documented.

- Built Chromium matrix: **12 passed**, exit 0, 2.2 minutes. The earlier one-case desktop smoke is not added to that total.
- `npm run check`: passed, exit 0.
- `npm run build`: passed, exit 0, 59.83s; existing large-chunk/reexport warnings remain.
- Full unit suite: **345 files / 2091 tests passed**, exit 0, 763.48s (`npm test -- --maxWorkers=4`). This is one complete invocation after the assertion correction, not a sum of targeted runs.
- Graph update: passed, exit 0; 10586 nodes, 35185 extracted edges, 475 communities. The same four pre-existing parser limitations remain.

The first full unit run had one obsolete source-string assertion requiring `px-5` on the header (2090 passed, 1 failed). That padding mismatch is part of the reported bug. The surface assertion now retains the canonical border/background/vertical-padding contract while the browser matrix verifies horizontal alignment. The affected file passes all three tests. The initial failed receipt is retained as `office-task-table-unit-before-assertion-fix.log`; the final full invocation is separate.

The initial development-server smoke used IPv4 against Vite's IPv6-only listener and did not reach the app. Acceptance uses the explicit IPv4 production preview instead. No product change was needed for that test setup mismatch.
