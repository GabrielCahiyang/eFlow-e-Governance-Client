import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowUpRight, Bell, Check, CheckCheck, X } from "lucide-react";
import type { Notification } from "../../services/notificationService";
import {
  formatNotificationExactManila,
  formatNotificationRelativeTime,
  getNotificationVisual,
  ICON_TONE_CLASSES,
  type NotificationTone,
} from "../../features/notifications/visuals";
import "./liveNotificationBanner.css";

export type LiveNotificationBannerItem =
  | {
      kind: "single";
      key: string;
      notification: Notification;
      actionLabel?: string;
    }
  | {
      kind: "batch";
      key: string;
      count: number;
      categoriesSummary: string;
      urgent: boolean;
      createdAt: number;
    };

function BannerCard({
  item,
  onOpenSingle,
  onMarkSingleRead,
  onOpenAll,
  onMarkAllRead,
  onDismiss,
}: {
  item: LiveNotificationBannerItem;
  onOpenSingle: (notification: Notification) => void;
  onMarkSingleRead: (notification: Notification) => void;
  onOpenAll: () => void;
  onMarkAllRead: () => void;
  onDismiss: () => void;
}) {
  const isUrgent =
    item.kind === "single" ? getNotificationVisual(item.notification.type).urgent : item.urgent;
  const durationMs = isUrgent ? 9000 : 6000;
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(durationMs);
  const startedAtRef = useRef(Date.now());
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (paused) return;
    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      dismissRef.current();
    }, Math.max(250, remainingRef.current));
    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [paused]);

  let tone: NotificationTone = "info";
  let categoryLabel = "New updates";
  let Icon = Bell;
  let title = "";
  let message = "";
  let contextLine = "";
  let createdAt = Date.now();

  if (item.kind === "single") {
    const visual = getNotificationVisual(item.notification.type);
    tone = visual.tone;
    categoryLabel = visual.categoryLabel;
    Icon = visual.icon;
    title = item.notification.title || "New notification";
    message = item.notification.message || "";
    contextLine = item.notification.taskTitle
      ? `Task: ${item.notification.taskTitle}`
      : item.notification.actorName
        ? `From: ${item.notification.actorName}`
        : "";
    createdAt = item.notification.createdAt;
  } else {
    tone = item.urgent ? "warning" : "info";
    categoryLabel = item.urgent ? "Action required" : "Multiple updates";
    title = `${item.count} new notifications`;
    message = item.categoriesSummary;
    createdAt = item.createdAt;
  }

  const exactManila = formatNotificationExactManila(createdAt);

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      data-paused={paused ? "true" : "false"}
      className="eflow-live-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ ["--eflow-banner-duration" as string]: `${durationMs}ms` }}
    >
      <div className="eflow-live-banner__main">
        <span
          aria-hidden="true"
          className={`eflow-live-banner__icon ${ICON_TONE_CLASSES[tone]}`}
        >
          <Icon size={16} />
        </span>
        <div className="eflow-live-banner__body">
          <div className="eflow-live-banner__meta">
            <span className="eflow-live-banner__tag">{categoryLabel}</span>
            <time className="eflow-live-banner__time" title={exactManila || undefined}>
              {formatNotificationRelativeTime(createdAt)}
            </time>
          </div>
          <p className="eflow-live-banner__title">{title}</p>
          {message && <p className="eflow-live-banner__message">{message}</p>}
          {contextLine && (
            <p className="eflow-live-banner__context" title={contextLine}>
              {contextLine}
            </p>
          )}
        </div>
        <button
          type="button"
          className="eflow-live-banner__dismiss"
          aria-label="Dismiss notification banner"
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="eflow-live-banner__actions">
        {item.kind === "single" ? (
          <>
            <button
              type="button"
              className="eflow-live-banner__btn"
              onClick={() => {
                onMarkSingleRead(item.notification);
                onDismiss();
              }}
            >
              <Check size={12} aria-hidden="true" />
              <span>Mark read</span>
            </button>
            <button
              type="button"
              className="eflow-live-banner__btn eflow-live-banner__btn--primary"
              onClick={() => {
                onOpenSingle(item.notification);
                onDismiss();
              }}
            >
              <span>{item.actionLabel || "Open"}</span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="eflow-live-banner__btn"
              onClick={() => {
                onMarkAllRead();
                onDismiss();
              }}
            >
              <CheckCheck size={12} aria-hidden="true" />
              <span>Mark all read</span>
            </button>
            <button
              type="button"
              className="eflow-live-banner__btn eflow-live-banner__btn--primary"
              onClick={() => {
                onOpenAll();
                onDismiss();
              }}
            >
              <span>Open notifications</span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="eflow-live-banner__progress" aria-hidden="true">
        <div className="eflow-live-banner__progress-bar" />
      </div>
    </div>
  );
}

export function LiveNotificationBanners({
  items,
  onOpenSingle,
  onMarkSingleRead,
  onOpenAll,
  onMarkAllRead,
  onDismiss,
}: {
  items: LiveNotificationBannerItem[];
  onOpenSingle: (notification: Notification) => void;
  onMarkSingleRead: (notification: Notification) => void;
  onOpenAll: () => void;
  onMarkAllRead: () => void;
  onDismiss: (key: string) => void;
}) {
  if (!items.length || typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div
      className="eflow-live-banner-stack"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Live notifications"
    >
      {items.map((item) => (
        <BannerCard
          key={item.key}
          item={item}
          onOpenSingle={onOpenSingle}
          onMarkSingleRead={onMarkSingleRead}
          onOpenAll={onOpenAll}
          onMarkAllRead={onMarkAllRead}
          onDismiss={() => onDismiss(item.key)}
        />
      ))}
    </div>,
    document.body,
  );
}
