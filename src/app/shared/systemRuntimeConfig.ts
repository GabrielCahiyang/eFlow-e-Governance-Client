export interface RuntimeSystemSettings {
  organizationName: string;
  organizationSubtitle: string;
  supportEmail: string;
  dueSoonDays: number;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
  sessionIdleTimeoutMinutes: number;
  sessionWarningLeadMinutes: number;
}

export interface SessionSecurityPolicy {
  idleTimeoutMinutes: number;
  warningLeadMinutes: number;
  timeoutMs: number;
  warningLeadMs: number;
}

export const SESSION_IDLE_TIMEOUT_MIN_MINUTES = 5;
export const SESSION_IDLE_TIMEOUT_MAX_MINUTES = 480;
export const SESSION_WARNING_LEAD_MIN_MINUTES = 1;
export const SESSION_WARNING_LEAD_MAX_MINUTES = 30;
export const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 60;
export const DEFAULT_SESSION_WARNING_LEAD_MINUTES = 5;

let runtimeConfig: RuntimeSystemSettings = {
  organizationName: "LEDIPO",
  organizationSubtitle: "",
  supportEmail: "",
  dueSoonDays: 3,
  maintenanceBannerEnabled: false,
  maintenanceBannerMessage: "",
  sessionIdleTimeoutMinutes: DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES,
  sessionWarningLeadMinutes: DEFAULT_SESSION_WARNING_LEAD_MINUTES,
};

const listeners = new Set<() => void>();

function normalizeSessionMinutes(
  timeoutCandidate: number | undefined,
  warningCandidate: number | undefined,
  fallbackTimeout: number,
  fallbackWarning: number,
): { timeout: number; warning: number } {
  const timeout =
    typeof timeoutCandidate === "number" &&
    Number.isInteger(timeoutCandidate) &&
    timeoutCandidate >= SESSION_IDLE_TIMEOUT_MIN_MINUTES &&
    timeoutCandidate <= SESSION_IDLE_TIMEOUT_MAX_MINUTES
      ? timeoutCandidate
      : fallbackTimeout;

  let warning =
    typeof warningCandidate === "number" &&
    Number.isInteger(warningCandidate) &&
    warningCandidate >= SESSION_WARNING_LEAD_MIN_MINUTES &&
    warningCandidate <= SESSION_WARNING_LEAD_MAX_MINUTES
      ? warningCandidate
      : fallbackWarning;

  if (warning >= timeout) {
    warning = Math.max(SESSION_WARNING_LEAD_MIN_MINUTES, Math.min(SESSION_WARNING_LEAD_MAX_MINUTES, timeout - 1));
  }

  return { timeout, warning };
}

export function setRuntimeSystemSettings(next: Partial<RuntimeSystemSettings>): void {
  const sessionMinutes = normalizeSessionMinutes(
    next.sessionIdleTimeoutMinutes,
    next.sessionWarningLeadMinutes,
    runtimeConfig.sessionIdleTimeoutMinutes,
    runtimeConfig.sessionWarningLeadMinutes,
  );

  runtimeConfig = {
    ...runtimeConfig,
    ...next,
    dueSoonDays:
      typeof next.dueSoonDays === "number" && Number.isFinite(next.dueSoonDays) && next.dueSoonDays >= 1
        ? next.dueSoonDays
        : runtimeConfig.dueSoonDays,
    sessionIdleTimeoutMinutes: sessionMinutes.timeout,
    sessionWarningLeadMinutes: sessionMinutes.warning,
  };

  for (const listener of listeners) {
    listener();
  }
}

export function subscribeRuntimeSystemSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDueSoonWindowDays(): number {
  return runtimeConfig.dueSoonDays;
}

export function getSessionSecurityPolicy(): SessionSecurityPolicy {
  return {
    idleTimeoutMinutes: runtimeConfig.sessionIdleTimeoutMinutes,
    warningLeadMinutes: runtimeConfig.sessionWarningLeadMinutes,
    timeoutMs: runtimeConfig.sessionIdleTimeoutMinutes * 60 * 1000,
    warningLeadMs: runtimeConfig.sessionWarningLeadMinutes * 60 * 1000,
  };
}

export function formatMinutesDuration(minutes: number): string {
  const safe = Math.max(1, Math.round(minutes));
  if (safe < 60) {
    return `${safe} ${safe === 1 ? "minute" : "minutes"}`;
  }
  const hours = Math.floor(safe / 60);
  const rem = safe % 60;
  const hourLabel = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (rem === 0) return hourLabel;
  return `${hourLabel} ${rem} ${rem === 1 ? "minute" : "minutes"}`;
}

export function getExportBrandHeader(): string {
  const org = runtimeConfig.organizationName.trim();
  const sub = runtimeConfig.organizationSubtitle.trim();
  if (org && sub) return `eFlow · ${org} — ${sub}`;
  if (org) return `eFlow · ${org}`;
  return "eFlow";
}
