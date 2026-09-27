# eFlow design-system adoption report

## Scope

This implementation applies the Figma file's **eFlow/Vibe UI Kit** foundation
to the shared application shell, reusable controls, overlays, and the legacy
Tailwind surface utilities used throughout role workspaces. It is a visual
system rollout only: workflows and access behavior are unchanged.

## What changed

### Shared tokens

- Set the Figma light foundation exactly: `#F4F7F7` canvas, `#182626` primary
  text, `#526161` secondary text, `#778484` metadata, `#D7DFDF` borders,
  `#0C6F6B` primary, `#D9F0ED` selected, and the documented semantic colors.
- Kept the Figma typography, 4px spacing rhythm, 6px control radius, 10px
  card radius, 14px panel radius, and 2px focus-ring treatment in reusable
  tokens and component defaults.
- Kept `default_theme.css` and `globals.css` synchronized because both provide
  the Tailwind semantic-token contract.
- Added a neutral-utility compatibility layer under the app shell. Existing
  role pages using `bg-white`, neutral text/borders, and card radii now inherit
  the Figma surfaces and hierarchy without a risky page-by-page behavior rewrite.

### Application shell

- Updated the persistent shell to the documented 56px top bar, 68px compact
  rail, 240px expanded sidebar, Figma navigation palette, 14px panels, and
  XS/medium elevation treatment.
- Preserved every route destination, active-state rule, sidebar grouping,
  mobile navigation behavior, account menu, notification flow, and role guard.

### Shared UI components

- **Buttons, inputs, selects, textareas, checkboxes, radios, switches, toggles,
  tabs, labels, and alerts:** aligned default product density to 40px controls
  (32px dense variants), Figma focus styling, semantic states, and 120ms
  feedback.
- **Cards and metrics:** applied 10px cards, 20px inset spacing, Figma text
  hierarchy, semantic metric colors, and XS elevation.
- **Data table:** moved its container, toolbar, header, row hover, keyboard
  focus, loading, and footer to the canonical table treatment. Existing
  sorting, filtering, row activation, keyboard activation, and ARIA table
  semantics are unchanged.
- **Dialogs and confirmations:** standard dialogs are 640px desktop panels,
  destructive confirmations are 480px, both use 14px panels and mobile
  full-viewport behavior. Existing close semantics are retained.
- **Toasts and notifications:** aligned semantic feedback, elevation, focus,
  and the Figma four-second toast lifetime. Notification controls retain their
  existing accessible labels and navigation behavior.

## Intentionally unchanged

- Sidebar destinations, role visibility, permissions, and navigation state.
- Supabase calls, service APIs, database schema, RLS, backend routes, and
  payloads.
- Feature-specific layout and task, project, review, budget, and
  administration workflows; their visual primitives now inherit the shared
  foundation where they use shared or neutral utility styles.
- Status-specific success, warning, and danger colors, so their meaning
  remains distinct from the eFlow primary-action color.

## Verification

- `npm run check`
- `npx vitest run tests/unit/sharedUiVibeAdapters.test.tsx --maxWorkers=1 --minWorkers=1 --reporter=verbose`
- `npx vitest run tests/unit/phase02AppShell.test.tsx --maxWorkers=1 --minWorkers=1 --reporter=verbose`
- `npm run build`

All listed checks pass. The full test command was started but did not finish in
the desktop command window; the focused adapter and app-shell suites cover the
shared surfaces changed here. The production build still reports pre-existing
Rollup circular-chunk and large-chunk warnings; they are outside this visual
scope and were not changed.
