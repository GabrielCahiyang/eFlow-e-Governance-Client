# R4 — Project header, Overview and retained workflows

Implemented locally 8 October 2026 (Asia/Singapore) against the R0 scope contracts and the existing R1–R3 working tree. This phase changes project presentation and navigation. Database schemas, RLS, Python routes, API payloads and public service return values are unchanged. No migration or hosted deployment was performed; the sole hosted target remains `ixnfphgjyelhckjwjkdv`.

## Delivered slices

| Slice | Result |
| --- | --- |
| Compact header | Removed the entire Project Offices/Readiness strip and explanatory sentence. Project identity, inline naming, lifecycle/schedule labels, closed-project notice and existing utilities remain. Offices are reachable through the permanent Offices view and Project actions. |
| Participant identity | Already authorized profiles appear as avatars with private signed URLs, initials on missing/failed images, keyboard-accessible Vibe name tooltips and an overflow list. A screen-reader summary retains joined-Office/contributor counts. Loading, empty, failed collaboration reads and unresolved Office identity retain useful states and retry actions. Avatar reads discard late account/project responses. |
| Project Overview | Purpose, progress, overdue/upcoming work, responsible people, delivery activities, attention and recent activity use existing project data and R1 semantic tokens. Both legacy `deadline` and current `dueDate` are honored; relative labels remain unscheduled instead of becoming invalid calendar dates. Task links use the authorized inspector. |
| View retirement | Removed Workload & Team, Readiness & closeout, Approval Status, Evidence Register and Decision History from catalogs, tab/overflow/Add view controls and render branches. Stored retired IDs are filtered; current preferences are scoped to actor/workspace/project. Deep links canonicalize with replacement history while retaining project scope and inspector parameters. Members remains R7 work. |
| Completion availability | Header and sidebar actions share one fail-closed eligibility calculation with visible loading/error/blocker reasons. View completion requirements remains enabled when Complete is disabled. Direct modal access requires an active Head, obtains a fresh authoritative snapshot and rejects foreign/malformed results. Mutation denial retains the note and refreshes blockers; duplicate clicks cannot issue a second in-flight completion. The unchanged server RPC remains authoritative. |
| Retained prerequisites | The completion dialog embeds required structural/date/budget reviews and confirmed activation. Resolution links lead to Main table, Gantt, Offices, Budget Overview or Proposal Context. Governed projects retain proposal approval/closeout; evidence and task approval remain in authorized review/inspectors; audit history remains in Activity. Members/observers can inspect plan reviews through compact Project settings without Head mutation controls. Archive, restore, deletion impact and dirty/pending navigation protection remain. |
| Dialog handoff | Retained creation actions wait for the menu to release its pointer/focus locks before opening a dialog. Project creation explicitly returns focus to its opener. The mobile regression verifies that task actions remain clickable after canceling creation. |

Retired URL compatibility:

| Old identifier | Retained view |
| --- | --- |
| `readiness` | `overview` |
| `workload`, `team`, `people`, `signoff` | `offices` |
| `evidence` | `reviews` |
| `decisions` | `activity` |

Redirects confer no authority. Legacy modules with remaining compatibility/test consumers were retained without runtime view branches; no records, evidence or audit history were deleted.

## Verification

- `npm run check`: passed.
- `npm test`: **219 files / 882 tests passed**. Focused regressions cover shared completion eligibility, account/project late responses, malformed/foreign snapshots, denied direct modal access, blocked requirements, retained structural review, stored/URL aliases, private avatar fallback/overflow and calendar work.
- `npm run build`: passed. Existing static/dynamic import and large-chunk warnings remain; the separate Phase 18 performance gate is unchanged.
- Focused R4 Chromium: **5 cases passed**, including 320, 390 and 1440 px, keyboard names, stored retired views, reload/history, Head review while completion is blocked, stale server rejection, retry, single completion write and archive availability.
- Chromium regression: **53 distinct cases have passing evidence** across `navigation-v2`, R2–R4 refinement, Phase 6/6.5 Offices, Phase 7 readiness/staffing, Phase 10 project utilities, Phase 15 governance and project workspace controls. The combined run passed 49; four obsolete pre-R2 entry selectors were corrected and their cases passed focused retests. The mobile retest also exposed the menu/dialog pointer-lock and focus-return defect described above; the final three-case desktop/mobile creation and proposal-menu run passed after its fix. No cases were skipped. Existing Office handover/invitations, named-Office linking, plan activation, read-only Members, cash/proposal resolution, private profile retry, settings/history and personal workspace isolation remain covered.
- `npm run graph:update`: completed — **7,663 nodes / 24,425 final edges**. Reviewed limitations: 39 unsupported-extension files skipped and the same four parser warnings in `guided-tours/index.ts`, `productivity/index.ts`, `ProjectTaskRow.tsx` and `work-templates/index.ts`. Indexing remained local/code-only; no forced smaller graph or hosted introspection.
- `git diff --check`: passed.

## Visual evidence and acceptance boundary

Synthetic records rendered from the production shell; desktop and 320 px layouts and the completion dialog were visually inspected:

- [320 px Overview](r4-project-evidence/r4-overview-320.png)
- [390 px Overview](r4-project-evidence/r4-overview-390.png)
- [1440 px Overview](r4-project-evidence/r4-overview-1440.png)
- [Retained completion requirements](r4-project-evidence/r4-completion-requirements.png)
- [390 px plan reviews and activation](r4-project-evidence/r4-reviews-mobile.png)

Browser fixtures intercept backend calls and use synthetic authentication. They verify UI contracts, not hosted RLS, genuine session refresh, email or file transport. The Phase 6.5 live addendum remains controlling; R3's pending migration is still unapplied. This delivery does not mark the hosted acceptance checklist or integrated R13 rollout complete.
