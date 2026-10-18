# Account Audit in-page details — 18 October 2026

Implements **Stage A** of `eFlow_UIUX_Inspector_And_Page_Review_2026-10-17.md`. Account Audit's Inspect action now opens a responsive detail subview inside Admin Center, using the existing eFlow/Vibe visual language. The other inspectors remain separate future slices as recommended by the review.

## Interaction and security contract

- Entry: Admin Center → Account Audit → Inspect. Header contains an actionable breadcrumb, Back to Account Audit, human-readable event action, read-only status, resource, copyable reference and Refresh audit.
- Overview shows the recorded actor, Philippine event time, resource, Office and note. Changed fields provides full before/after values, two columns when there is room and a stacked comparison on narrower content areas. Technical details displays redacted original metadata. Missing notes, changes, metadata, actors or references have explicit fallback states.
- The existing `buildDiff`, `orderAuditDiff`, humanization, `redactAuditDisplay` and `presentAuditValue` utilities are unchanged. Structured arrays additionally expose their **redacted** readable JSON rather than only `[object Object]`. Copy operations use the redacted presentation values.
- Selection is an ID resolved against the **current permitted window**, never a cached event object. Refresh/realtime invalidation hides detail data until the current read verifies it. Removed events, failed reads and access changes show an unavailable state with Back and retry. Account/role/Office changes remount the window; page-permission removal unmounts it immediately.
- The existing `navigation.audit` UI permission and backend/RLS read boundary remain. No arbitrary event-by-ID read, endpoint, audit write, schema or permission-policy change was added. The query still loads at most 500 permitted records with the existing authorized total.
- **Routing choice: local detail state.** Opening details does not add an `auditEvent` URL parameter or history entry. Reload returns to the list; no permanent deep-link promise is made. In-session Back preserves all list filter state, mounted DataTable sorting, actual ancestor/table scroll positions and Inspect-trigger focus. If the row disappeared, focus returns to search.
- Page open focuses its heading. Native hidden state removes the mounted list from keyboard/accessibility navigation. The page does not portal, lock body scrolling, set the application inert or trap focus. Existing short dialogs and shared inspector infrastructure are unchanged.

## File-by-file changes

The [scoped unified diff](ui-audit-detail/2026-10-18/implementation.patch) includes only this UI slice, excluding the earlier validation work already present in the working tree.

| File | Change |
| --- | --- |
| `components/ui/workspace/RecordDetailPage.tsx`, `recordDetailPage.css`, workspace `index.ts` | Domain-neutral in-page shell with guarded Back/breadcrumb navigation, heading focus, responsive actions and readable tab sizing. No data fetching or RBAC in the shell. |
| `components/ui/DataTable.tsx` | Added `scope="col"` to column headers; real-browser checks exposed missing header semantics. Existing table state and behavior remain. |
| `features/audit/components/AdminAuditLog.tsx` | Actor-scoped audit window; mounted/hidden list; current-event resolution and inline detail selection. |
| `features/audit/hooks/useAuditDetailNavigation.ts` | Captures/restores actual scroll containers and trigger/search focus without owning filters or sort state. |
| `features/audit/hooks/useAdministrativeAuditWindow.ts` | Added current-read checking state, preserving the existing revision/race guards, query and failure handling. |
| `features/audit/components/AuditEventDetailContent.tsx` | Presentation-neutral summary, note, diff and redacted technical content. |
| `features/audit/components/AuditEventDetailPage.tsx`, `features/audit/auditDetailPage.css` | Overview/Changed fields/Technical details, readable cards/comparisons, empty and unavailable states, dark-theme tokens and container-aware layout. |
| `features/audit/components/AuditCopyButton.tsx` | Exact reference copying with success/failure feedback. |
| `features/audit/components/AuditDetailDrawer.tsx` | Removed after source/test search verified that AdminAuditLog was its only application caller; no remaining import/consumer. Shared `InspectorPanel` is untouched. |
| `tests/unit/auditDetailPage.test.tsx` | Seven interactions covering state/focus preservation, long values, recursive redaction, copy references, empty/unknown data, refreshed reads, missing events and account/permission changes. |
| `tests/e2e/audit-detail-page.spec.ts`, `fixtures/auditDetails.ts` | Synthetic browser fixtures and acceptance tests across widths, keyboard controls, read failure, reload, scroll restoration, zoom and dark/reduced-motion presentation. |
| `tests/e2e/phase16-support-finance.spec.ts` | Updated the existing audit acceptance case to the new page/tab/Back interaction; preserved bounded-read and nested-redaction assertions. |

Paths in the table are relative to `src/app/` unless they begin with `tests/`.

## Visual evidence

Screenshots use synthetic people/events, with the same sample data before and after. These are actual browser captures, not mockups. Desktop/tab screenshots capture the application viewport; content scrolls within the existing workspace.

| View | Before | After |
| --- | --- | --- |
| Desktop, 1440px | [Side drawer](ui-audit-detail/2026-10-18/before-desktop.png) | [Overview](ui-audit-detail/2026-10-18/after-desktop.png), [comparison](ui-audit-detail/2026-10-18/after-desktop-changes.png) |
| Tablet, 768px | [Side drawer](ui-audit-detail/2026-10-18/before-tablet.png) | [Stacked comparison](ui-audit-detail/2026-10-18/after-tablet-changes.png) |
| Phone, 375px | [Side drawer](ui-audit-detail/2026-10-18/before-mobile.png) | [Overview](ui-audit-detail/2026-10-18/after-mobile.png), [stacked comparison](ui-audit-detail/2026-10-18/after-mobile-changes.png) |

## Verification

- `npm run check`: passed.
- `npm run build`: passed; existing large-chunk warning remains.
- `npm run verify:client-secrets`: passed.
- Focused audit regression suite: **15 tests passed**, including the existing bounded-read, presentation and refresh-race tests.
- Chromium production-preview acceptance: **9 passed**. Widths 320/375/768/1024/1440; real Inspect/Back/reload; sort, search, scroll and focus preservation; long changes; redaction; empty/missing events; forbidden reads; zero audit writes; no unscoped ID fetch; keyboard arrows/Home/End; dark mode, reduced motion and 200% CSS zoom.
- Firefox and WebKit production-preview acceptance: **2 passed**, covering the desktop detail, comparison, redaction, keyboard tabs and Back/focus flow. This does not certify native Safari or React Native.
- Visual review inspected before/after desktop and phone captures, comparison layouts and the dark zoom capture. No page-wide horizontal overflow was found at tested widths. Container rules account for the sidebar's reduction of available content width.
- `axe-core` is not installed. Semantic/keyboard browser checks were performed; a dedicated screen-reader audit and a native browser-zoom accessibility certification are not claimed. The zoom test explicitly uses CSS zoom.
- Local graph refresh retains the four existing parser limitations (guided-tours, productivity, ProjectTaskRow, work-templates); source files and browser results are the acceptance evidence.
- Full unit run: **1,909 passed / 20 failed / 1,929 total**. All audit tests passed. Nineteen failures match the prior navigation/support, staffing-label, reviewer and notification failures recorded before this slice. One unrelated advisory-appointment case exceeded its five-second test limit (5.76 seconds); its isolated four-test rerun passed without an application or test change. The overall suite is therefore **not a green release gate**; no claim of fixing those pre-existing workflows is made.
- Local logs/traces and the complete screenshot set are in `.codex-tmp/audit-detail/`. Temporary preview/dev servers used for this verification were stopped afterward.

## Next incremental slices

1. Resolved by the user's subsequent cleanup request: retire the duplicate Leading view and obsolete sidebar manifests, retaining the active My Work → Leading page and its notification entrances. See [cleanup details](retired-navigation-cleanup-2026-10-18.md). The older view is not a new screen to redesign.
2. Move Project Tools into project workspace tabs; separately convert Project Office detail after testing team/invitation permissions.
3. Give journal entries and the accounting trail full-width subviews while preserving posted-entry immutability and financial actions. Review member/profile and announcement inspectors afterward based on actual active usage.

These are proposals for subsequent slices, not claims that the other domains were migrated or their business workflows re-certified by this pilot.
