// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../src/app/contexts/authContextValue";
import { SessionSecurityProvider } from "../../src/app/features/session-security/SessionSecurityProvider";
import {
  buildLogoutNotice,
  clearLogoutNotice,
  readLogoutNotice,
} from "../../src/app/features/session-security/services/logoutNotice";
import { getSessionActivityStorageKey } from "../../src/app/features/session-security/services/sessionActivityStorage";
import { LogoutReasonModal } from "../../src/pages/Login/components/LogoutReasonModal";

function makeAuthValue(userId: string, logout = vi.fn(async () => undefined)): AuthContextValue {
  return {
    user: { id: userId } as AuthContextValue["user"],
    userProfile: null,
    loading: false,
    permissionsLoading: false,
    error: null,
    login: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    logout,
    updateUserProfile: vi.fn(),
    clearError: vi.fn(),
    can: () => false,
    permissions: new Set(),
  };
}

describe("LogoutReasonModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders inactivity timeout details on the Client login screen and dismisses on click", () => {
    const onDismiss = vi.fn();
    const notice = buildLogoutNotice({
      reason: "inactivity",
      timeoutMinutes: 60,
      occurredAt: Date.parse("2026-11-24T02:00:00Z"),
    });

    render(
      <LogoutReasonModal
        notice={notice}
        isAdminPortal={false}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Inactivity timeout")).toBeTruthy();
    expect(screen.getByText("Signed out due to inactivity")).toBeTruthy();
    expect(screen.getByText(/after 1 hour without user activity/i)).toBeTruthy();
    expect(screen.getByText(/eFlow ·/)).toBeTruthy();
    expect(screen.getByText(/10:00\s*AM/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue to sign in" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders account deactivation notice on the Admin portal and dismisses on Escape", () => {
    const onDismiss = vi.fn();
    const notice = buildLogoutNotice({
      reason: "deactivated",
      occurredAt: Date.parse("2026-11-24T02:00:00Z"),
    });

    render(
      <LogoutReasonModal
        notice={notice}
        isAdminPortal={true}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Account deactivated")).toBeTruthy();
    expect(screen.getByText("Your account was deactivated")).toBeTruthy();
    expect(screen.getByText(/eFlow Admin ·/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Understood" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when there is no logout notice", () => {
    const { container } = render(
      <LogoutReasonModal notice={null} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("SessionSecurityProvider fresh-open vs AFK behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T07:05:00+08:00"));
    localStorage.clear();
    sessionStorage.clear();
    clearLogoutNotice();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does NOT immediately log out on fresh site open when stale yesterday activity exists, but still expires after genuine AFK", async () => {
    const userId = "admin-user-1";
    const key = getSessionActivityStorageKey(userId);
    // Simulate stale activity left over from yesterday when the browser was closed
    const twelveHoursAgo = String(Date.now() - 12 * 60 * 60 * 1000);
    localStorage.setItem(key, twelveHoursAgo);
    sessionStorage.setItem(key, twelveHoursAgo);

    const logout = vi.fn(async () => undefined);
    render(
      <AuthContext.Provider value={makeAuthValue(userId, logout)}>
        <SessionSecurityProvider timeoutMs={60 * 60 * 1000} warningLeadMs={5 * 60 * 1000}>
          <div>Active Workspace</div>
        </SessionSecurityProvider>
      </AuthContext.Provider>,
    );

    // Must NOT kick out on initial open and must clean up stale localStorage key
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(readLogoutNotice()).toBeNull();

    // Still active at 54 minutes AFK
    act(() => {
      vi.advanceTimersByTime(54 * 60 * 1000);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    // Warning dialog appears at 55 minutes AFK
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Your session is about to expire")).toBeTruthy();
    expect(logout).not.toHaveBeenCalled();

    // Auto-expires after full 60 minutes AFK while open
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(logout).toHaveBeenCalledWith({ preserveNotice: true });
    expect(readLogoutNotice()).toMatchObject({
      reason: "inactivity",
      title: "Signed out due to inactivity",
    });
  });
});
