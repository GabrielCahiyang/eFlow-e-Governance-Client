import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from "./navigationHistory";

export const SKIP_LANDING_STORAGE_KEY = "eflow.skip_landing_page.v1";
export const LANDING_PREFERENCE_EVENT = "eflow:landing-preference-changed";

let allowLandingForCurrentRootVisit = false;

export function readSkipLandingPreference(): boolean {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(SKIP_LANDING_STORAGE_KEY) === "1";
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return false;
}

export function writeSkipLandingPreference(skip: boolean): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (skip) {
        window.localStorage.setItem(SKIP_LANDING_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(SKIP_LANDING_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage write errors in restricted environments
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LANDING_PREFERENCE_EVENT));
  }
}

export function isExplicitLandingVisitActive(): boolean {
  return allowLandingForCurrentRootVisit;
}

export function clearExplicitLandingVisit(): void {
  allowLandingForCurrentRootVisit = false;
}

/** Explicitly open the landing page at `/` even if the user enabled "Skip landing page". */
export function openLandingPageExplicitly(): void {
  allowLandingForCurrentRootVisit = true;
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/" || window.location.pathname === "") {
    window.dispatchEvent(new Event(NAVIGATION_LOCATION_EVENT));
  } else {
    pushNavigationHistory("/");
  }
}
