# R11 reports and Activity contract

Implemented locally 8 October 2026. The additive [Activity migration](../../supabase/migrations/20261008123723_r11_project_activity_snapshots.sql) depends on the existing Office workflow and R3/R7/R9 history/access contracts. It is prepared, not applied. Existing event tables, workflow commands, financial rules, routes and role permissions remain authoritative.

## Entry points and retained ownership

| Surface / entry | Owner | Shared foundation and retained generic controls |
| --- | --- | --- |
| Project Reports, optional Reports view and project tools inspector | `features/projects` | WorkspaceHeader, WorkspaceTabs, buttons, skeleton, scoped filters, financial cards and scrollable execution register. Receipt/evidence actions still use their existing signed-URL services; Vibe file buttons and schedule labels remain owned here. |
| Project Activity, optional Activity view and project tools inspector | `features/projects/activity` | Shared header, native labelled filters, StatusPill, paging, error/retry and Radix print dialog. Public `ProjectActivityHistory` is also mounted lazily from personal project Activity. |
| Head Reports, Office tools > Reports and legacy Reports route | `features/reports` | All seven lenses, library rail, filters, metrics, expandable DepartmentReportTable, task inspector, AI report context and CSV/PDF actions remain. Existing chart and export primitives stay owned by Reports; shared tokens replace light-only table colors. |
| Shared `ReportsWorkspace` compatibility export | `features/reports`, implementation under `components/workflow` | Four status/productivity/workload/overdue lenses, charts and exact filtered exports retained. Shared tabs now own their actual panels. Repository search found the public export but no current canonical route caller; no new Admin-wide report destination is introduced. |
| Member Work Report, retained contextual My Work tools and Work Report aliases | `features/members` | Shared header/skeleton, existing period selector, metrics, dense table and filtered export remain. Checked task reads expose error/retry. |
| Office Budget > Expenses | `features/budget` | Shared header/filters/table/loading/error, existing proposal/person/month selection, all twelve CSV fields and receipt actions retained. Print builds a separate filtered report document. BudgetCard/BudgetEmpty and financial badges remain Budget-owned. |
| `role-head/legacy/LeaderExpenseReports` | Legacy Head compatibility owner | Only its legacy barrel references this mock-data component; no canonical route caller was found. Kept as historical compatibility code, excluded from genuine report acceptance. Retirement requires a separate consumer audit. |
| Global Admin audit and Admin configuration | R12 / `features/audit` and `features/administration` | Global latest-500 audit coverage is independent of project Activity. This phase makes no claim to complete global history or effective Admin settings. |

Navigation aliases, role guards, Office appointments, report export checks and private storage authority are preserved. Project tool task links use the existing task inspector. Personal Activity does not invoke Office financial readers. Remaining generic controls above have an explicit feature owner; their data contracts are not moved into shared UI.

## Report completeness and financial meaning

Task/project feeds, workflow facts, audit preview reads and Office budget report queries exhaust real server ranges using exact counts and stable ordering. ID-filtered reads are batched in groups of 100; source pages request 500 and advance by the actual returned length, so a smaller server row ceiling does not silently truncate a report. Count changes, premature empty pages and failed reads surface errors. Public service result shapes remain unchanged; task/project hooks expose additive checked error/retry fields.

Report reads are live reads, not transactional snapshots. A changing exact count fails loading and requires retry. The stronger frozen-membership guarantee below applies specifically to complete Activity and its print workflow.

Project filters select **whole task families**: any matching authorized root or descendant selects that root and all its visible descendants. Search, Office, status and deadline range are shown in screen and export metadata. Recursive paths and sibling order preserve nested hierarchy; missing ancestors are labelled. Root funding pools contribute once to totals; child caps, shared pools, reservations, actual spent, returned balance and remaining balance retain the existing cash-position selector semantics. CSV/PDF use the same rows and totals as the filtered screen. All loaded evidence and receipt links are rendered, with no first-three clipping.

Unknown workflow or financial facts withhold affected metrics and exports. Financial facts outside the loaded Office budget scope are unavailable; filtering to a verified Office enables its register. A successfully verified empty budget is distinct from a failed or malformed summary. No read failure becomes a fabricated zero. Existing optional legacy-schema handling in Budget remains unchanged and does not authorize new mutations.

## Server Activity contract

`public.r11_project_activity` is a **security-invoker** JSON RPC. Its merged view is also security-invoker. Existing source RLS decides which events can be read; no elevated history reader or new role grant is introduced. Anonymous execution is revoked. Current authorized Office or personal project read is required on every request.

Inputs: project UUID, optional snapshot UUID, zero-based page, size 25/50/100, kind `all/project/status/progress/submission`, literal case-insensitive search (maximum 500 characters), inclusive UTC lower date bound and exclusive UTC upper date bound. Calendar date inputs are converted using the selected workspace timezone, including 23/25-hour DST days. Invalid bounds and page parameters fail explicitly.

Output: snapshot ID, as-of and expiry instants, clamped page, size, exact matching total, `more`, and ordered events. The JSON object avoids the Data API's array row ceiling. The browser verifies counts, IDs, timestamps, page shape and snapshot identity before publishing a page.

| Source | Stable identity |
| --- | --- |
| Project/task/milestone audit | `audit:<id>` |
| Task status history | `status:<id>` |
| Task / subtask progress | `progress:task:<id>` / `progress:subtask:<id>` |
| Task / subtask submission | `submission:task:<id>` / `submission:subtask:<id>` |
| Task / subtask decision | `decision:task:<id>` / `decision:subtask:<id>` |
| R7 delegated work events | `work:<id>` |
| R3 personal work events | `personal:<id>` |

Distinct source facts are retained, including equal UUIDs in different tables and separate submission/decision facts. No title/time heuristic discards potentially different events. Source IDs provide deterministic ties: occurred timestamp descending, then event ID descending under PostgreSQL `C` collation. The projection excludes storage paths and raw before/after membership snapshots.

The first request captures both matching event membership and values in an owner-only, one-hour snapshot in the **non-exposed** `eflow_r11` schema. Subsequent pages preserve that order/count even if new or backdated events arrive or a submission decision changes. Refresh creates a new snapshot. Filters, actor/workspace/project scope and size changes reset the UI to page one; page bounds clamp on the server. Search requests debounce by 250 ms and stale responses are ignored.

Snapshot RLS restricts reads/writes to the requesting actor. Every later RPC revalidates project access and the current visibility of every captured source ID. Deleted or now-hidden sources invalidate the whole snapshot. Expiry and changed filters also fail explicitly. The browser revalidates on focus and every 15 seconds, clears unavailable history, and starts fresh on access-change events. No persistent history subscription is added. Prepared print previews clear on relevant filter/scope/page/access/error/expiry changes. Already saved or printed documents cannot be recalled.

Expired snapshots are physically pruned for the owner when a new snapshot is created; expiration denies reads immediately even if no new request runs cleanup. There is no scheduled retention job in this phase. Hosted retention and large-history query/materialization cost remain operator/R13 acceptance items.

## Print and failure behavior

The default scope is **all matching authorized events in the current snapshot**. Current page is an explicit alternative. Preparation revalidates and fetches every selected server page, checks the frozen count and duplicate IDs, and publishes a document only after the complete scope succeeds. A later-page error exposes failure and produces no partial preview. Missing RPC deployment explains that the reviewed R11 migration is required; it does not fall back to slicing the legacy local preview.

The isolated print document includes project, workspace, scope, type/search/date filters, snapshot time, generated time, workspace timezone, printed/matching counts and stable source event IDs. Timestamps use that same timezone. Table headers repeat and CSS page counters appear on each printed page. App navigation is excluded. Radix manages focus, Escape and dialog controls; the user invokes Print / Save PDF from the completed preview.

The additive migration must be reviewed and applied to the sole hosted target `ixnfphgjyelhckjwjkdv` from an isolated workspace populated from live migration history, preserving deployed timestamps. Do not push the historical repository migration directory or repair live history. Genuine hosted RLS, transport, representative-volume, retention and browser-print acceptance remain open in the [acceptance checklist](acceptance-test-checklist.md).
