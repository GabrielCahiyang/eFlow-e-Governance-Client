# R11 local delivery - Reports and complete Activity

Implemented and verified locally 8 October 2026. Project Reports, report inspectors, Head/Office reports, Member Work Report, retained shared reports and Budget Expenses now use the shared analytical foundation. Authorized report lenses, filters, nested hierarchy, financial distinctions, all loaded receipt/evidence links, CSV/PDF and task drill-through remain. [The contract and ownership inventory](r11-reports-activity-contract.md) records retained generic controls, source completeness, accounting semantics and server authority.

Activity now uses real server pagination over a merged authorized history. Stable source IDs, deterministic equal-time ordering and owner-only snapshots preserve page membership and values across new/backdated inserts and decisions. Default size is 25, with 50/100 options, search/type/date filters, known counts, Previous/Next, reset/clamping and explicit loading/retry. Office and personal projects use the same checked API. Focus/background/access refresh revalidates current authority. Missing deployment and source failures are distinct from empty history.

Print defaults to all matching authorized events; Current page is explicit. Preparation reads and verifies every selected page before showing a document. Failed later pages produce no partial preview. Project/workspace, scope/filters, generated time, timezone, repeated table headers and page counters are included without app navigation. The exported 310-event specimen spans 15 pages and includes the oldest events.

Report source reads now exhaust server pages and bounded ID batches instead of trusting a loaded sample. Count changes and incomplete/failed sources require retry. Project filters retain whole task families and count parent funding pools once. Financial facts outside the loaded Office scope are unavailable; failed workflow reads block the register, and other partial reads withhold affected totals/exports. Existing financial mutation and signed-file services remain unchanged.

## Verification

- `npm run check` and production build passed. Existing static/dynamic import and shared-chunk size warnings remain; the shared chunk is approximately 3.59 MB before gzip. R13 / historical Phase 18 scale acceptance remains open.
- Full frontend suite: **231 files / 958 tests passed**. Fourteen new R11 tests cover complete reads under a smaller server row cap, bounded ID batches, count/source failures, nested families and funding semantics, unavailable Office scope, timezone/DST boundaries, filter/page reset, full/current-page print, invalid responses, snapshot changes, duplicate IDs, focus access revalidation and refusal of partial print.
- Disposable authenticated PostgreSQL: **38 assertions passed** with `npm run verify:r11-activity`. Real merged sources include more than 310 equal-time events, overlapping UUIDs across tables, submissions/decisions, audit, R7 delegated work and actual R3 personal commands. Every frozen page matches the ordered source baseline across new/backdated inserts and a mutable decision. Server filters, dates, sizes/clamping, snapshot owner, project access, expiry, source RLS loss, personal isolation, security-invoker privileges and anonymous denial pass. No hosted database was contacted or changed.
- Production-build Chromium: **24 distinct cases passed** across seven R11, six R6 file/inspector and eleven Phase 16 report/finance/support cases. R11 traverses all 310 IDs at 390/1440 px, refreshes to 311, checks full/current-page print, filters/errors/retry, missing deployment, personal context, archived read-only integration, family-filtered CSV and task drill-through. Earlier file privacy and financial controls remain covered.
- The final broader browser batch passed 22 cases; two test expectations were corrected and passed focused retests against the same application build. The workflow-failure test now asserts the existing outer error guard and absent register/export controls. The Accounting no-Office fixture retains a shared workspace, so it correctly encounters the existing shared-Office guard instead of the older inner Accounting warning. No runtime permission change was needed.
- PDF inspection confirmed **15 pages, 310 unique source IDs, repeated headers and page counters on every page**. First and last pages were rendered with PDFium and visually inspected; the bundled environment has PDFium rather than Poppler. Light/mobile and dark Activity evidence, end-of-history controls and the register were inspected. The register's secondary text token and intrinsic grid sizing were corrected; a browser color regression protects its readability. The print dialog positioning defect found during development was fixed and retested.
- Graphify refreshed locally: final reclustered map **8,299 nodes / 26,361 edges**. Four known parser warnings remain for guided-tours/productivity/work-templates public indexes and ProjectTaskRow. No forced smaller graph or hosted introspection.
- `git diff --check` passed. Existing line-ending conversion notices are not whitespace errors. The temporary local preview is stopped at handoff.

## Hosted gate and rollback

R11 is delivered for the local application/server-contract scope. The additive [R11 migration](../../supabase/migrations/20261008123723_r11_project_activity_snapshots.sql) is prepared and **not applied**. Complete Activity remains explicitly unavailable on an installation without it. Genuine hosted migration, RLS/session/transport, large-history latency, retention and printer acceptance remain open in the [acceptance checklist](acceptance-test-checklist.md).

The sole future hosted target is `ixnfphgjyelhckjwjkdv`. Follow the dated Phase 6.5 live addendum, preserve deployed migration timestamps, and use an isolated migration workspace populated from live history. Do not push the historical repository folder or repair live history to local names. Earlier R3/R6/R7/R8/R9 pending migrations and R8 genuine sender/mailbox gates remain unchanged.

Snapshots expire after one hour, with physical owner cleanup on the next fresh request. No scheduled cleanup or hosted performance certification is included. Printed/downloaded documents cannot be recalled after access changes. Global Admin audit still has its separate coverage contract and is owned by R12.

Rollback the R11 report presentation and Activity reader/print entry points deliberately while retaining original event, work, membership, evidence and financial data. If rolling back the additive server objects, stop their callers first and drop only R11 RPC/private snapshot/view objects after review. Never alter underlying source policies or historical migration timestamps. **R12 is the next implementation phase.**

## Evidence

- [Desktop Activity](r11-reports-activity-evidence/r11-activity-1440.png)
- [Mobile Activity](r11-reports-activity-evidence/r11-activity-390.png)
- [Last page and print controls at 390 px](r11-reports-activity-evidence/r11-activity-last-page-390.png)
- [Dark Activity and reachable print controls](r11-reports-activity-evidence/r11-activity-390-dark.png)
- [Filtered project register](r11-reports-activity-evidence/r11-register.png)
- [Complete 310-event PDF specimen](r11-reports-activity-evidence/r11-complete-history.pdf)
- [Rendered first page](r11-reports-activity-evidence/r11-print-1.png) and [rendered last page](r11-reports-activity-evidence/r11-print-15.png)
