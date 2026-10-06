# Phase 8B — Design System Foundation delivery

Implemented locally on 2026-10-06. The existing Vibe/Radix/inspector adapters now share semantic tokens and overlay tiers. Projects controls and the Admin directory/create-edit dialogs are the representative migrations. Existing roles, navigation, eligible options, API payloads and data contracts remain intact.

## Delivered slices

1. **Canonical tokens:** Figtree/teal, light/dark semantic surfaces and feedback tones, spacing, corners, elevation, dimensions, density, focus, motion and layer metadata. Existing Tailwind/workspace aliases are retained. Supported Vibe theme aliases apply both to the scoped provider and body portals.
2. **Accessible controls:** ref-backed Button/IconButton, pending/disabled explanations, FormField label/description/error relationships, error styling, shared feedback/retry, and an accessible portaled toast stack. Wrapped compound controls keep their caller-owned IDs.
3. **Overlay behavior:** nested picker keys do not dismiss the parent inspector; locks release on close/unmount; exiting inspectors cannot steal focus. Programmatic dialog/confirmation cancellation restores the opener. Risk presentation accepts caller-provided impact, blockers and optional exact typed confirmation. React context carries confirmation picker layers through portals.
4. **Workspace/table composition:** preserved tabs, split actions, inline editors and generic table APIs; optional table density/error/retry/sticky action cells, a toolbar without search, and embedded control keystrokes isolated from row activation.
5. **Representative migration:** Projects toolbar/view/neutral table surfaces use tokens with visible table/subitem scrollbars and mobile hit areas. Admin actions use shared buttons and compact tables; create/edit/delete retain drafts/errors and prevent repeated pending operations. Authority/last-Admin/self-account protection remains unchanged.
6. **Contract and ledger:** [Foundation contract](foundation-contract.md) documents APIs, tiers, caller responsibilities, compatibility exceptions and later migrations.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 638 tests passed in 170 files |
| `npm run build` | Passed; existing circular-export, static/dynamic import and large-chunk warnings remain |
| `npm run verify:client-secrets` | Passed |
| Foundation + Admin + Projects Playwright | 21 passed against the running app at `http://127.0.0.1:5173` |
| Final 320px smoke after compound-control guard | 2 passed; recorded separately in evidence receipts |
| `git diff --check` | Passed |
| `npm run graph:update` | Completed, local code-only graph refreshed: 6,982 nodes; six existing partial-extraction parser warnings and 28 unsupported-extension skips reviewed |

The browser suite comprises `design-system-foundation.spec.ts`, `foundation-admin-directory.spec.ts`, `project-workspace-controls.spec.ts`, `phase3-project-table.spec.ts` and `phase4-project-views.spec.ts`. Backend/auth responses are synthetic and intercepted; browser UI uses the actual running Vite application. Compound foundation adapters have a test-only HTML entry, excluded from the production build. These checks are not deployed database/RLS evidence.

Covered paths include light/dark/system appearance, semantic text contrast at least 4.5:1, keyboard tabs/menus, disabled reasons, visible scroll affordances, 1440/768/390/320 dimensions, a DPR-2 720×500 CSS viewport equivalent to a 1440×1000 display at 200% zoom, nested picker hit testing in inspector/modal/confirmation, cancellation without mutation, pending saves, retained failed drafts, retry, focus return and lock release. Native browser zoom UI and assistive-technology announcements were not independently certified.

Projects regressions retain Add view, board/table/filter return, New task split actions, Create project, first-column three-dot menus after horizontal scrolling, task/subitem blur and Shift+Enter creation, failure retention and Member structural restrictions. Admin regressions check protected self/last-Admin actions, cancellation with no delete call, associated validation errors, one pending create request, retained failed entries and teal portaled save controls.

## Evidence and visual review

[Screenshot manifest](phase8b-evidence/screenshots.json) records 41 PNGs (approximately 3.8 MB), scenario, dimensions and SHA-256. [Source hashes](phase8b-evidence/sources.json) identify the 28 production foundation/migration files. Receipts are in `phase8b-evidence/receipts/`. Phase 8A's inventory and screenshot baseline are unchanged.

Visual review included Projects desktop/mobile, Admin form at 320px, and confirmation over an inspector. It caught the Vibe portal's default blue fill and a narrow feedback body; both were corrected and verified. The mobile Add view screenshot now captures the viewport without resizing it while the popover is open; full-page capture had dismissed the popover during automation.

Example captures:

- [Projects desktop](phase8b-evidence/screenshots/project-controls-desktop.png)
- [Projects mobile](phase8b-evidence/screenshots/project-controls-mobile.png)
- [Admin form at 320px](phase8b-evidence/screenshots/admin-form-320.png)
- [Inspector confirmation](phase8b-evidence/screenshots/confirmation-inspector.png)
- [Zoom-equivalent dialog](phase8b-evidence/screenshots/foundation-zoom-equivalent-200.png)

## Boundaries and remaining gates

Broad neutral remapping and global scrollbar compatibility remain for unmigrated screens. Projects group/status/priority palettes, role badge/workload presentation, PDS review, and other Administration surfaces are recorded exceptions. The global Vibe fixed-position/z-index 9999 override is removed; Vibe owns positioning and its popup wrapper uses the shared layer token.

Phase 8A A01/A03/A04/A09 and Phase 6.5 G2 remain separately scoped. This phase changes no database schema/RLS, gateway routes, service returns, permission defaults, workspace storage or staffing authority. Credential-dependent navigation and deployed authority rehearsals are not counted as passing fixture tests. Existing Phase 6.5 work and the user's other local edits were preserved. No commit, push or deployment was performed for Phase 8B.
