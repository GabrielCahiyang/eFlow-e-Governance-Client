import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllSessionActivity,
  clearLogoutNotice,
  clearSessionActivity,
  formatLogoutTimestamp,
  formatRemainingTime,
  getInactivityState,
  getSessionActivityStorageKey,
  hasPendingLogoutNotice,
  isMeaningfulKeyboardEvent,
  parseLogoutNotice,
  readLogoutNotice,
  SESSION_NOTICE_KEY,
  writeLogoutNotice,
} from "../../src/app/features/session-security";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  } as Storage;
}

describe("session inactivity policy", () => {
  let storage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T09:00:00+08:00"));
    storage = createMemoryStorage();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns at 55 minutes and expires at 60 minutes", () => {
    const startedAt = Date.now();
    expect(getInactivityState(startedAt, Date.now(), 3_600_000, 300_000).phase).toBe("active");
    vi.advanceTimersByTime(55 * 60 * 1000);
    expect(getInactivityState(startedAt, Date.now(), 3_600_000, 300_000)).toMatchObject({ phase: "warning", remainingMs: 300_000 });
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(getInactivityState(startedAt, Date.now(), 3_600_000, 300_000).phase).toBe("expired");
  });

  it("formats an accessible countdown", () => {
    expect(formatRemainingTime(299_001)).toBe("5:00");
    expect(formatRemainingTime(61_000)).toBe("1:01");
  });

  it("ignores modifier-only and repeated key events", () => {
    expect(isMeaningfulKeyboardEvent({ key: "Shift", repeat: false })).toBe(false);
    expect(isMeaningfulKeyboardEvent({ key: "a", repeat: true })).toBe(false);
    expect(isMeaningfulKeyboardEvent({ key: "a", repeat: false })).toBe(true);
  });

  it("clears an expired user's activity so a fresh login is not immediately expired", () => {
    const userId = "super-admin-id";
    const activityKey = getSessionActivityStorageKey(userId);
    storage.setItem(activityKey, String(Date.now() - 3_600_001));

    clearSessionActivity(storage, userId);

    expect(storage.getItem(activityKey)).toBeNull();
  });

  it("clears stale activity for quick switching without deleting unrelated preferences", () => {
    storage.setItem(getSessionActivityStorageKey("super-admin-id"), "1");
    storage.setItem(getSessionActivityStorageKey("employee-id"), "2");
    storage.setItem("eflow.theme", "dark");

    clearAllSessionActivity(storage);

    expect(storage.getItem(getSessionActivityStorageKey("super-admin-id"))).toBeNull();
    expect(storage.getItem(getSessionActivityStorageKey("employee-id"))).toBeNull();
    expect(storage.getItem("eflow.theme")).toBe("dark");
  });

  it("writes, reads, and clears structured logout reasons including inactivity and deactivation", () => {
    expect(hasPendingLogoutNotice(storage)).toBe(false);

    writeLogoutNotice({ reason: "inactivity", timeoutMinutes: 90 }, storage);
    expect(hasPendingLogoutNotice(storage)).toBe(true);
    expect(readLogoutNotice(storage)).toMatchObject({
      reason: "inactivity",
      tone: "warning",
      title: "Signed out due to inactivity",
      message: expect.stringContaining("1 hour 30 minutes"),
    });

    writeLogoutNotice({ reason: "deactivated" }, storage);
    expect(readLogoutNotice(storage)).toMatchObject({
      reason: "deactivated",
      tone: "danger",
      title: "Your account was deactivated",
    });

    clearLogoutNotice(storage);
    expect(hasPendingLogoutNotice(storage)).toBe(false);
    expect(storage.getItem(SESSION_NOTICE_KEY)).toBeNull();
  });

  it("parses legacy plain-text notices and formats logout timestamps in Philippine time", () => {
    const legacy = parseLogoutNotice("You were signed out after 1 hour of inactivity.");
    expect(legacy).toMatchObject({
      reason: "inactivity",
      tone: "warning",
      message: "You were signed out after 1 hour of inactivity.",
    });

    const formatted = formatLogoutTimestamp(Date.parse("2026-08-19T01:30:00Z"));
    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/9:30\s*AM/i);
  });
});
