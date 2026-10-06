# eFlow UI foundation — Phase 8B

The foundation consolidates the installed Vibe and Radix adapters. Feature controllers still own eligibility, authority, validation, dirty state, drafts, retries and mutations. No database, RLS, gateway, theme persistence or service return contract changes belong to this phase.

## Tokens and theme

`src/styles/foundation-tokens.css` is the source of semantic values. `default_theme.css` maps Tailwind names; `workspace-foundation.css` consumes workspace aliases; `eflowVibeTheme.ts` maps supported Vibe color names to the same CSS variables. Existing semantic and `--workspace-*` names remain available. The existing UserPreferencesProvider retains light/dark/system state, persistence and rollback on save failure. The Vibe provider retains its body theme classes for portals.

| Contract | Tokens / policy |
| --- | --- |
| Identity | Figtree Variable, 14px root; `--eflow-primary`, `--eflow-primary-hover`, `--eflow-on-primary` |
| Surfaces | canvas, surface, subtle, selected, border; text, secondary and muted text |
| Feedback | positive/warning/negative/info background + text pairs, and danger/on-danger |
| Spacing | space-1/2/3/4/5/6/8: 4/8/12/16/20/24/32px |
| Corners / elevation | radius-sm/control/surface/dialog and shadow-surface/popover/dialog |
| Controls | 40px standard; 32px compact; 44px mobile actions and icons |
| Tables | 20px horizontal cell padding; 12px comfortable or 8px compact vertical padding |
| Focus | 2px visible ring, 2px offset, primary color; text/error associations |
| Responsive | compact 640px, navigation 768px, wide 1024px; CSS media queries use literal bounds |
| Motion | CSS fast/enter/navigation 100/150/250ms, reduced-motion zero; existing shared JS motion tokens/provider remain the animation API |

CSS breakpoint variables document boundaries and cannot be substituted into CSS media queries. JS animation durations remain in `shared/motion/motionTokens.ts`; migrate existing consumers through that module rather than copying numbers into feature controllers. Task lifecycle colors, labels and descriptions remain feature-owned by `taskStatusPresentation.ts`. Generic positive/negative tones do not create new task statuses or transitions.

## Overlay tiers

| Tier | Value | Owner |
| --- | ---: | --- |
| Sticky content | 20 | Table surface; local cell stacks can use smaller values within their own stacking context |
| Navigation | 40 | Existing workspace/navigation composition |
| Inspector | 200 | InspectorPanel; legacy `layer=50/60` maps to offsets 0/10 |
| Modal | 300 | Vibe Modal and Radix dialog/sheet; content adds one |
| Picker/menu | 400 | Radix/Vibe portaled pickers and menus |
| Confirmation | 500 | Alert overlay; content adds one |
| Confirmation picker | 510 | React context carries this tier across DOM portals |
| Toast | 600 | Existing ToastProvider portals a live region to body |

Vibe Modal's numeric `zIndex` prop reads the CSS modal token, with a 300 fallback for unstyled test/SSR environments. Vibe owns popup positioning. The former global forced fixed position and z-index 9999 rules are removed. One Vibe wrapper class bridges its popup to the shared layer token; it does not override positioning.

Radix continues to own its focus scopes, portaling and dismissal. FeatureDialog captures the opener when opened programmatically. InspectorPanel owns its existing application inert/body overflow lock, ignores nested portal keys, keeps nested inspector locks until the last closes, disables focus into exit-animation nodes and restores focus after nested scope cleanup. Closing a nested confirmation preserves its parent's draft and returns focus to the invoking control. Unmount cancels outstanding confirmation decisions.

## Supported adapter APIs and states

| Adapter | Compatible additions / usage |
| --- | --- |
| Button / IconButton | Existing variants, sizes and `asChild`; forwarded refs for Radix triggers; `pending`, `disabledReason`; IconButton requires a label. Caller supplies pending text and mutation state. |
| FormField | Existing label/error/required/children; optional `controlId`, `description`. A single control receives an ID and merged aria-describedby/invalid/required. Compound children must pass an explicit control ID and wire their own description/error IDs. |
| TextInput / SelectInput | Existing native attributes/options; error styling follows `hasError` or aria-invalid. Validation stays with the feature. |
| FeedbackState | info/success/warning/error, title/body, optional `onRetry` and `pending`; error uses alert, other feedback uses status. Retry invokes the supplied feature operation. |
| DataTable | Existing search/sort/row activation/loading/empty/count/toolbar; optional density, accessible region name, error/retry and `Column.action` sticky right cells. Toolbar works without search. Embedded controls own their keyboard/click actions. |
| ActionMenu | Existing actions; optional disabledReason shown with the unavailable item. Options and authority come from the caller. |
| Modal / ModalButton | Existing compatibility APIs; preventClose remains caller controlled, ModalButton adds pending and retains an accessible name while loading. |
| FeatureDialog / InspectorPanel | Optional preventClose blocks dismissal during caller-owned operations; no universal dirty guard is inferred. |
| useConfirmation | Existing Promise<boolean> decision API; optional impact, blocker list, exact confirmationText. Cancellation does not start a service call. Acceptance resolves before mutation. |
| ToastProvider | Existing toast(message,type) API; visible above overlays, live announcements, four-second lifetime and dismiss action. No undo is presented without a real inverse operation. |
| Workspace adapters | Keep existing header/tabs/popover/split action/inline text/avatar/status/skeleton/empty APIs and public workspace index. |

For destructive async actions, a feature awaits a decision, then owns its pending guard and error/retry state. Do not place async side effects in useConfirmation or automatically retry mutations. Admin create/edit/delete are representative consumers: pending prevents duplicate operations, closing is blocked while saving, errors remain visible and drafts remain available for explicit retry. Existing partial-success account creation/leadership messages remain intact.

Inline task/subitem creation keeps its existing no-Add-button, blur/Enter/Shift+Enter and failure retention behavior. Autosaved fields do not gain a discard prompt. A picker receives already eligible records and handlers; this foundation does not recalculate Office/Person authority.

## Migration ledger and retained exceptions

| Surface | Phase 8B migration | Later work |
| --- | --- | --- |
| Shared semantic theme | One CSS value source, Vibe/Tailwind/workspace aliases | Retire aliases only after all consumers migrate |
| Shared controls / overlays | Form associations, pending/disabled descriptions, risk content, overlay tier and focus contracts | Migrate feature-owned raw dialogs and direct popups individually |
| Projects | Table/toolbar/view picker/board return neutral and brand values use tokens; visible table/subitem scrollbars and sticky first-column actions | Remaining domain group/status/priority/avatar palette, illustration, compact feature details and feature-owned Office styles remain intentional/recorded exceptions |
| Admin directory / create-edit dialogs | Shared action buttons, compact DataTable with action cells, tokenized primary/neutral controls, accessible validation and retained failure drafts | Role badge colors, workload Vibe semantics, PDS import review and other Administration tabs retain their feature styles |
| Navigation / dashboards / legacy role screens | Existing aliases remain | Broad neutral remapping and global scrollbar suppression still cover unmigrated consumers; remove only in their own verified slices |
| Notifications/chat | No dismissal redesign | Phase 8A A09 remains a later feature-owned overlay migration |
| Navigation/Settings | No route/default/role changes | A01 support-tab mismatch, A03 broader dirty-navigation policy and A04 Settings URL state remain separately scoped |
| Project staffing | No authority change | G2 Task Lead / responsible Office Head staffing mismatch remains a separately reviewed correction |

Scoped scrollbars are visible in migrated tables, subitem tables and shared scroll regions. Do not remove global compatibility scrollbar or neutral rules before verifying remaining consumers. No workspace tree or new Person/Office eligibility store is introduced: Phase 8A did not freeze a new tree content model. Production adapters remain small direct modules and existing public indexes; test-only foundation HTML/TSX is served by Vite for regression checks and is absent from the production bundle.

## Regression and rollback

Unit checks cover form names/descriptions/errors, ref-backed controls, confirmation cancellation/phrase/blockers, pending interaction, table action isolation, theme persistence rollback and inspector portal/lock cleanup. Browser tests exercise the actual local Vite application with synthetic intercepted backend records plus isolated compound production adapters. Viewport screenshots use 1440/768/390/320; semantic foreground/background pairs meet 4.5:1 in both themes. Menu tests include hit testing, keyboard selection, cancellation and focus return.

Keep Phase 8A evidence frozen. Phase 8B receipts and screenshots belong to their own evidence folder. Credential-dependent navigation and deployed authority rehearsals are separate gates and are not implied by fixture UI tests. Roll back an adapter or feature migration by reverting that slice; no data rollback is required.
