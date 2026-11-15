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
  markNotificationRead,
  subscribeToNotifications,
  type Notification,
  type NotificationType,
} from "../../services/notificationService";
import {
  getNotificationDetail,
  queueNotificationNavigationIntent,
  resolveNotificationDestination,
} from "../../features/notifications";

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
}: {
  userId?: string;
  role?: string;
  onNavigate?: (section: string, page: string) => void | Promise<boolean | void>;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterTab, setFilterTab] = useState<NotificationFilterTab>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_PANEL_WIDTH, h: DEFAULT_PANEL_HEIGHT });
  const [pos, setPos] = useState({ x: 16, y: 56 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    return subscribeToNotifications(userId, setNotifications);
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
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const visibleNotifications = useMemo(
    () => (filterTab === "unread" ? notifications.filter((item) => !item.read) : notifications),
    [filterTab, notifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    await markAllNotificationsRead(userId || "");
  }, [userId]);

  const openNotification = useCallback(
    async (notification: Notification) => {
      const destination = role
        ? resolveNotificationDestination(notification, role)
        : null;

      if (!notification.read) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item,
          ),
        );
        await markNotificationRead(userId || "", notification.id);
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close notifications" : "Open notifications"}
        title={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "No new notifications"
        }
        className={`eflow-bell-trigger ${compact ? "eflow-bell-trigger--compact" : "eflow-bell-trigger--default"} ${className}`.trim()}
      >
        <Bell className="w-[17px] h-[17px]" />
        {unreadCount > 0 && (
          <span className="eflow-bell-trigger__count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

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
                    className="eflow-notif-panel__action-btn"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                  aria-label={
                    isFullscreen ? "Collapse notifications" : "Expand notifications"
                  }
                  title={isFullscreen ? "Collapse" : "Expand"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={closePanel}
                  className="eflow-notif-panel__action-btn eflow-notif-panel__action-btn--icon"
                  aria-label="Close notifications"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
                {visibleNotifications.length === 0 ? (
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
              </div>
            </div>

            {!isFullscreen && (
              <button
                type="button"
                onMouseDown={startResize}
                className="eflow-notif-panel__resize"
                aria-label="Resize notifications panel"
                title="Drag to resize"
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
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
