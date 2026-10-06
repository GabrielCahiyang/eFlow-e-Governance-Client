# Token and compatibility CSS inventory

[tokens.json](inventory/tokens.json) records every CSS custom-property declaration in the scanned source, line, value and all source consumers containing `var(name...)`. It includes duplicates/overrides rather than hiding competing scopes. Utility classes and Vibe-generated styles are not custom-property consumers; the broader rules below must be reviewed separately.

| Source / selector family | Observed value / consumer scope | Risk and owner |
| --- | --- | --- |
| `styles/globals.css`, `:root` / `.dark` | Figtree Variable, base 14px; canvas #f4f7f7, foreground #182626, primary #0c6f6b, white cards, border #d7dfdf, radius .625rem; dark semantic counterparts | Phase 8B owns semantic source; preserve task-status meaning and financial severity |
| Global `@theme inline` mappings and base typography | Tailwind semantic names map to variables; broad text element styles | Review utility/runtime inherited font/line-height before migrating dense rows |
| `.eflow-app-shell .bg-white/.bg-neutral-*`, text/border neutral utilities with `!important` | Legacy dashboards, role screens, workflow primitives using literal neutral classes; remaps into semantic tokens | Ownership 8B; scan `components`, `features`, and consumer register before removing. Migrate one feature and compare all states |
| `.dark .bg-white/.bg-neutral-*`, border/text/input/select overrides | Literal slate/blue values compete with semantic dark palette and earlier shell overrides | 8B consolidate dark tokens incrementally; specificity/cascade and contrast need rendered tests |
| `::-webkit-scrollbar`, universal scrollbar-width/-ms-overflow-style | Global scrollbar suppression affects every page, table, panel and modal | Baseline defect A02; 8B/18 restore discoverable scrolling while preserving actual overflow regions |
| Vibe dialog/menu internals forced fixed and z-index 9999 in globals | Sticky project tables, shell, dropdown/popover/modal consumers; topbar/sidebar own layer rules | 8B/12 establish a tested layer scale; outside positioning/focus and nested confirmation must remain intact |
| Focus-visible rule with primary-color fallback; reduced-motion media query | Buttons, links, form fields, tabs and all shell animation/transition descendants | Existing focus/reduced-motion contract retained; computed visibility and contrast still need 18 tests |
| Mobile task rows, hidden table headers/team/priority/date | At <=767px grid changes and some columns hidden | 11/18 verify information remains discoverable in inspector; do not equate hiding data with responsive completion |
| `.eflow-full-view-mobile-dialog` and app-shell mobile navigation classes | 100dvh/100vw, border radius reset; viewport-specific navigation/modal layout | 8B/9/18 test safe-area, focus containment, close/return and narrow 320px |
| `projectTable.css`, `inlineCreateRow.css`, project view controls, Office/readiness CSS | Feature spacing, status colors, sticky first-column actions, portaled menus and primary fills | Keep established Create project padding, first-column actions and blur creation while moving values into shared tokens |
| `shared/motion/motionTokens.ts` | Non-CSS motion constants and consumers | Include in later token API; CSS custom-property scan does not inventory all JS motion constants |

Token freeze is a migration strategy: preserve current values as the baseline, establish semantic spacing/type/radius/focus/layer/state APIs in 8B, then replace literals by feature with visual comparisons. This audit does not prescribe all current overrides as the desired design system. Status label text must accompany colors. No automated WCAG contrast or screen-reader certification was performed in 8A.
