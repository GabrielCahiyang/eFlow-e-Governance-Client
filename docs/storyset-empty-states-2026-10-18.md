# Animated Storyset empty states

This replaces the earlier unDraw rollout. Existing empty-state copy, actions, role visibility and centering remain in place.

| Situation | Drawing | Style | Animated parts |
| --- | --- | --- | --- |
| General empty collections | Empty | Bro | Boxes, hand truck |
| Search with no matches | Search | Rafiki | Speech bubbles |
| Inbox | Mail | Pana | Mailbox |
| Projects | Scrum board | Amico | Notes, gears |
| Assigned tasks and work | To do list | Cuate | Notebook, plant |
| Completed work / no pending reviews | Completed | Rafiki | Completed list |
| Documents and files | File bundle | Bro | Books |
| Messages and updates | Chat | Cuate | Emojis, plant |
| Members and teams | Good team | Pana | Speech bubble |
| Financial collections | Finance | Amico | Dollar, bills |

The ten source pages are listed in `public/illustrations/storyset/sources.json`. They were selected through the Storyset UI. SVG layer geometry comes from Storyset; the accent replacement, background removal and CSS animation are local modifications. Each of the five styles appears twice, with different concepts rather than five copies of the same drawing.

The shared `EmptyStateIllustration` serves the assets locally with no remote image requests, JavaScript in the SVG, new dependencies or application API changes. Meaning stays in the adjacent text, and images remain decorative. A single visible linked Storyset credit sits in the application footer when artwork is in use, rather than under every image. Free usage requires attribution under the [Storyset license terms](https://storyset.com/terms).

Following user feedback that the first motion pass was barely visible, layer motion now uses 26-unit floating, 17/21-unit drifting, a 0.97–1.13 scale pulse, or a ±5-degree sway over 2.4–3.3 seconds (gears rotate over 10 seconds). Swaying layers pivot from their base. Characters and backgrounds remain anchored. A `<picture>` source selects an animation-free `.still.svg` when the user requests reduced motion; SVG CSS also disables motion internally. The browser test checks both image selection and actual layer-transform changes.

The previous unDraw files were deleted. The dated unDraw rollout report remains historical evidence.

Validation:

- `npm run check` passed.
- `npm run build` passed, with the existing chunk-size and mixed-import warnings.
- `npm test -- tests/unit/illustratedEmptyStates.test.tsx`: 4 tests passed, including the reduced-motion source and removal of repeated image credits. Browser checks verify the single accessible footer credit, including multiple-image pages and hiding it when no artwork remains.
- 14 affected Chromium browser checks passed against the production build. These cover all four roles, all four My Work tabs, search recovery, dark mode at 375/768/1440 px, personal workspaces at 375/1918 px, all ten SVG layer animations, reduced-motion still selection, and the full-set image preview.
- Two production checks initially started before the preview server was listening (`ERR_CONNECTION_REFUSED`); both passed on rerun after server readiness. An earlier development-server run was interrupted because cold compilation delayed fixture loading.
- After increasing the motion and moving attribution into the footer, type checking, the production build, all 4 component tests and all 14 browser tests passed again. This latest browser run passed in one run, with no retries, including footer visibility, deduplication, centering and reduced-motion checks. The linked screenshots show this latest version.
- `git diff --check` passed. No unDraw references remain in application source or public assets. The full repository unit suite was not rerun for this presentation-only replacement; its previously recorded unrelated failures remain in the historical rollout report.

Visual evidence: [complete illustration set](ui-empty-states/2026-10-18/storyset/illustration-set.png) and [Head My Work](ui-empty-states/2026-10-18/storyset/head-my-work.png).

Subsequent user-requested styling sets the footer link to white in light mode and black in dark mode, at a 2px font size with 3px line height. This deliberately reduces its visibility and does not satisfy the free license's visible-attribution requirement. The screenshots above predate these changes.

## Avoid duplicate drawings within a page

The Office Budget overview originally passed the same `budget` illustration through a shared helper to all four cards. Each card now explicitly selects different artwork: Finance / Amico for commitments, To do list / Cuate for scheduled releases, Completed / Rafiki for no outstanding settlements, and File bundle / Bro for the financial activity record. The helper requires an illustration; there is no shared default. Choices stay stable when neighboring cards acquire records.

The same inspection corrected simultaneous repeated drawings in Project Overview, Project Dashboard, Project Insights, the citywide project/work-plan summary, team work/operations panels, and audit event changes/metadata panels. Separate tabs and mutually exclusive desktop/mobile renderings may use the same appropriate artwork; a random global counter is not used.

The budget overview regression renders all four empty cards, checks that their image sources and styles differ, and then fills the activity card to verify the other images stay unchanged. A production browser check verifies four loaded local images and desktop/mobile sizing.

The no-repeat correction passed type checking, the production build, five focused component tests, and the Office Budget desktop/mobile browser check. [Budget overview screenshot](ui-empty-states/2026-10-18/storyset/budget-overview-distinct-artwork.png).
