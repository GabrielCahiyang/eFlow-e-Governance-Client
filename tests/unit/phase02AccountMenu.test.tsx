// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

const account = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    userProfile: {
      avatar_path: null,
      departmentId: "office-1",
      fullName: "Ari Santos",
      role: "head",
    },
    logout: account.logout,
  }),
}));

vi.mock("../../src/app/services/userSettingsService", () => ({
  getProfileAvatarUrl: vi.fn(async () => null),
}));

vi.mock("../../src/app/components/ui/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

vi.mock("../../src/app/components/ui/IncomingCallListener", () => ({
  IncomingCallListener: () => null,
}));

vi.mock("../../src/app/features/chat-calls", () => ({
  ChatListDrawer: () => <button type="button">Chat</button>,
}));

vi.mock("../../src/app/features/guided-tours", () => ({
  PageWalkthroughButton: () => <button type="button">Walkthrough</button>,
  SystemWalkthroughButton: () => <button type="button">Start walkthrough</button>,
}));

import { EflowTopBar } from "../../src/app/features/app-shell/components/EflowTopBar";

describe("Phase 02 account utility", () => {
  it("shows human-readable account context and retains settings and logout actions", async () => {
    const onPageSelect = vi.fn();
    render(
      <EflowVibeThemeProvider preference="light">
        <EflowTopBar
          activePage="Dashboard"
          activeSection="dashboard"
          onOpenMobileNavigation={() => undefined}
          onPageSelect={onPageSelect}
          role="head"
        />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByText("Head")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));

    const settings = await screen.findByRole("menuitem", { name: "Settings" });
    fireEvent.mouseEnter(settings);
    fireEvent.click(settings);
    await waitFor(() => expect(onPageSelect).toHaveBeenCalledWith("settings", "Appearance"));

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const profile = await screen.findByRole("menuitem", { name: "Profile" });
    fireEvent.mouseEnter(profile);
    fireEvent.click(profile);
    await waitFor(() => expect(onPageSelect).toHaveBeenCalledWith("settings", "Profile"));

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const logout = await screen.findByRole("menuitem", { name: "Log out" });
    fireEvent.mouseEnter(logout);
    fireEvent.click(logout);
    await waitFor(() => expect(account.logout).toHaveBeenCalledOnce());
  });
});
