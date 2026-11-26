import { formatMinutesDuration } from "../../../shared/systemRuntimeConfig";
import { SESSION_NOTICE_KEY } from "../constants";

export type LogoutReason =
  | "inactivity"
  | "manual"
  | "manual_warning"
  | "deactivated"
  | "session_expired"
  | "other";

export type LogoutNoticeTone = "info" | "warning" | "danger";

export interface LogoutNotice {
  reason: LogoutReason;
  tone: LogoutNoticeTone;
  badge: string;
  title: string;
  message: string;
  detail?: string;
  occurredAt: number;
}

export interface LogoutNoticeInput {
  reason: LogoutReason;
  timeoutMinutes?: number;
  title?: string;
  message?: string;
  detail?: string;
  occurredAt?: number;
}

export const LOGOUT_NOTICE_EVENT = "eflow-logout-notice-changed";

const VALID_REASONS = new Set<LogoutReason>([
  "inactivity",
  "manual",
  "manual_warning",
  "deactivated",
  "session_expired",
  "other",
]);

const VALID_TONES = new Set<LogoutNoticeTone>(["info", "warning", "danger"]);

function getSafeStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}

function dispatchLogoutNoticeChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(LOGOUT_NOTICE_EVENT));
  } catch {
    // Ignore event dispatch errors in restricted environments
  }
}

export function buildLogoutNotice(input: LogoutNoticeInput): LogoutNotice {
  const occurredAt =
    typeof input.occurredAt === "number" && Number.isFinite(input.occurredAt)
      ? input.occurredAt
      : Date.now();

  switch (input.reason) {
    case "inactivity": {
      const durationLabel =
        typeof input.timeoutMinutes === "number" && input.timeoutMinutes > 0
          ? formatMinutesDuration(input.timeoutMinutes)
          : null;
      return {
        reason: "inactivity",
        tone: "warning",
        badge: "Inactivity timeout",
        title: input.title ?? "Signed out due to inactivity",
        message:
          input.message ??
          (durationLabel
            ? `You were automatically signed out after ${durationLabel} without user activity to protect LGU data.`
            : "You were automatically signed out due to inactivity to protect LGU data."),
        detail:
          input.detail ??
          "Any active server-side AI job will continue running — sign back in to view its result.",
        occurredAt,
      };
    }

    case "manual_warning":
      return {
        reason: "manual_warning",
        tone: "info",
        badge: "Signed out",
        title: input.title ?? "You’ve been signed out",
        message:
          input.message ??
          "You chose to sign out from the session timeout warning before your session expired.",
        detail:
          input.detail ??
          "Your local workspace cache has been cleared. Sign back in anytime with your official account.",
        occurredAt,
      };

    case "manual":
      return {
        reason: "manual",
        tone: "info",
        badge: "Signed out",
        title: input.title ?? "You’ve been signed out",
        message:
          input.message ??
          "You signed out of your eFlow account safely and your local workspace cache has been cleared.",
        detail:
          input.detail ??
          "Sign back in whenever you’re ready to resume work.",
        occurredAt,
      };

    case "deactivated":
      return {
        reason: "deactivated",
        tone: "danger",
        badge: "Account deactivated",
        title: input.title ?? "Your account was deactivated",
        message:
          input.message ??
          "An administrator deactivated your eFlow account, so your active session was signed out immediately.",
        detail:
          input.detail ??
          "Contact your LGU System Admin if you believe this was a mistake or need your access restored.",
        occurredAt,
      };

    case "session_expired":
      return {
        reason: "session_expired",
        tone: "warning",
        badge: "Session ended",
        title: input.title ?? "Your session has ended",
        message:
          input.message ??
          "Your sign-in session expired or was ended from another tab or device.",
        detail:
          input.detail ??
          "Please sign in again to continue working safely.",
        occurredAt,
      };

    default:
      return {
        reason: "other",
        tone: "info",
        badge: "Signed out",
        title: input.title ?? "You were signed out",
        message:
          input.message ??
          "Your eFlow session was closed. Please sign in again to continue.",
        detail: input.detail,
        occurredAt,
      };
  }
}

export function parseLogoutNotice(raw: string | null): LogoutNotice | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Partial<LogoutNotice> | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.title === "string" &&
      typeof parsed.message === "string" &&
      parsed.title.trim() &&
      parsed.message.trim()
    ) {
      const reason: LogoutReason =
        parsed.reason && VALID_REASONS.has(parsed.reason) ? parsed.reason : "other";
      const fallback = buildLogoutNotice({ reason });
      const tone: LogoutNoticeTone =
        parsed.tone && VALID_TONES.has(parsed.tone) ? parsed.tone : fallback.tone;
      return {
        reason,
        tone,
        badge: typeof parsed.badge === "string" && parsed.badge.trim() ? parsed.badge.trim() : fallback.badge,
        title: parsed.title.trim(),
        message: parsed.message.trim(),
        detail: typeof parsed.detail === "string" && parsed.detail.trim() ? parsed.detail.trim() : undefined,
        occurredAt:
          typeof parsed.occurredAt === "number" && Number.isFinite(parsed.occurredAt)
            ? parsed.occurredAt
            : Date.now(),
      };
    }
  } catch {
    // Legacy plain-text notice fallback below
  }

  if (/inactiv/i.test(trimmed)) {
    return buildLogoutNotice({ reason: "inactivity", message: trimmed });
  }
  if (/deactivat/i.test(trimmed)) {
    return buildLogoutNotice({ reason: "deactivated", message: trimmed });
  }
  if (/expir|revok|ended/i.test(trimmed)) {
    return buildLogoutNotice({ reason: "session_expired", message: trimmed });
  }
  return buildLogoutNotice({ reason: "other", message: trimmed });
}

export function writeLogoutNotice(
  input: LogoutNoticeInput,
  storage?: Storage | null,
): LogoutNotice {
  const notice = buildLogoutNotice(input);
  const target = getSafeStorage(storage);
  if (target) {
    try {
      target.setItem(SESSION_NOTICE_KEY, JSON.stringify(notice));
    } catch {
      // Ignore storage quota / private mode failures
    }
  }
  if (storage === undefined) {
    dispatchLogoutNoticeChange();
  }
  return notice;
}

export function readLogoutNotice(storage?: Storage | null): LogoutNotice | null {
  const target = getSafeStorage(storage);
  if (!target) return null;
  try {
    const notice = parseLogoutNotice(target.getItem(SESSION_NOTICE_KEY));
    if (!notice || notice.reason === "manual" || notice.reason === "manual_warning") {
      return null;
    }
    return notice;
  } catch {
    return null;
  }
}

export function hasPendingLogoutNotice(storage?: Storage | null): boolean {
  return readLogoutNotice(storage) !== null;
}

export function clearLogoutNotice(storage?: Storage | null): void {
  const target = getSafeStorage(storage);
  if (target) {
    try {
      target.removeItem(SESSION_NOTICE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  if (storage === undefined) {
    dispatchLogoutNoticeChange();
  }
}

export function formatLogoutTimestamp(timestampMs: number): string {
  try {
    const date = new Date(timestampMs);
    if (Number.isNaN(date.getTime())) return "";
    const datePart = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${datePart} · ${timePart}`;
  } catch {
    return "";
  }
}
