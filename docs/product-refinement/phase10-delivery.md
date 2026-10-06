# Phase 10 delivery

Implemented Project Workspace V2 on the existing checkout. Projects now share a consistent identity header with title, status, schedule, progress, participants and an actual readiness summary. Main table, Board, Gantt, Calendar, Project Dashboard and Offices are permanent views; all existing contextual tools and legacy view links remain reachable.

The header has synchronized personal favorites, a current-view share link, access explanations and a project menu. Settings edits existing metadata only, preserves failed drafts, validates dates and sends only changed fields. Lifecycle actions open the existing completion, archive/restore and deletion workflows. Dirty forms protect closing and navigation; pending requests prevent duplicate saves. Inline task/subtask autosave, the restored Create project button and first-column task actions remain intact.

No Phase 10 database, RLS, endpoint or public service contract changes. Existing Office authority and readiness/closeout rules remain authoritative. Phase 6.5 identity support and the G2 shared-project Task Lead staffing restriction are preserved.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed. |
| `npm test` | 667 tests in 173 files passed after the final logic changes. |
| `npm run build` | Passed; existing chunk size, circular-export and mixed-import warnings remain. |
| Configured Chromium | 32 cases passed across Phase 10, workspace controls, table, project views, Offices, readiness and Phase 9 navigation. Four focused Phase 10 cases also passed after the lifecycle focus correction; three layout cases passed after the settings textarea padding correction. These reruns overlap the 32 cases. |
| Responsive / keyboard | 1440, 768, 390 and 320px navigation coverage; settings dirty Back/Forward, Keep editing/Discard, menu/dialog focus return, long identity wrapping, portaled views and share dialog. Captured layouts visually reviewed. |
| Graphify | Updated locally: 7,065 nodes / 21,583 edges; six existing partial-parser warnings retained. No forced replacement. |
| Compatibility / whitespace | 18 canonical views and eight aliases mapped; no retired view. `git diff --check` passed. |

The browser suite exercises the live frontend on `http://127.0.0.1:5173` with synthetic backend/auth fixtures. Before/after screenshots are saved in the evidence package. This is frontend evidence, not a deployed RLS audit. No credential-backed authorization suite, native zoom or assistive-technology session was run.

An initial browser run passed 14/18. It exposed plain-object metadata errors, an unnamed title heading and stale strict selectors; those were corrected and the affected cases passed. A later explicit keyboard check found lifecycle-dialog focus returning to a removed menu item. The menu now closes before handing off to the existing parent-controlled dialog, and completion/deletion focus assertions pass. Final visual review corrected the description textarea's padding and border. Diagnostic receipts are retained separately from passing runs.

See the [project compatibility contract](phase10-project-contract.md), [view crosswalk](phase10-evidence/view-crosswalk.json), [source hashes](phase10-evidence/source-manifest.json) and [evidence manifest](phase10-evidence/evidence.json). Phase 10 evidence preserves its own before/after captures and receipts; earlier phase evidence is untouched.

Changes remain local to this checkout.
