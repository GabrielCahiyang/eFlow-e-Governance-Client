import { useEffect, useRef } from "react";
import { isNavigationLocked } from "./navigationLock";

type Guard = {
  dirty: boolean;
  pending?: boolean;
  pendingCheck?: () => boolean;
  label: string;
  identity?: string;
  onDiscard: () => void;
};
const guards = new Map<symbol, () => Guard>();
let confirmDiscard: ((labels: string[]) => Promise<boolean>) | undefined;
let deciding = false;
let guardRevision = 0;
export function installNavigationConfirmation(
  confirm: (labels: string[]) => Promise<boolean>,
) {
  confirmDiscard = confirm;
  return () => {
    if (confirmDiscard === confirm) confirmDiscard = undefined;
  };
}
export function hasDirtyNavigation() {
  return [...guards.values()].some((read) => read().dirty || read().pending);
}
/** Only registered dirty editors prompt. Inline autosave and ordinary navigation do not. */
export async function requestNavigation(action: () => void): Promise<boolean> {
  if (isNavigationLocked() || deciding) return false;
  const current = [...guards.entries()].map(([token, read]) => ({
    token,
    guard: read(),
  }));
  if (current.some(({ guard }) => guard.pending)) return false;
  const dirty = current.filter(({ guard }) => guard.dirty);
  if (!dirty.length) {
    action();
    return true;
  }
  if (!confirmDiscard) return false;
  deciding = true;
  const revision = guardRevision;
  try {
    const accepted = await confirmDiscard(
      dirty.map(({ guard }) => guard.label),
    );
    if (
      !accepted ||
      guardRevision !== revision ||
      isNavigationLocked() ||
      [...guards.values()].some((read) => read().pending)
    )
      return false;
    // Never apply an old reset callback to a different record after a live update.
    const latest = dirty.map(({ token, guard }) => ({
      before: guard,
      now: guards.get(token)?.(),
    }));
    if (
      latest.some(({ before, now }) => !now || now.identity !== before.identity)
    )
      return false;
    if (
      [...guards.entries()].some(
        ([token, read]) =>
          read().dirty && !dirty.some((entry) => entry.token === token),
      )
    )
      return false;
    latest.forEach(({ now }) => {
      if (now?.dirty) now.onDiscard();
    });
    action();
    return true;
  } finally {
    deciding = false;
  }
}
export function useNavigationBlocker(guard: Guard) {
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => {
    const token = Symbol("dirty editor");
    guards.set(token, () => ({
      ...latest.current,
      pending: latest.current.pending || latest.current.pendingCheck?.(),
    }));
    guardRevision++;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        latest.current.dirty ||
        latest.current.pending ||
        latest.current.pendingCheck?.()
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      guards.delete(token);
      guardRevision++;
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
}
