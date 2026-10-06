import { useEffect, useRef, type DependencyList } from "react";
import type { NotificationNavigationIntent } from "../navigation";
import {
  completeNotificationNavigationIntent,
  peekNotificationNavigationIntent,
  subscribeToNotificationNavigationIntent,
} from "../navigationIntent";

/**
 * Applies a queued notification focus after its destination page mounts. The
 * handler returns false while its realtime data is still loading, preserving
 * the focus until the referenced record can be resolved.
 */
export function useNotificationNavigationIntent(
  matches: (intent: NotificationNavigationIntent) => boolean,
  handle: (intent: NotificationNavigationIntent) => boolean,
  dependencies: DependencyList,
): void {
  const matchesRef = useRef(matches);
  const handleRef = useRef(handle);
  matchesRef.current = matches;
  handleRef.current = handle;

  useEffect(() => {
    const apply = (intent: NotificationNavigationIntent) => {
      if (!matchesRef.current(intent)) return;
      if (handleRef.current(intent)) {
        completeNotificationNavigationIntent(intent.notificationId);
      }
    };

    const unsubscribe = subscribeToNotificationNavigationIntent(apply);
    const pending = peekNotificationNavigationIntent();
    if (pending) apply(pending);
    return unsubscribe;
    // The caller controls retries as its page data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
