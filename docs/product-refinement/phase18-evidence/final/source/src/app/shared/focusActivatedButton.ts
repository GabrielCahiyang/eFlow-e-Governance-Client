/** Capture the opener before a activation-triggered dialog moves keyboard focus. */
export function focusActivatedButton(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const button = target.closest('button, [role="button"]');
  if (
    !(button instanceof HTMLElement) ||
    button.matches(':disabled, [aria-disabled="true"]') ||
    button.closest("[inert]")
  )
    return;
  button.focus({ preventScroll: true });
}
