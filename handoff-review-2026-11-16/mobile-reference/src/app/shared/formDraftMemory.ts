import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDisplayCache } from "./displayCache";

const drafts = new Map<string, unknown>();

let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  subscribeDisplayCache((reason) => {
    if (reason === "identity") drafts.clear();
  });
}

export function formDraftKey(
  actorId: string | null | undefined,
  scope: string,
): string {
  return `${actorId || "anon"}:${scope}`;
}

export function readFormDraft<T>(key: string): T | undefined {
  ensureSubscribed();
  return drafts.get(key) as T | undefined;
}

export function writeFormDraft<T>(key: string, value: T): void {
  ensureSubscribed();
  drafts.set(key, value);
}

export function clearFormDraft(key: string): void {
  ensureSubscribed();
  drafts.delete(key);
}

export function clearFormDraftPrefix(prefix: string): void {
  ensureSubscribed();
  for (const key of Array.from(drafts.keys())) {
    if (key.startsWith(prefix)) drafts.delete(key);
  }
}

export function clearAllFormDrafts(): void {
  ensureSubscribed();
  drafts.clear();
}

export function useRetainedDraft<T extends Record<string, unknown>>(
  key: string,
  active: boolean,
  getInitial: () => T,
  { restoreOnOpen = true }: { restoreOnOpen?: boolean } = {},
): readonly [
  T,
  (updater: Partial<T> | ((current: T) => T)) => void,
  () => void,
] {
  const getInitialRef = useRef(getInitial);
  getInitialRef.current = getInitial;
  const keyRef = useRef(key);
  keyRef.current = key;
  const activeRef = useRef(active);
  activeRef.current = active;
  const restoreRef = useRef(restoreOnOpen);
  restoreRef.current = restoreOnOpen;

  const [state, setState] = useState<T>(
    () => (restoreOnOpen ? readFormDraft<T>(key) : undefined) ?? getInitialRef.current(),
  );

  const prevActive = useRef(active);
  const prevKey = useRef(key);
  useEffect(() => {
    const keyChanged = prevKey.current !== key;
    const justOpened = !prevActive.current && active;
    prevKey.current = key;
    prevActive.current = active;
    if (keyChanged || justOpened) {
      setState((restoreRef.current ? readFormDraft<T>(key) : undefined) ?? getInitialRef.current());
    }
  }, [key, active]);

  const updateDraft = useCallback(
    (updater: Partial<T> | ((current: T) => T)) => {
      setState((current) => {
        const next =
          typeof updater === "function" ? updater(current) : { ...current, ...updater };
        if (activeRef.current) writeFormDraft(keyRef.current, next);
        return next;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    clearFormDraft(keyRef.current);
    setState(getInitialRef.current());
  }, []);

  const opening = prevKey.current !== key || (!prevActive.current && active);
  const visibleState = opening
    ? (restoreRef.current ? readFormDraft<T>(key) : undefined) ?? getInitialRef.current()
    : state;
  return [visibleState, updateDraft, clearDraft] as const;
}
