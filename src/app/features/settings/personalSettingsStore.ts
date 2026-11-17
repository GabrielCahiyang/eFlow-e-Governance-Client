export type DateDisplayFormat = "dmy" | "mdy" | "iso";
export type TimeDisplayFormat = "12h" | "24h";
export type WeekStartDay = "monday" | "sunday";
export type InterfaceDensity = "comfortable" | "compact";
export type MotionMode = "system" | "reduced";

export interface PersonalSettings {
  dateFormat: DateDisplayFormat;
  timeFormat: TimeDisplayFormat;
  weekStartsOn: WeekStartDay;
  density: InterfaceDensity;
  motion: MotionMode;
  defaultNotificationTab: "all" | "unread";
  defaultNotificationCategory: "all" | "reviews" | "assignments" | "finance";
}

export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  dateFormat: "dmy",
  timeFormat: "12h",
  weekStartsOn: "monday",
  density: "comfortable",
  motion: "system",
  defaultNotificationTab: "all",
  defaultNotificationCategory: "all",
};

const STORAGE_PREFIX = "eflow:personal-settings:v1:";

export function readPersonalSettings(userId?: string): PersonalSettings {
  if (!userId || typeof localStorage === "undefined") {
    return DEFAULT_PERSONAL_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return DEFAULT_PERSONAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PersonalSettings>;
    return { ...DEFAULT_PERSONAL_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PERSONAL_SETTINGS;
  }
}

export function applyDisplayPreferences(
  settings: Pick<PersonalSettings, "density" | "motion">,
): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = settings.density;
  document.documentElement.dataset.motion = settings.motion;
}

export function savePersonalSettings(
  userId: string | undefined,
  patch: Partial<PersonalSettings>,
): PersonalSettings {
  const next = { ...readPersonalSettings(userId), ...patch };
  applyDisplayPreferences(next);
  if (userId && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(next));
    } catch {
      // Non-fatal if storage quota is unavailable.
    }
  }
  return next;
}
