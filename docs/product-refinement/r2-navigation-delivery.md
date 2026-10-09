# R2 — Persistent workspace sidebar and navigation cleanup

Implemented locally on **7 October 2026 (Asia/Singapore)** against the R0 navigation contracts and the existing R1 working-tree foundation. This is a local implementation and regression receipt; hosted deployment and acceptance status are unchanged.

## Delivered slices

| Slice | Result |
| --- | --- |
| Workspace header | An explicit `<Office name> Workspace` selector replaces Current context and explanatory copy. It lists the current supported Office context only. Accounts without an Office do not get a fabricated workspace selector. Search workspace is a separately labeled action; overflow and the adjacent section `+` have distinct accessible names. Personal workspace creation remains gated by R3. |
| Persistent navigation | The shell renders Office tools, Favorites, Projects and Archived projects from its existing authorized navigation and loaded project records. The project tree no longer depends on a project controller portal. Office tools and Projects start expanded; destination highlighting and project selection do not change disclosure. The panel remains present on Tasks, Reports, My Work, Inbox and account/support pages where authorized. |
| Section and collapse controls | The adjacent `+` and overflow menu show/hide supported sections. Re-added sections append below existing sections; their records, favorite selections and disclosure choices remain intact. Desktop collapse retains the global rail and a labeled restore control. Mobile uses the same section choices in the accessible drawer. |
| Navigation retirement | Global Home and Search are removed from desktop and mobile discovery. Sidebar Planning, Drafts, Waiting for approval and Team Members are removed, including the standalone project-sidebar fallback. Office Team, Team Supervision, Identity & Access, project Offices and existing task/team inspectors retain their authorized workflows. |
| Retained project workflows | **Projects and proposals** in the project content toolbar retains authorized Create project, work plan creation, proposal import, templates, saved work plans and proposal review. Project lifecycle actions remain in the existing project header. Contextual `plans=saved` / `plans=review` URLs preserve refresh and Back/Forward, clear stale project selection, and use the existing dirty-navigation guard. Opening a proposal clears the old project URL so project restoration cannot immediately replace it. |
| Onboarding, landing and callers | The Make yourself at home / Getting Started progress banner is removed. Invitation acceptance, first-run dialogs, professional-profile completion and Help remain. Head lands at the existing Office summary presented as Workspace Overview; Member at My Work; Accounting at Accounting Overview; Admin at All Users. Old Home/Search/command URLs fall back to the role's registered landing. Existing task/project and invitation Office-view URLs remain supported. Guided-tour copy/targets follow the persistent panel; Accounting operational notification handoffs retain entity IDs, and Admin project notifications do not create an operational shortcut. |

## Preference and authorization boundaries

- Display preferences use a validated version-2 payload under `eflow:navigation:v1:<user>:<Office>:panel-v2`, retaining the existing logout cleanup namespace. Section order, disclosure and desktop collapse are scoped by user and Office. Supported legacy disclosures migrate; retired Planning/people identifiers are discarded.
- Existing user/Office favorite keys are preserved. Favorites are pruned against loaded authorized IDs only after project loading finishes, preventing refresh from deleting them during an empty loading state. No project titles or records are persisted in these preferences.
- The selector is an Office-context presentation control, not a new workspace membership or isolation model. R3 owns persisted personal workspaces and workspace switching. Existing shared inter-Office project access remains discoverable.
- Role discovery, direct-page permission checks, Head/Member/Accounting separation, dirty and pending-write navigation, existing Supabase/service contracts, invitation handling, evidence and financial workflows remain authoritative. No schema, RLS, migration, gateway/Python endpoint, public service return value or hosted configuration changes are part of R2.

## Verification

- `npm run check`: passed.
- `npm test`: passed — **216 files / 856 tests**, including 12 R2 interaction, preference, URL and notification regression cases. Existing navigation/sidebar/lifecycle assertions were updated for the explicitly requested R2 changes.
- `npm run build`: passed. The existing Vite static/dynamic import overlap and large-chunk warnings remain; this does not close the Phase 18 performance gate.
- Chromium: **20 distinct cases passed** in `navigation-v2.spec.ts` and `workspace-refinement-r2.spec.ts` — 14 existing navigation compatibility cases and six new R2 cases. Coverage includes all four role landings and authorized destinations, granted/denied support routes, shared observer project search/favorites, failed creation/retry/cancel, dirty Security and inline-task navigation, Back/Forward, logout cleanup, missing Office/project context, mobile focus return, and persistent sections at **320, 390, 768, 1024 and 1440 px**.
- The R2 matrix verifies Tasks/Reports transitions, independent Office-tools disclosure, show/hide/re-add ordering, retained favorite subitems, workspace search, collapse/restore/reload and contained page width. The saved-plan/review case verifies content-toolbar discovery, refresh, Back/Forward and removal of the progress banner.
- Browser verification exposed mobile drawer translation outside the viewport and a saved-plan context being replaced by stale project restoration. Both were fixed; the final complete 20-case run passed against stable application source. A subsequent six-case R2 run also passed with screenshots waiting for loaded task content and dismissing supplemental tooltip overlays.
- `npm run graph:update`: completed — **7,519 nodes**. Reviewed limitations: 37 unsupported-extension files skipped and the four existing parser warnings in `guided-tours/index.ts`, `productivity/index.ts`, `ProjectTaskRow.tsx` and `work-templates/index.ts`. No forced smaller graph or live database indexing.
- `git diff --check`: passed.

The browser fixtures use synthetic records and intercept backend requests. These results establish local navigation regression evidence, not hosted RLS, delivery, production scale or Firefox/WebKit acceptance. Existing live Phase 6.5 and performance gates remain open. R3 personal workspaces, R7 Members and R10 My Work/Overview redesign retain their owning phases.

## Retained visual evidence

Representative synthetic records, rendered from the production shell:

- [320 px mobile drawer](r2-navigation-evidence/r2-sidebar-320.png)
- [390 px mobile drawer](r2-navigation-evidence/r2-sidebar-390.png)
- [768 px mobile drawer](r2-navigation-evidence/r2-sidebar-768.png)
- [1024 px persistent panel](r2-navigation-evidence/r2-sidebar-1024.png)
- [1440 px persistent panel](r2-navigation-evidence/r2-sidebar-1440.png)
