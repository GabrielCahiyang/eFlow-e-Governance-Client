# R5 — Compact task table and editing behavior

Implemented locally 8 October 2026 (Asia/Singapore) against the R0 contracts and existing R1–R4 working tree. This phase changes table presentation and editor behavior. Database schemas, RLS, Python routes, API payloads and public service return values are unchanged. No migration or hosted deployment was performed; the sole hosted target remains `ixnfphgjyelhckjwjkdv`.

## Delivered slices

| Slice | Result |
| --- | --- |
| Date save and focus | Timeline explicitly opts into `closeOnSuccess`; the popup closes after the awaited save succeeds and restores focus to its connected cell trigger. Failed and pending saves retain the popup/draft, prevent duplicate writes and continue blocking navigation. Start/end validation, dependency rules and the original deadline time/offset remain. Dependency and number editor behavior is unchanged. |
| Estimated hours | Headers, cell names, column controls/catalogue, collapsed and footer summaries, import review inputs/mobile labels and validation copy use Estimated hours. The `effort` column preference ID, `estimated_hours` patch, numeric bounds and existing values remain unchanged. |
| Compact defaults | Missing or malformed visibility records start with Task, Owner, Status, Due date and Priority. Explicit `[]` still means all optional fields visible; valid saved hidden arrays and bounded widths retain their meaning. New compact layouts use a 280 px Task column and 180 px Due date column. Saved widths, including widths-only records, take precedence. Existing project keys seed the R3 actor/workspace/project keys. Reset to compact defaults deliberately resets visibility and widths; Reset column widths still leaves visibility alone. Short tables retain their configured width and scroll within the workspace. |
| Add column | Every expanded group has a trailing `+` with Add column tooltip/name. Its searchable icon catalogue includes only the nine supported fields, disables and identifies visible fields, explains all-visible/no-match states and restores trigger focus after adding a field. Visibility shares the existing project layout across groups and the toolbar path. Timeline remains searchable as an alias for Due date. |
| Group headers and creation | Collapse, inline naming, color and guarded group operations remain. Counts include currently visible tasks and their loaded subitems; empty groups report zero. Task/subitem creation, blur and Shift+Enter behavior, retained failed drafts and authorized task actions remain. All table row spans include the trailing control column. |
| Preserved authority | The existing Head/Office/Task Lead, Observer and closed-project checks remain. Columns are presentation preferences and never grant mutation access. Owner appointment/team workflows retain their current implementation; R7's new picker/delegation remains scheduled for R7. |

## Verification

- `npm run check`: passed.
- `npm test`: **219 files / 889 tests passed** on the final source. The Windows invocation was `npm.cmd test -- --maxWorkers=2 --testTimeout=15000`; all assertions and separate performance gates remained unchanged. Regressions cover date-only save-close policy, pending/denied drafts, unchanged dependency/numeric behavior, malformed/absent/all-visible/partial preferences, widths-only compatibility, project/account/workspace isolation and explicit reset behavior.
- `npm run build`: passed. Existing static/dynamic import and large-chunk warnings remain; the separate Phase 18 performance gate is unchanged.
- Chromium: **20 cases passed in one final run** across `workspace-refinement-r5`, `phase11-main-table`, `phase3-project-table` and `project-workspace-controls`. The five R5 cases cover supported catalogue search/icons and keyboard/mouse selection, all-visible explanation, shared visibility/reload, desktop compact sizing, failed/network/pending date writes, single submit, saved date/time/offset/reload and focus, group title/color/counts/creation, empty groups, and 320/390 px light/dark layouts. Retained checks cover sticky task actions, resizing/alignment/width persistence, filtering/sorting, guarded task/group creation and deletion, blur/Shift+Enter creation, failed drafts, authorized owner appointment, shared Task Lead restrictions, Member/Observer/closed-project controls and project menus/view navigation. No cases were skipped.
- Browser regressions now wait for the lazy table to become visible after reload before asserting layout or read-only state. The historical Phase 3 creation assertion uses the retained Projects and proposals menu introduced by R2 rather than its retired sidebar entry.
- `npm run graph:update`: completed — **7,669 nodes / 24,448 final edges**. Reviewed limitations remain 39 unsupported-extension files and the same four parser warnings in `guided-tours/index.ts`, `productivity/index.ts`, `ProjectTaskRow.tsx` and `work-templates/index.ts`. Indexing remained local/code-only; no hosted introspection or forced smaller graph.
- `git diff --check`: passed.

## Visual evidence

Screenshots use synthetic records rendered by the production application shell. Desktop compact sizing and mobile catalogue layouts were visually inspected.

- [Compact desktop table](r5-table-evidence/r5-compact-desktop.png)
- [All-visible catalogue](r5-table-evidence/r5-all-visible-catalogue.png)
- [Pending date save](r5-table-evidence/r5-date-pending.png)
- [Group counts and expanded subitems](r5-table-evidence/r5-group-subitems.png)
- [320 px catalogue](r5-table-evidence/r5-catalogue-320.png)
- [390 px dark catalogue](r5-table-evidence/r5-catalogue-390.png)

## Acceptance boundary

Browser fixtures use synthetic authentication and intercepted backend calls. They establish local UI behavior rather than hosted RLS, real sessions or transport acceptance. The Phase 6.5 live addendum remains controlling; R3's additive migration is still unapplied. This receipt does not close the hosted checklist or the integrated R13 rollout.
