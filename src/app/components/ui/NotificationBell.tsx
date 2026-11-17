import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { EmptyState } from './EmptyState';
import './notificationBell.css';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { usePanelDismissal } from '../../shared/usePanelDismissal';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCheck,
  FileCheck2,
  FolderKanban,
  Maximize2,
  MessageSquare,
  Minimize2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  markAllNotificationsRead,
  markRecentNotificationRead,
  subscribeToNotifications,
  type Notification,
  type NotificationType,
} from "../../services/notificationService";
import {
  getNotificationDetail,
  queueNotificationNavigationIntent,
  resolveNotificationDestination,
} from "../../features/notifications";
import { FeedbackState } from './FeedbackState';
import { useToast } from './Toast';

type NotificationFilterTab = "all" | "unread";

const DEFAULT_PANEL_WIDTH = 400;
const DEFAULT_PANEL_HEIGHT = 500;
const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 320;

const CATEGORY_ICON_BY_TYPE: Partial<Record<NotificationType, LucideIcon>> = {
  comment: MessageSquare,
  collaboration_message: MessageSquare,
  overdue: AlertTriangle,
  burnout_warning: AlertTriangle,
  petty_cash_liquidation_overdue: AlertTriangle,
  petty_cash_settlement_blocked: AlertTriangle,
  petty_cash_request_expired: AlertTriangle,
  project_archive_blocked: AlertTriangle,
  approval_needed: FileCheck2,
  completed: FileCheck2,
  collaboration_approved: FileCheck2,
  petty_cash_leader_review: FileCheck2,
  petty_cash_department_approval: FileCheck2,
  petty_cash_decision: FileCheck2,
  petty_cash_liquidation: FileCheck2,
  project_seal_confirmed: FileCheck2,
  collaboration_request: FolderKanban,
  collaboration_change: FolderKanban,
  collaboration_revision: FolderKanban,
  collaboration_declined: FolderKanban,
  collaboration_ready: FolderKanban,
  project_archive_reminder: FolderKanban,
};

function getNotificationCategoryIcon(type: NotificationType): LucideIcon {
  return CATEGORY_ICON_BY_TYPE[type] ?? Bell;
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

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
  const [delivery, setDelivery] = useState<{ unreadCount: number | null; error: string; loading: boolean }>({ unreadCount: null, error: '', loading: true });
  const [readError, setReadError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const { toast } = useToast();
  const toastRef = useRef(toast); toastRef.current = toast;
  const recipientRef = useRef(userId); recipientRef.current = userId;
  const [filterTab, setFilterTab] = useState<NotificationFilterTab>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_PANEL_WIDTH, h: DEFAULT_PANEL_HEIGHT });
  const [pos, setPos] = useState({ x: 16, y: 56 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setNotifications([]);
    setDelivery({ unreadCount: null, error: '', loading: Boolean(userId) });
    setReadError(''); setMarkingAll(false);
    if (!userId) {
      return;
    }
    let previousIds: Set<string> | null = null;
    return subscribeToNotifications(userId, rows => {
      const newUnread = previousIds ? rows.filter(row => !row.read && !previousIds!.has(row.id)) : [];
      previousIds = new Set(rows.map(row => row.id));
      setNotifications(rows);
      if (newUnread.length && document.visibilityState !== 'hidden') {
        toastRef.current(newUnread.length === 1
          ? `${newUnread[0].title}${newUnread[0].taskTitle ? `: ${newUnread[0].taskTitle.slice(0, 100)}` : ''}. Open Notifications for details.`
          : `${newUnread.length} new notifications. Open Notifications to see what changed.`, 'info');
      }
    }, 50, setDelivery);
  }, [userId]);

  useEffect(() => {
    return () => {
      interactionCleanupRef.current?.();
    };
  }, []);

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

  const unreadCount = useMemo(
    () => delivery.unreadCount ?? notifications.filter((notification) => !notification.read).length,
    [notifications, delivery.unreadCount],
  );

  const visibleNotifications = useMemo(
    () => (filterTab === "unread" ? notifications.filter((item) => !item.read) : notifications),
    [filterTab, notifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || markingAll) return;
    const recipient = userId;
    const shown = new Set(notifications.map(item => item.id));
    setMarkingAll(true); setReadError('');
    try {
      await markAllNotificationsRead(recipient);
      if (recipientRef.current !== recipient) return;
      setNotifications(current => current.map(item => shown.has(item.id) ? { ...item, read: true } : item));
      // The delivery refresh supplies the exact count; don't hide a concurrently arriving alert.
    } catch {
      if (recipientRef.current === recipient) setReadError('We couldn’t mark your notifications as read. Try again.');
    } finally {
      if (recipientRef.current === recipient) setMarkingAll(false);
    }
  }, [userId, markingAll, notifications]);

  const openNotification = useCallback(
    async (notification: Notification) => {
      const destination = role
        ? resolveNotificationDestination(notification, role)
        : null;

      if (!notification.read) {
        try {
          await markRecentNotificationRead(userId || '', notification.id);
          if (recipientRef.current !== userId) return;
          setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read: true } : item));
        } catch {
          if (recipientRef.current !== userId) return;
          toastRef.current('We couldn’t mark this notification as read. You can still open it.', 'warning');
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

  if (!userId) return null;
  const countHint = delivery.error
    ? `Notifications couldn’t refresh. ${unreadCount ? `Last known count: ${unreadCount} unread.` : 'Open Inbox to try again.'}`
    : delivery.loading && !notifications.length ? 'Checking notifications…'
      : unreadCount ? `${unreadCount} unread notifications` : 'No unread notifications';

  if (alignToInbox) {
    return (
      <>
        <WorkspaceTooltip content={delivery.error ? 'Notifications couldn’t refresh' : 'Inbox notifications'}>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => void onNavigate?.("inbox", "Notifications")}
            aria-current={active ? "page" : undefined}
            aria-label={unreadCount ? `Open Inbox notifications, ${unreadCount} unread` : "Open Inbox notifications"}
            aria-describedby={unreadHintId}
            className={`eflow-bell-trigger ${compact ? "eflow-bell-trigger--compact" : "eflow-bell-trigger--default"} ${className}`.trim()}
          >
            <Bell className="w-[17px] h-[17px]" />
            {unreadCount > 0 && (
              <span className="eflow-bell-trigger__count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {!unreadCount && delivery.error && <span className="eflow-bell-trigger__count" aria-hidden="true">!</span>}
          </button>
        </WorkspaceTooltip>
        <span id={unreadHintId} className="sr-only">{countHint}</span>
      </>
    );
  }

  return (
    <>
      <WorkspaceTooltip content={delivery.error ? 'Notifications couldn’t refresh' : 'Notifications'} disabled={open}><button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close notifications" : "Open notifications"}
        aria-describedby={unreadHintId}
        className={`eflow-bell-trigger ${compact ? "eflow-bell-trigger--compact" : "eflow-bell-trigger--default"} ${className}`.trim()}
      >
        <Bell className="w-[17px] h-[17px]" />
        {unreadCount > 0 && (
          <span className="eflow-bell-trigger__count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {!unreadCount && delivery.error && <span className="eflow-bell-trigger__count" aria-hidden="true">!</span>}
      </button></WorkspaceTooltip>
      <span id={unreadHintId} className="sr-only">{countHint}</span>

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
                  <span className="eflow-notif-panel__unread-tag">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div
                className="eflow-notif-panel__actions"
                onMouseDown={(event) => event.stopPropagation()}
              >
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    disabled={markingAll}
                    className="eflow-notif-panel__action-btn"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{markingAll ? 'Marking read…' : 'Mark all read'}</span>
                  </button>
                )}

                <WorkspaceTooltip content={ isFullscreen ? "Collapse notifications" : "Expand notifications" }><button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                  aria-label={
                    isFullscreen ? "Collapse notifications" : "Expand notifications"
                  }

                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button></WorkspaceTooltip>

                <WorkspaceTooltip content="Close notifications"><button
                  type="button"
                  onClick={closePanel}
                  className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                  aria-label="Close notifications"

                >
                  <X className="w-3.5 h-3.5" />
                </button></WorkspaceTooltip>
              </div>
            </div>

            <div
              className="eflow-notif-panel__tabs"
              role="tablist"
              aria-label="Notification filter"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "all"}
                data-active={filterTab === "all"}
                onClick={() => setFilterTab("all")}
                className="eflow-notif-panel__tab"
              >
                <span>All</span>
                <span className="eflow-notif-panel__tab-count">
                  {notifications.length}
                </span>
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
                  <span className="eflow-notif-panel__tab-count">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="eflow-notif-panel__list">
              <div className="eflow-notif-panel__list-inner">
                {(delivery.error || readError) && <FeedbackState tone="warning" title="Notifications need attention">{readError || delivery.error}</FeedbackState>}
                {delivery.loading && notifications.length === 0 ? <p role="status" className="p-4 text-sm">Loading notifications…</p> : visibleNotifications.length === 0 && !delivery.error ? (
                  <div className="eflow-notif-panel__empty">
                    <EmptyState
                      size="panel"
                      illustration={filterTab === "unread" ? false : "inbox"}
                      icon={
                        filterTab === "unread" ? (
                          <CheckCheck className="w-5 h-5" />
                        ) : undefined
                      }
                      title={
                        filterTab === "unread"
                          ? "You're all caught up"
                          : "No notifications"
                      }
                      description={
                        filterTab === "unread"
                          ? "Unread updates and approvals will appear here."
                          : "You're caught up. Task assignments, approvals, and mentions will appear here."
                      }
                    />
                  </div>
                ) : (
                  visibleNotifications.map((notification) => {
                    const detail = getNotificationDetail(notification);
                    const destination = role
                      ? resolveNotificationDestination(notification, role)
                      : null;
                    const Icon = getNotificationCategoryIcon(notification.type);

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
                            <span className="eflow-notif-item__title">
                              {notification.title}
                            </span>
                            <span className="eflow-notif-item__time">
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                          </span>
                          {notification.message && (
                            <span className="eflow-notif-item__message">
                              {notification.message}
                            </span>
                          )}
                          {detail && (
                            <span
                              className={`eflow-notif-item__detail eflow-notif-item__detail--${detail.tone}`}
                            >
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
                  })
                )}
                {filterTab === 'unread' && unreadCount > visibleNotifications.length && <p className="p-4 text-[12px] text-[var(--eflow-text-muted)]">More unread notifications are available in Inbox. Use “View all in Inbox” to see them.</p>}
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
                  <span>View all in Inbox</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {!isFullscreen && (
              <WorkspaceTooltip content="Resize notifications panel"><button
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
              </button></WorkspaceTooltip>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
