# Phase 11 delivery

Implemented Main Table V2 in the existing checkout. Task identity and first-column three-dot actions stay visible during horizontal scrolling. Bounded column resizing supports pointer and keyboard input, persists per project, and resets without losing hidden columns. Shared filters now have removable chips, clear-all, an owner-versus-contributor explanation and sort indicators; sorting never rewrites canonical manual order.

Focused cell editors show Saving, Saved and retained errors with scoped retry. Timeline editing preserves existing due times and offsets. Date/dependency and explicit creation forms protect dirty close/navigation and pending requests. Empty-group deletion explains blockers, confirms its impact and retains server denials. Refresh retries cannot recreate committed tasks/subitems or delete an already-deleted group again. Existing blur/Enter/Shift+Enter creation, sticky actions, Create project and board/table navigation remain intact.

Task team & contributors reuses the existing task drawer. Shared Task Lead team mutation remains gated by G2 with an accurate responsible-Office Head explanation; ordinary details inspection stays available. Existing Office eligibility, Lead protection, unfinished-subtask removal checks and Observer/Admin restrictions remain in force. Bulk/selection mutations are deferred because no approved eligibility/partial-success contract exists. Phase 12 owns the shared-inspector redesign.

No Phase 11 database, RLS, backend route, API payload or public service-return changes.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed after the final responsive changes. |
| Unit tests | 685 tests in 175 files passed after the final logic changes. Focused handoff tests also passed. |
| Production build | Passed; existing chunk-size, circular-export and mixed-import warnings remain. |
| Configured Chromium | 24 distinct cases passed across Phase 11, existing table/workspace controls, project views, Offices and Phase 10. The 24-case run passed 23; its mobile picker failure was corrected and passed with two overlapping layout/team cases. Four table/mobile smoke cases passed after that correction. These reruns overlap the 24 cases. |
| Live layout / keyboard | Port 5173, desktop and 390px captures; pointer/keyboard resize, persistence/hide/reset, sticky context, mobile picker hit testing, dirty Keep editing/Discard, owner confirmation and denied-save retry. Captured layouts visually reviewed. |
| Graphify | Updated locally: 7,111 nodes / 21,843 edges; six existing partial-parser warnings retained. No forced replacement. |
| Whitespace | `git diff --check` passed. |

Browser checks use the real frontend on `http://127.0.0.1:5173` with synthetic intercepted auth/REST/gateway/realtime responses. This is frontend evidence, not a deployed RLS audit. Native zoom and assistive-technology sessions were not run.

Diagnostic runs found duplicate dialog keys, menu/dialog focus handoff and an overly wide mobile sticky task column. The keys are unique, menus release focus before opening editors, and mobile task identity is capped at 180px with smaller planning controls and scroll padding. A browser fixture now waits for the appropriate desktop navigation instead of treating a not-yet-mounted sidebar as mobile navigation. A contention run exceeded its browser time budget while build/indexing/unit jobs competed for resources; the failed filter path passed in the subsequent isolated run. Diagnostic receipts are kept separately from passing reruns.

See the [table compatibility contract](phase11-table-contract.md), [source hashes](phase11-evidence/source-manifest.json) and [evidence manifest](phase11-evidence/evidence.json). This phase preserves its own baseline/final captures and receipts; earlier phase evidence is unchanged. Changes remain local and unpushed.
