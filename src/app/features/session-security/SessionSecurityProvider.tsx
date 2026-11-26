import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getSessionSecurityPolicy,
  subscribeRuntimeSystemSettings,
} from "../../shared/systemRuntimeConfig";
import {
  SESSION_ACTIVITY_WRITE_THROTTLE_MS,
  SESSION_CHANNEL_PREFIX,
  SESSION_NOTICE_KEY,
} from "./constants";
import { InactivityWarningDialog } from "./components/InactivityWarningDialog";
import { clearLogoutNotice, writeLogoutNotice } from "./services/logoutNotice";
import {
  clearBrowserSessionActivity,
  getSessionActivityStorageKey,
} from "./services/sessionActivityStorage";
import { getInactivityState, isMeaningfulKeyboardEvent, readActivityTimestamp } from "./services/sessionTimeline";

type SessionMessage =
  | { type: "activity"; at: number }
  | { type: "logout"; at: number; reason: "inactivity" | "manual_warning" };

function readTabActivityTimestamp(storageKey: string, fallback: number): number {
  try {
    return readActivityTimestamp(window.sessionStorage.getItem(storageKey), fallback);
  } catch {
    return fallback;
  }
}

function writeTabActivityTimestamp(storageKey: string, at: number): void {
  try {
    window.sessionStorage.setItem(storageKey, String(at));
  } catch {
    // Ignore restricted storage environments
  }
}

function wasPageDiscardedByBrowser(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded);
}

export function SessionSecurityProvider({
  children,
  timeoutMs,
  warningLeadMs,
}: {
  children: ReactNode;
  timeoutMs?: number;
  warningLeadMs?: number;
}) {
  const { user, logout } = useAuth();
  const userId = user?.id;
  const storageKey = userId ? getSessionActivityStorageKey(userId) : "";

  const [runtimePolicy, setRuntimePolicy] = useState(getSessionSecurityPolicy);

  useEffect(() => {
    setRuntimePolicy(getSessionSecurityPolicy());
    return subscribeRuntimeSystemSettings(() => {
      setRuntimePolicy(getSessionSecurityPolicy());
    });
  }, []);

  const effectiveTimeoutMs = timeoutMs ?? runtimePolicy.timeoutMs;
  const effectiveWarningLeadMs = warningLeadMs ?? runtimePolicy.warningLeadMs;
  const effectiveTimeoutMinutes = Math.max(1, Math.round(effectiveTimeoutMs / 60_000));

  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const initializedUserRef = useRef<string | null>(null);
  const trailingWriteRef = useRef<number | undefined>(undefined);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const logoutStartedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(effectiveTimeoutMs);
  const [warningOpen, setWarningOpen] = useState(false);
  const warningOpenRef = useRef(false);
  warningOpenRef.current = warningOpen;

  const publishActivity = useCallback((at: number) => {
    if (!storageKey) return;
    lastWriteRef.current = at;
    writeTabActivityTimestamp(storageKey, at);
    channelRef.current?.postMessage({ type: "activity", at } satisfies SessionMessage);
  }, [storageKey]);

  const recordActivity = useCallback((force = false) => {
    if (!userId || logoutStartedRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    setWarningOpen(false);
    setRemainingMs(effectiveTimeoutMs);
    window.clearTimeout(trailingWriteRef.current);
    if (force || now - lastWriteRef.current >= SESSION_ACTIVITY_WRITE_THROTTLE_MS) {
      publishActivity(now);
      return;
    }
    trailingWriteRef.current = window.setTimeout(
      () => publishActivity(lastActivityRef.current),
      SESSION_ACTIVITY_WRITE_THROTTLE_MS - (now - lastWriteRef.current),
    );
  }, [effectiveTimeoutMs, publishActivity, userId]);

  const expireForInactivity = useCallback(async () => {
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;
    window.clearTimeout(trailingWriteRef.current);
    clearBrowserSessionActivity(userId);
    writeLogoutNotice({
      reason: "inactivity",
      timeoutMinutes: effectiveTimeoutMinutes,
    });
    channelRef.current?.postMessage({
      type: "logout",
      at: Date.now(),
      reason: "inactivity",
    } satisfies SessionMessage);
    await logout({ preserveNotice: true });
  }, [effectiveTimeoutMinutes, logout, userId]);

  const signOutFromWarning = useCallback(async () => {
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;
    window.clearTimeout(trailingWriteRef.current);
    clearBrowserSessionActivity(userId);
    clearLogoutNotice();
    channelRef.current?.postMessage({
      type: "logout",
      at: Date.now(),
      reason: "manual_warning",
    } satisfies SessionMessage);
    await logout({ silent: true });
  }, [logout, userId]);

  const signOutFromRemoteTab = useCallback(async () => {
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;
    window.clearTimeout(trailingWriteRef.current);
    clearBrowserSessionActivity(userId);
    await logout({ preserveNotice: true });
  }, [logout, userId]);

  useEffect(() => {
    if (!userId || !storageKey) {
      initializedUserRef.current = null;
      return;
    }
    logoutStartedRef.current = false;

    if (initializedUserRef.current !== userId) {
      initializedUserRef.current = userId;
      const now = Date.now();
      // Remove any legacy persistent localStorage timestamps so reopening the site
      // after closing the browser never immediately logs the user out as AFK.
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore restricted storage environments
      }
      // Only resume a prior tab timestamp when the browser discarded & auto-reloaded
      // an already-open idle tab; fresh page opens always start an active AFK timer from now.
      const initialActivity = wasPageDiscardedByBrowser()
        ? readTabActivityTimestamp(storageKey, now)
        : now;
      lastActivityRef.current = initialActivity;
      lastWriteRef.current = initialActivity;
      writeTabActivityTimestamp(storageKey, initialActivity);
    }

    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel(`${SESSION_CHANNEL_PREFIX}:${userId}`);
      channelRef.current.onmessage = (event: MessageEvent<SessionMessage>) => {
        const message = event.data;
        if (message?.type === "activity" && message.at > lastActivityRef.current) {
          lastActivityRef.current = message.at;
          writeTabActivityTimestamp(storageKey, message.at);
          setWarningOpen(false);
        }
        if (message?.type === "logout") void signOutFromRemoteTab();
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_NOTICE_KEY && event.newValue) void signOutFromRemoteTab();
    };
    const onPointer = (event: PointerEvent) => { if (event.isTrusted && !warningOpenRef.current) recordActivity(); };
    const onTouch = (event: TouchEvent) => { if (event.isTrusted && !warningOpenRef.current) recordActivity(); };
    const onKeyboard = (event: KeyboardEvent) => { if (event.isTrusted && !warningOpenRef.current && isMeaningfulKeyboardEvent(event)) recordActivity(); };
    const onNavigation = (event: PopStateEvent) => { if (event.isTrusted) recordActivity(); };
    const check = () => {
      const state = getInactivityState(
        lastActivityRef.current,
        Date.now(),
        effectiveTimeoutMs,
        effectiveWarningLeadMs,
      );
      setRemainingMs(state.remainingMs);
      setWarningOpen(state.phase === "warning");
      if (state.phase === "expired") void expireForInactivity();
    };
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    window.addEventListener("touchstart", onTouch, { capture: true, passive: true });
    window.addEventListener("keydown", onKeyboard, { capture: true });
    window.addEventListener("popstate", onNavigation);
    document.addEventListener("visibilitychange", onVisibility);
    const ticker = window.setInterval(check, 1000);
    check();

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(trailingWriteRef.current);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pointerdown", onPointer, { capture: true });
      window.removeEventListener("touchstart", onTouch, { capture: true });
      window.removeEventListener("keydown", onKeyboard, { capture: true });
      window.removeEventListener("popstate", onNavigation);
      document.removeEventListener("visibilitychange", onVisibility);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [
    effectiveTimeoutMs,
    effectiveWarningLeadMs,
    expireForInactivity,
    publishActivity,
    recordActivity,
    signOutFromRemoteTab,
    storageKey,
    userId,
  ]);

  return (
    <>
      {children}
      {warningOpen && (
        <InactivityWarningDialog
          remainingMs={remainingMs}
          warningLeadMs={effectiveWarningLeadMs}
          timeoutMinutes={effectiveTimeoutMinutes}
          onStaySignedIn={() => recordActivity(true)}
          onSignOut={() => void signOutFromWarning()}
        />
      )}
    </>
  );
}
