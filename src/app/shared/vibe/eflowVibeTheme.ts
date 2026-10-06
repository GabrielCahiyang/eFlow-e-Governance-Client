// Vibe's supported color surface aliases the same tokens as native/Radix controls.
const colors = {
  "primary-color": "var(--eflow-primary)",
  "primary-hover-color": "var(--eflow-primary-hover)",
  "primary-selected-color": "var(--eflow-selected)",
  "primary-selected-hover-color": "var(--eflow-selected-hover)",
  "primary-selected-on-secondary-color": "var(--eflow-selected)",
  "text-color-on-primary": "var(--eflow-on-primary)",
  "brand-color": "var(--eflow-primary)",
  "brand-hover-color": "var(--eflow-primary-hover)",
  "brand-selected-color": "var(--eflow-selected)",
  "brand-selected-hover-color": "var(--eflow-selected-hover)",
  "text-color-on-brand": "var(--eflow-on-primary)",
  "primary-text-color": "var(--eflow-text)",
  "secondary-text-color": "var(--eflow-text-muted)",
  "primary-background-color": "var(--eflow-surface)",
  "secondary-background-color": "var(--eflow-subtle)",
  "ui-border-color": "var(--eflow-border)",
} as const;
export const eflowVibeTheme = { name: "eflow-vibe", colors: { light: colors, dark: colors } } as const;
