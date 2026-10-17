# Head landing page and loading states

## Account switching

Explicit logout returns normal application routes to sign-in at `/`. Invitation, activation and share links retain their intended return paths. A signed-in account claims its browser history entries using its identity and role. Foreign account routes and workspace query parameters are cleared before workspace hooks mount. Back/forward navigation applies the same ownership check.

A Head restoring an unsupported Admin support URL lands on their home dashboard. Individual account-support permissions still allow an explicitly authorized Head to use those pages. Reloading the same account's authorized project link preserves the project and view. All existing page and database authorization checks remain in place; history metadata only controls navigation presentation.

## Useful office summary

The Head's own office overview now uses Monday Vibe headings, buttons, progress bars and skeletons, with the existing scoped workspace feed and task inspector.

| Information | Why a Head needs it |
| --- | --- |
| Active projects | Open a project directly and see delivery across the office. |
| Open tasks | See the amount of unfinished work without counting parent tasks and their subitems twice. |
| Overdue tasks | Identify follow-up work, including tasks whose optional due time has passed today. |
| Awaiting review | Find work waiting for its reviewer's decision. Opening the task retains the existing reviewer permissions. |
| Project progress | See completed root tasks out of the actual task total, plus overdue and review counts. Projects without tasks do not claim measurable completion. |
| Due next 7 days / Needs a lead | Plan near-term work and identify tasks that need staffing. |
| Recent task updates | See task status and reported completion, then open the task for its full progress report. Only changes in the past seven days appear. |
| Open reports | Reach existing office reports without navigating through unrelated tools. |

Incomplete feeds show a retry notice and unavailable totals rather than misleading zeros or partial completion percentages. Personal and shared-office overviews retain their existing behavior. The existing Office insights destination remains available below the new dashboard.

## Loading presentation

The static HTML boot screen and React startup screen now use a white background independent of theme preference. They contain the eFlow wordmark with its spinning `o`, “Getting things ready,” and the progress track. Organization text, the extra loading sentence and the footer tagline have been removed.

Code-split views and initial workspace selection show the animated wordmark with a responsive content skeleton. Dashboard data loading uses Vibe skeletons. Reduced-motion preferences are honored.

## Verification

- 35 focused unit checks passed: actor landing, navigation/deep links, dashboard counts, optional due times, loading presentation and startup import boundaries.
- TypeScript, production build and client-secret verification passed. The existing large-chunk build warning remains.
- The local architectural graph was refreshed; its four existing parser limitations remain.
- All five production Chromium browser checks passed: account switching, restored unsupported Admin links, project drill-through, phone overflow, the deferred-view skeleton and the white boot screen with dark preference. Desktop, phone, boot and skeleton screenshots are retained under `.codex-tmp/head-home/browser-final/`.
- After the final account-support deep-link adjustment, both account-switch browser scenarios passed again against the rebuilt production bundle.
- The full run recorded **1,854 passed / 1,876 tests, with 22 failures**. Seventeen failing test names match the prior full-run receipt. That run started before the final navigation identity/query reset. All five newly differing failures passed in a separate **33-test, four-file rerun**, including the current navigation tests, collapsed readiness, notification subitem focus and project requirements. The complete suite is not claimed green; its original JSON receipt is `.codex-tmp/head-home/all-unit.json`.

No database schema, RLS, endpoint or service payload changes were needed.
