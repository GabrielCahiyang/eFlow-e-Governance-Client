import type { GuidedTourProgress } from "../types";

export const GUIDED_TOUR_VERSION = "2026.08-v1";

const emptyProgress = (): GuidedTourProgress => ({
  welcomed: false,
  systemCompleted: false,
  completedPages: [],
  voiceEnabled: false,
});

export function getGuidedTourStorageKey(userId: string, role: string): string {
  return `eflow:guided-tour:${GUIDED_TOUR_VERSION}:${userId}:${role}`;
}

export function readGuidedTourProgress(userId: string, role: string): GuidedTourProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const stored = window.localStorage.getItem(getGuidedTourStorageKey(userId, role));
    if (!stored) return emptyProgress();
    const parsed = JSON.parse(stored) as Partial<GuidedTourProgress>;
    return {
      welcomed: Boolean(parsed.welcomed),
      systemCompleted: Boolean(parsed.systemCompleted),
      completedPages: Array.isArray(parsed.completedPages) ? parsed.completedPages.filter((value): value is string => typeof value === "string") : [],
      voiceEnabled: Boolean(parsed.voiceEnabled),
      dismissedTours: Array.isArray(parsed.dismissedTours) ? parsed.dismissedTours.filter((value): value is string => typeof value === "string") : [],
      activeTour: parsed.activeTour,
    };
  } catch {
    return emptyProgress();
  }
}

export function writeGuidedTourProgress(userId: string, role: string, progress: GuidedTourProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getGuidedTourStorageKey(userId, role), JSON.stringify(progress));
  } catch {
    // The tour remains usable when storage is disabled; only resume is lost.
  }
}

export function getPageProgressKey(section: string, page?: string): string {
  return `${section}:${page || section}`;
}
