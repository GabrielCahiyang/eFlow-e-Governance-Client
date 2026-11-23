import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { EmptyState } from "./EmptyState";
import { BoundedTextInput } from "./BoundedInput";
import {
  LiveNotificationBanners,
  type LiveNotificationBannerItem,
} from "./LiveNotificationBanners";
import "./notificationBell.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { usePanelDismissal } from "../../shared/usePanelDismissal";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Maximize2,
  Minimize2,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  markAllNotificationsRead,
  markRecentNotificationRead,
  subscribeToNotifications,
  type Notification,
} from "../../services/notificationService";
import {
  getNotificationDetail,
  queueNotificationNavigationIntent,
  resolveNotificationDestination,
} from "../../features/notifications";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPeriod,
} from "../../features/notifications/inboxFilters";
import {
  ensureNotificationAudioUnlocked,
  playNotificationChime,
} from "../../features/notifications/notificationSound";
import {
  filterNotificationsLocally,
  formatNotificationExactManila,
  formatNotificationRelativeTime,
  getNotificationVisual,
  groupNotificationsByManilaDate,
  ICON_TONE_CLASSES,
  isUrgentNotification,
} from "../../features/notifications/visuals";
import {
  PERSONAL_SETTINGS_CHANGED_EVENT,
  readPersonalSettings,
  savePersonalSettings,
} from "../../features/settings/personalSettingsStore";
import { FeedbackState } from "./FeedbackState";
import { useToast } from "./Toast";

type NotificationFilterTab = "all" | "unread";

const DEFAULT_PANEL_WIDTH = 420;
const DEFAULT_PANEL_HEIGHT = 520;
const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 340;
const MAX_VISIBLE_BANNERS = 3;
const TITLE_BADGE_RE = /^\(\d+\+?\)\s*/;

function computeAnchoredPosition(
  trigger: HTMLButtonElement | null,
  width: number,
  height: number,
): { x: number; y: number } {
  const margin = 12;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  const rect = trigger?.getBoundingClientRect();

  if (rect && (rect.right > 0 || rect.bottom > 0)) {
    return {
      x: Math.max(margin, Math.min(rect.right - width, maxX)),
      y: Math.max(margin, Math.min(rect.bottom + 8, maxY)),
    };
  }

  return { x: maxX, y: Math.min(56, maxY) };
}

export function NotificationBell({
  userId,
  role,
  onNavigate,
  className = "",
  compact = false,
  alignToInbox = false,
  active = false,
}: {
  userId?: string;
  role?: string;
  onNavigate?: (section: string, page: string) => void | Promise<boolean | void>;
  className?: string;
  compact?: boolean;
  alignToInbox?: boolean;
  active?: boolean;
}) {
  const unreadHintId = React.useId();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [delivery, setDelivery] = useState<{
    unreadCount: number | null;
    error: string;
    loading: boolean;
  }>({ unreadCount: null, error: "", loading: true });
  const [readError, setReadError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [ringing, setRinging] = useState(false);
  const [liveBanners, setLiveBanners] = useState<LiveNotificationBannerItem[]>([]);
  const [soundPrefs, setSoundPrefs] = useState(() => readPersonalSettings(userId));
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const recipientRef = useRef(userId);
  recipientRef.current = userId;
  const roleRef = useRef(role);
  roleRef.current = role;
  const soundPrefsRef = useRef(soundPrefs);
  soundPrefsRef.current = soundPrefs;
  const ringTimerRef = useRef<number | undefined>(undefined);

  const [filterTab, setFilterTab] = useState<NotificationFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>("all");
  const [periodFilter, setPeriodFilter] = useState<NotificationPeriod>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_PANEL_WIDTH, h: DEFAULT_PANEL_HEIGHT });
  const [pos, setPos] = useState({ x: 16, y: 56 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const openNotificationRef = useRef<(notification: Notification) => Promise<void>>(async () => {});

  useEffect(() => {
    ensureNotificationAudioUnlocked();
    setSoundPrefs(readPersonalSettings(userId));
    const syncPrefs = () => setSoundPrefs(readPersonalSettings(userId));
    window.addEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, syncPrefs);
    return () => window.removeEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, syncPrefs);
  }, [userId]);

  const toggleSoundMuted = useCallback(() => {
    const nextEnabled = !soundPrefsRef.current.notificationSoundEnabled;
    const saved = savePersonalSettings(userId, { notificationSoundEnabled: nextEnabled });
    setSoundPrefs(saved);
    if (nextEnabled) {
      playNotificationChime("normal", {
        volume: saved.notificationSoundVolume,
        force: true,
      });
    }
  }, [userId]);

  const dismissBanner = useCallback((key: string) => {
    setLiveBanners((prev) => prev.filter((item) => item.key !== key));
  }, []);

  useEffect(() => {
    setNotifications([]);
    setLiveBanners([]);
    setDelivery({ unreadCount: null, error: "", loading: Boolean(userId) });
    setReadError("");
    setMarkingAll(false);
    setMarkingId(null);
    if (!userId) {
      return;
    }
    let previousIds: Set<string> | null = null;
    return subscribeToNotifications(
      userId,
      (rows) => {
        const newUnread = previousIds
          ? rows.filter((row) => !row.read && !previousIds!.has(row.id))
          : [];
        previousIds = new Set(rows.map((row) => row.id));
        setNotifications(rows);

        if (newUnread.length > 0) {
          const hasUrgent = newUnread.some((item) => isUrgentNotification(item.type));
          const prefs = soundPrefsRef.current;

          // Subtle bell ring feedback
          setRinging(true);
          if (ringTimerRef.current !== undefined) window.clearTimeout(ringTimerRef.current);
          ringTimerRef.current = window.setTimeout(() => setRinging(false), 750);

          // Synthesized bell chime (coalesced automatically across rapid bursts)
          if (prefs.notificationSoundEnabled) {
            playNotificationChime(hasUrgent ? "urgent" : "normal", {
              enabled: true,
              volume: prefs.notificationSoundVolume,
            });
          }

          if (document.visibilityState !== "hidden") {
            const batchNow = Date.now();
            setLiveBanners((prev) => {
              if (newUnread.length > MAX_VISIBLE_BANNERS) {
                const labels = Array.from(
                  new Set(newUnread.map((item) => getNotificationVisual(item.type).categoryLabel)),
                ).slice(0, 3);
                const summary: LiveNotificationBannerItem = {
                  kind: "batch",
                  key: `batch-${batchNow}-${newUnread.length}`,
                  count: newUnread.length,
                  categoriesSummary: `${labels.join(", ")}${labels.length < newUnread.length ? " and more" : ""}. Open Notifications to review.`,
                  urgent: hasUrgent,
                  createdAt: newUnread[0].createdAt || batchNow,
                };
                return [summary, ...prev].slice(0, MAX_VISIBLE_BANNERS);
              }

              const incoming: LiveNotificationBannerItem[] = newUnread.map((item) => {
                const dest = roleRef.current
                  ? resolveNotificationDestination(item, roleRef.current)
                  : null;
                return {
                  kind: "single",
                  key: `single-${item.id}`,
                  notification: item,
                  actionLabel: dest?.label || "Open",
                };
              });
              const existingKeys = new Set(prev.map((b) => b.key));
              const fresh = incoming.filter((b) => !existingKeys.has(b.key));
              return [...fresh, ...prev].slice(0, MAX_VISIBLE_BANNERS);
            });
          } else if (
            prefs.desktopNotificationsEnabled &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification.permission === "granted"
          ) {
            try {
              const first = newUnread[0];
              const desktop = new window.Notification(
                newUnread.length === 1
                  ? first.title || "New eFlow notification"
                  : `${newUnread.length} new eFlow notifications`,
                {
                  body:
                    newUnread.length === 1
                      ? first.message || first.taskTitle || "Open eFlow for details."
                      : "Switch back to eFlow to review your new notifications.",
                  tag: newUnread.length === 1 ? `eflow-${first.id}` : "eflow-notif-burst",
                },
              );
              desktop.onclick = () => {
                window.focus();
                desktop.close();
                if (newUnread.length === 1) {
                  void openNotificationRef.current(first);
                }
              };
            } catch {
              // Ignore browser desktop notification restrictions.
            }
          }
        }
      },
      50,
      setDelivery,
    );
  }, [userId]);

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.();
      if (ringTimerRef.current !== undefined) window.clearTimeout(ringTimerRef.current);
    };
  }, []);

  const unreadCount = useMemo(
    () =>
      delivery.unreadCount ??
      notifications.filter((notification) => !notification.read).length,
    [notifications, delivery.unreadCount],
  );

  // Dynamic browser tab unread count badge: "(N) Page Title"
  useEffect(() => {
    if (typeof document === "undefined" || !userId) return;
    const baseTitle = document.title.replace(TITLE_BADGE_RE, "") || "eFlow";
    document.title =
      unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${baseTitle}` : baseTitle;
    return () => {
      if (typeof document !== "undefined") {
        document.title = document.title.replace(TITLE_BADGE_RE, "") || "eFlow";
      }
    };
  }, [unreadCount, userId]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setIsFullscreen(false);
  }, []);

  const openPanel = useCallback(() => {
    setPos(computeAnchoredPosition(buttonRef.current, size.w, size.h));
    setOpen(true);
  }, [size.h, size.w]);

  usePanelDismissal(open, panelRef, buttonRef, closePanel);

  const startDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isFullscreen || event.button !== 0) return;
      event.preventDefault();
      interactionCleanupRef.current?.();

      const startX = event.clientX;
      const startY = event.clientY;
      const originX = pos.x;
      const originY = pos.y;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const nextX = originX + (moveEvent.clientX - startX);
        const nextY = originY + (moveEvent.clientY - startY);
        const maxX = Math.max(8, window.innerWidth - size.w - 8);
        const maxY = Math.max(8, window.innerHeight - 60);
        setPos({
          x: Math.max(8, Math.min(nextX, maxX)),
          y: Math.max(8, Math.min(nextY, maxY)),
        });
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", cleanup);
        interactionCleanupRef.current = null;
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", cleanup);
      interactionCleanupRef.current = cleanup;
    },
    [isFullscreen, pos.x, pos.y, size.w],
  );

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isFullscreen || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      interactionCleanupRef.current?.();

      const startX = event.clientX;
      const startY = event.clientY;
      const originW = size.w;
      const originH = size.h;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - pos.x - 8);
        const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - pos.y - 8);
        setSize({
          w: Math.max(MIN_PANEL_WIDTH, Math.min(originW + (moveEvent.clientX - startX), maxW)),
          h: Math.max(MIN_PANEL_HEIGHT, Math.min(originH + (moveEvent.clientY - startY), maxH)),
        });
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", cleanup);
        interactionCleanupRef.current = null;
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", cleanup);
      interactionCleanupRef.current = cleanup;
    },
    [isFullscreen, pos.x, pos.y, size.h, size.w],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== "all" ||
    (isFullscreen && periodFilter !== "all");

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPeriodFilter("all");
    setFilterTab("all");
  }, []);

  const visibleNotifications = useMemo(
    () =>
      filterNotificationsLocally(notifications, {
        unreadOnly: filterTab === "unread",
        category: categoryFilter,
        period: isFullscreen ? periodFilter : "all",
        query: searchQuery,
      }),
    [categoryFilter, filterTab, isFullscreen, notifications, periodFilter, searchQuery],
  );

  const groupedFullscreenNotifications = useMemo(
    () => (isFullscreen ? groupNotificationsByManilaDate(visibleNotifications) : []),
    [isFullscreen, visibleNotifications],
  );

  const handleMarkSingleRead = useCallback(
    async (notification: Notification) => {
      if (!userId || notification.read || markingId) return;
      const recipient = userId;
      setMarkingId(notification.id);
      setReadError("");
      try {
        await markRecentNotificationRead(recipient, notification.id);
        if (recipientRef.current !== recipient) return;
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
        );
        setDelivery((current) =>
          current.unreadCount === null
            ? current
            : { ...current, unreadCount: Math.max(0, current.unreadCount - 1) },
        );
      } catch {
        if (recipientRef.current === recipient) {
          setReadError("We couldn’t mark this notification as read. Try again.");
        }
      } finally {
        if (recipientRef.current === recipient) setMarkingId(null);
      }
    },
    [markingId, userId],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || markingAll) return;
    const recipient = userId;
    const shown = new Set(notifications.map((item) => item.id));
    setMarkingAll(true);
    setReadError("");
    try {
      await markAllNotificationsRead(recipient);
      if (recipientRef.current !== recipient) return;
      setNotifications((current) =>
        current.map((item) => (shown.has(item.id) ? { ...item, read: true } : item)),
      );
      setDelivery((current) =>
        current.unreadCount === null ? current : { ...current, unreadCount: 0 },
      );
      setLiveBanners([]);
    } catch {
      if (recipientRef.current === recipient) {
        setReadError("We couldn’t mark your notifications as read. Try again.");
      }
    } finally {
      if (recipientRef.current === recipient) setMarkingAll(false);
    }
  }, [userId, markingAll, notifications]);

  const openNotification = useCallback(
    async (notification: Notification) => {
      const destination = role ? resolveNotificationDestination(notification, role) : null;

      if (!notification.read) {
        try {
          await markRecentNotificationRead(userId || "", notification.id);
          if (recipientRef.current !== userId) return;
          setNotifications((current) =>
            current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
          );
          setDelivery((current) =>
            current.unreadCount === null
              ? current
              : { ...current, unreadCount: Math.max(0, current.unreadCount - 1) },
          );
        } catch {
          if (recipientRef.current !== userId) return;
          toastRef.current(
            "We couldn’t mark this notification as read. You can still open it.",
            "warning",
          );
        }
      }

      if (destination && onNavigate) {
        const accepted = await onNavigate(destination.section, destination.page);
        if (accepted === false) return;
        queueNotificationNavigationIntent(destination.intent, userId);
        closePanel();
      }
    },
    [closePanel, onNavigate, role, userId],
  );
  openNotificationRef.current = openNotification;

  const openAllNotifications = useCallback(() => {
    if (onNavigate) {
      closePanel();
      void onNavigate("inbox", "Notifications");
    } else {
      openPanel();
      setIsFullscreen(true);
    }
  }, [closePanel, onNavigate, openPanel]);

  if (!userId) return null;

  const countHint = delivery.error
    ? `Notifications couldn’t refresh. ${unreadCount ? `Last known count: ${unreadCount} unread.` : "Open Inbox to try again."}`
    : delivery.loading && !notifications.length
      ? "Checking notifications…"
      : unreadCount
        ? `${unreadCount} unread notifications`
        : "No unread notifications";

  const renderBannerPortal = (
    <LiveNotificationBanners
      items={liveBanners}
      onOpenSingle={(notification) => void openNotification(notification)}
      onMarkSingleRead={(notification) => void handleMarkSingleRead(notification)}
      onOpenAll={openAllNotifications}
      onMarkAllRead={() => void handleMarkAllRead()}
      onDismiss={dismissBanner}
    />
  );

  if (alignToInbox) {
    return (
      <>
        <WorkspaceTooltip
          content={delivery.error ? "Notifications couldn’t refresh" : "Inbox notifications"}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={() => void onNavigate?.("inbox", "Notifications")}
            aria-current={active ? "page" : undefined}
            aria-label={
              unreadCount
                ? `Open Inbox notifications, ${unreadCount} unread`
                : "Open Inbox notifications"
            }
            aria-describedby={unreadHintId}
            className={`eflow-bell-trigger ${compact ? "eflow-bell-trigger--compact" : "eflow-bell-trigger--default"} ${ringing ? "eflow-bell-trigger--ringing" : ""} ${className}`.trim()}
          >
            <Bell className="w-[17px] h-[17px]" />
            {unreadCount > 0 && (
              <span className="eflow-bell-trigger__count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {!unreadCount && delivery.error && (
              <span className="eflow-bell-trigger__count" aria-hidden="true">
                !
              </span>
            )}
          </button>
        </WorkspaceTooltip>
        <span id={unreadHintId} className="sr-only">
          {countHint}
        </span>
        {renderBannerPortal}
      </>
    );
  }

  const renderNotificationCard = (notification: Notification, expanded: boolean) => {
    const detail = getNotificationDetail(notification);
    const destination = role ? resolveNotificationDestination(notification, role) : null;
    const visual = getNotificationVisual(notification.type);
    const Icon = visual.icon;
    const exactManila = formatNotificationExactManila(notification.createdAt);

    if (expanded) {
      return (
        <div
          key={notification.id}
          className={`eflow-notif-item eflow-notif-item--expanded ${!notification.read ? "eflow-notif-item--unread" : ""}`.trim()}
        >
          <span
            className={`eflow-notif-item__icon ${ICON_TONE_CLASSES[visual.tone]}`}
            aria-hidden="true"
          >
            <Icon className="w-4 h-4" />
          </span>
          <div className="eflow-notif-item__body">
            <div className="eflow-notif-item__top">
              <div className="eflow-notif-item__heading-row">
                {!notification.read && (
                  <span className="eflow-notif-item__unread-dot" aria-label="Unread" />
                )}
                <span className="eflow-notif-item__title">{notification.title}</span>
                <span className="eflow-notif-item__category-tag">{visual.categoryLabel}</span>
              </div>
              <time className="eflow-notif-item__time" title={exactManila || undefined}>
                {formatNotificationRelativeTime(notification.createdAt)}
                {exactManila ? ` · ${exactManila}` : ""}
              </time>
            </div>
            {notification.message && (
              <span className="eflow-notif-item__message">{notification.message}</span>
            )}
            {notification.taskTitle && (
              <span className="eflow-notif-item__context">Task: {notification.taskTitle}</span>
            )}
            {detail && (
              <span
                className={`eflow-notif-item__detail eflow-notif-item__detail--${detail.tone}`}
              >
                {detail.label}: {detail.text}
              </span>
            )}
          </div>
          <div className="eflow-notif-item__expanded-actions">
            {destination && (
              <button
                type="button"
                className="eflow-notif-item__row-btn eflow-notif-item__row-btn--primary"
                onClick={() => void openNotification(notification)}
              >
                <span>{destination.label}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            {!notification.read && (
              <button
                type="button"
                className="eflow-notif-item__row-btn"
                disabled={markingId === notification.id || markingAll}
                onClick={() => void handleMarkSingleRead(notification)}
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{markingId === notification.id ? "Saving…" : "Mark read"}</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => void openNotification(notification)}
        className={`eflow-notif-item ${!notification.read ? "eflow-notif-item--unread" : ""}`.trim()}
      >
        <span className="eflow-notif-item__icon" aria-hidden="true">
          <Icon className="w-4 h-4" />
        </span>
        <span className="eflow-notif-item__body">
          <span className="eflow-notif-item__top">
            <span className="eflow-notif-item__title">{notification.title}</span>
            <time className="eflow-notif-item__time" title={exactManila || undefined}>
              {formatNotificationRelativeTime(notification.createdAt)}
            </time>
          </span>
          {notification.message && (
            <span className="eflow-notif-item__message">{notification.message}</span>
          )}
          {detail && (
            <span className={`eflow-notif-item__detail eflow-notif-item__detail--${detail.tone}`}>
              {detail.label}: {detail.text}
            </span>
          )}
          {destination && (
            <span className="eflow-notif-item__destination">
              <span>{destination.label}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <WorkspaceTooltip
        content={delivery.error ? "Notifications couldn’t refresh" : "Notifications"}
        disabled={open}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? closePanel() : openPanel())}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={open ? "Close notifications" : "Open notifications"}
          aria-describedby={unreadHintId}
          className={`eflow-bell-trigger ${compact ? "eflow-bell-trigger--compact" : "eflow-bell-trigger--default"} ${ringing ? "eflow-bell-trigger--ringing" : ""} ${className}`.trim()}
        >
          <Bell className="w-[17px] h-[17px]" />
          {unreadCount > 0 && (
            <span className="eflow-bell-trigger__count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {!unreadCount && delivery.error && (
            <span className="eflow-bell-trigger__count" aria-hidden="true">
              !
            </span>
          )}
        </button>
      </WorkspaceTooltip>
      <span id={unreadHintId} className="sr-only">
        {countHint}
      </span>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
            aria-label="Notifications"
            className={`eflow-notif-panel ${isFullscreen ? "eflow-notif-panel--expanded" : ""}`.trim()}
            style={
              isFullscreen
                ? undefined
                : { left: pos.x, top: pos.y, width: size.w, height: size.h }
            }
          >
            <div className="eflow-notif-panel__header" onMouseDown={startDrag}>
              <div className="eflow-notif-panel__title-group">
                <h2 className="eflow-notif-panel__title">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="eflow-notif-panel__unread-tag">{unreadCount} unread</span>
                )}
              </div>

              <div
                className="eflow-notif-panel__actions"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <WorkspaceTooltip
                  content={
                    soundPrefs.notificationSoundEnabled
                      ? "Mute notification bell sound"
                      : "Unmute notification bell sound"
                  }
                >
                  <button
                    type="button"
                    onClick={toggleSoundMuted}
                    className={`eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon ${
                      !soundPrefs.notificationSoundEnabled
                        ? "eflow-notif-panel__action-btn--muted"
                        : ""
                    }`.trim()}
                    aria-label={
                      soundPrefs.notificationSoundEnabled
                        ? "Mute notification sound"
                        : "Unmute notification sound"
                    }
                    aria-pressed={!soundPrefs.notificationSoundEnabled}
                  >
                    {soundPrefs.notificationSoundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                  </button>
                </WorkspaceTooltip>

                <WorkspaceTooltip
                  content={isFullscreen ? "Collapse notifications" : "Expand notifications"}
                >
                  <button
                    type="button"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                    aria-label={isFullscreen ? "Collapse notifications" : "Expand notifications"}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </WorkspaceTooltip>

                <WorkspaceTooltip content="Close notifications">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                    aria-label="Close notifications"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </WorkspaceTooltip>
              </div>
            </div>

            <div className="eflow-notif-panel__tabs-bar">
              <div className="eflow-notif-panel__tabs" role="tablist" aria-label="Notification filter">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterTab === "all"}
                  data-active={filterTab === "all"}
                  onClick={() => setFilterTab("all")}
                  className="eflow-notif-panel__tab"
                >
                  <span>All</span>
                  <span className="eflow-notif-panel__tab-count">{notifications.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterTab === "unread"}
                  data-active={filterTab === "unread"}
                  onClick={() => setFilterTab("unread")}
                  className="eflow-notif-panel__tab"
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="eflow-notif-panel__tab-count">{unreadCount}</span>
                  )}
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={markingAll}
                  className="eflow-notif-panel__mark-all-btn"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{markingAll ? "Marking read…" : "Mark all read"}</span>
                </button>
              )}
            </div>

            {/* Search & Filter Toolbar */}
            <div className="eflow-notif-panel__controls" aria-label="Search and filter notifications">
              <div className="eflow-notif-panel__controls-inner">
                <div className="eflow-notif-panel__search-wrap">
                  <Search className="eflow-notif-panel__search-icon" size={14} aria-hidden="true" />
                  <BoundedTextInput
                    value={searchQuery}
                    maxLength={120}
                    compact={!isFullscreen}
                    showCounter={isFullscreen && searchQuery.length > 0}
                    type="search"
                    aria-label="Search notifications"
                    placeholder="Search title, task, person…"
                    className="eflow-notif-panel__search-input"
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="eflow-notif-panel__search-clear"
                      aria-label="Clear notification search"
                      onClick={() => setSearchQuery("")}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="eflow-notif-panel__filter-row">
                  <select
                    aria-label="Filter notifications by category"
                    className="eflow-notif-panel__select"
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value as NotificationCategory)
                    }
                  >
                    {NOTIFICATION_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>

                  {isFullscreen && (
                    <select
                      aria-label="Filter notifications by time period"
                      className="eflow-notif-panel__select"
                      value={periodFilter}
                      onChange={(event) =>
                        setPeriodFilter(event.target.value as NotificationPeriod)
                      }
                    >
                      <option value="all">All time</option>
                      <option value="today">Today (PH)</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                    </select>
                  )}

                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="eflow-notif-panel__clear-btn"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {isFullscreen && hasActiveFilters && (
                  <p className="eflow-notif-panel__match-count" role="status">
                    {visibleNotifications.length} matching{" "}
                    {visibleNotifications.length === 1 ? "notification" : "notifications"}
                  </p>
                )}
              </div>
            </div>

            <div className="eflow-notif-panel__list">
              <div className="eflow-notif-panel__list-inner">
                {(delivery.error || readError) && (
                  <FeedbackState tone="warning" title="Notifications need attention">
                    {readError || delivery.error}
                  </FeedbackState>
                )}
                {delivery.loading && notifications.length === 0 ? (
                  <p role="status" className="p-4 text-sm">
                    Loading notifications…
                  </p>
                ) : visibleNotifications.length === 0 && !delivery.error ? (
                  <div className="eflow-notif-panel__empty">
                    <EmptyState
                      size="panel"
                      illustration={
                        hasActiveFilters ? "search" : filterTab === "unread" ? false : "inbox"
                      }
                      icon={
                        !hasActiveFilters && filterTab === "unread" ? (
                          <CheckCheck className="w-5 h-5" />
                        ) : undefined
                      }
                      title={
                        hasActiveFilters
                          ? "No matching notifications"
                          : filterTab === "unread"
                            ? "You're all caught up"
                            : "No notifications"
                      }
                      description={
                        hasActiveFilters
                          ? "Try a different search term, category, or time period."
                          : filterTab === "unread"
                            ? "Unread updates and approvals will appear here."
                            : "You're caught up. Task assignments, approvals, and mentions will appear here."
                      }
                      action={
                        hasActiveFilters ? (
                          <button
                            type="button"
                            className="eflow-notif-panel__action-btn"
                            onClick={clearFilters}
                          >
                            Clear search &amp; filters
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : isFullscreen ? (
                  groupedFullscreenNotifications.map((group) => (
                    <section
                      key={group.id}
                      className="eflow-notif-group"
                      aria-label={group.label}
                    >
                      <header className="eflow-notif-group__header">
                        <h3>{group.label}</h3>
                        <span>{group.items.length}</span>
                      </header>
                      <div className="eflow-notif-group__items">
                        {group.items.map((item) => renderNotificationCard(item, true))}
                      </div>
                    </section>
                  ))
                ) : (
                  visibleNotifications.map((notification) =>
                    renderNotificationCard(notification, false),
                  )
                )}
                {filterTab === "unread" &&
                  !hasActiveFilters &&
                  unreadCount > visibleNotifications.length && (
                    <p className="p-4 text-[12px] text-[var(--eflow-text-muted)]">
                      More unread notifications are available in Inbox. Use “View all in Inbox” to
                      see them.
                    </p>
                  )}
              </div>
            </div>

            {onNavigate && (
              <div className="eflow-notif-panel__footer">
                <button
                  type="button"
                  onClick={() => {
                    closePanel();
                    void onNavigate("inbox", "Notifications");
                  }}
                  className="eflow-notif-panel__view-all"
                >
                  <span>
                    {searchQuery.trim() ? "Search older notifications in Inbox" : "View all in Inbox"}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {!isFullscreen && (
              <WorkspaceTooltip content="Resize notifications panel">
                <button
                  type="button"
                  onMouseDown={startResize}
                  className="eflow-notif-panel__resize"
                  aria-label="Resize notifications panel"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 3.5L3.5 9M9 7L7 9"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </WorkspaceTooltip>
            )}
          </div>,
          document.body,
        )}

      {renderBannerPortal}
    </>
  );
}
