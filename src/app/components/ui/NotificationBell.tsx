import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUpRight, Bell, CheckCheck, Maximize2, Minimize2, X } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type Notification,
} from "../../services/notificationService";
import {
  getNotificationDetail,
  queueNotificationNavigationIntent,
  resolveNotificationDestination,
  type NotificationDetailTone,
} from "../../features/notifications";

const formatNotificationTime = (value?: number) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DETAIL_TONE: Record<NotificationDetailTone, string> = {
  neutral: "border-border bg-muted text-foreground",
  info: "border-primary/20 bg-primary/10 text-primary",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-rose-100 bg-rose-50 text-rose-700",
};

export function NotificationBell({
  userId,
  role,
  onNavigate,
  className = "",
  compact = false,
}: {
  userId?: string;
  role?: string;
  onNavigate?: (section: string, page: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Free-form panel position/size ────────────────────────────────────
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>({
    w: 320,
    h: 440,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (isFullscreen) return;
      e.preventDefault();
      const pos = panelPos ?? { x: 80, y: 80 };
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        setPanelPos({
          x: dragState.current.origX + ev.clientX - dragState.current.startX,
          y: dragState.current.origY + ev.clientY - dragState.current.startY,
        });
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isFullscreen, panelPos],
  );

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      if (isFullscreen) return;
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: panelSize.w,
        origH: panelSize.h,
      };
      const onMove = (ev: MouseEvent) => {
        if (!resizeState.current) return;
        setPanelSize({
          w: Math.max(
            280,
            resizeState.current.origW + ev.clientX - resizeState.current.startX,
          ),
          h: Math.max(
            300,
            resizeState.current.origH + ev.clientY - resizeState.current.startY,
          ),
        });
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isFullscreen, panelSize],
  );

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(userId, setNotifications);
    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Seed initial panel position from button location on first open
  useEffect(() => {
    if (!open || panelPos !== null || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = rect.right > 0 ? rect.right + 12 : 80;
    const top = Math.max(8, rect.top - 350);
    setPanelPos({ x: left, y: top });
  }, [open, panelPos]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      setIsFullscreen(false);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const openNotification = useCallback(
    async (notification: Notification) => {
      const destination = role
        ? resolveNotificationDestination(notification, role)
        : null;

      if (!notification.read) {
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ));
        await markNotificationRead(userId || "", notification.id);
      }

      if (destination && onNavigate) {
        queueNotificationNavigationIntent(destination.intent);
        onNavigate(destination.section, destination.page);
        setOpen(false);
      }
    },
    [onNavigate, role, userId],
  );

  if (!userId) return null;

  const buttonSize = compact ? "size-10 min-w-10" : "h-9 w-9";

  const panelComputedStyle: React.CSSProperties = isFullscreen
    ? {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        borderRadius: 0,
      }
    : {
        position: "fixed",
        left: panelPos?.x ?? 80,
        top: panelPos?.y ?? 80,
        width: panelSize.w,
        height: panelSize.h,
        zIndex: 9999,
        minWidth: 280,
        minHeight: 300,
      };

  const panel = open
    ? ReactDOM.createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={panelComputedStyle}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          {/* Drag Handle Bar */}
          <div
            onMouseDown={startDrag}
            className="group flex h-4 shrink-0 cursor-grab select-none items-center justify-center border-b border-border bg-card active:cursor-grabbing"
            title="Drag to move"
          >
            <span className="h-0.5 w-6 rounded-full bg-muted-foreground opacity-30 transition-opacity group-hover:opacity-70" />
          </div>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Notifications
              </div>
              <div className="text-[11px] text-muted-foreground">
                {unreadCount} unread
              </div>
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead(userId)}
                  className="flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  title="Mark all read"
                >
                  <CheckCheck size={12} />
                  Read
                </button>
              )}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setIsFullscreen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                title={isFullscreen ? "Restore" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 size={12} />
                ) : (
                  <Maximize2 size={12} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => {
                const time = formatNotificationTime(notification.createdAt);
                const detail = getNotificationDetail(notification);
                const destination = role
                  ? resolveNotificationDestination(notification, role)
                  : null;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`block w-full border-b border-border px-3 py-3 text-left transition last:border-0 hover:bg-accent/70 focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring ${
                      notification.read ? "bg-card" : "bg-primary/10"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          notification.read ? "bg-border" : "bg-primary"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold text-foreground">
                          {notification.title || "Notification"}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                          {notification.message}
                        </span>
                        {detail && (
                          <span className={`mt-1 block rounded-lg border px-2 py-1 text-[10px] ${DETAIL_TONE[detail.tone]}`}>
                            <strong className="font-semibold">{detail.label}:</strong>{" "}
                            {detail.text}
                          </span>
                        )}
                        {time && (
                          <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span>{time}</span>
                            {destination && onNavigate && (
                              <span className="inline-flex items-center gap-1 font-medium text-primary">
                                {destination.label} <ArrowUpRight size={10} />
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Resize Handle Ball */}
          {!isFullscreen && (
            <div
              onMouseDown={startResize}
              className="absolute bottom-1.5 right-1.5 z-50 flex h-4 w-4 cursor-nwse-resize select-none items-center justify-center rounded-full bg-muted-foreground shadow transition-colors hover:bg-primary"
              title="Drag to resize"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="6" cy="6" r="1.2" fill="white" opacity="0.9" />
                <circle cx="3" cy="6" r="1.2" fill="white" opacity="0.6" />
                <circle cx="6" cy="3" r="1.2" fill="white" opacity="0.6" />
              </svg>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          className={`relative flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${buttonSize}`}
          title={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "No new notifications"
          }
        >
          <Bell size={compact ? 16 : 15} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
