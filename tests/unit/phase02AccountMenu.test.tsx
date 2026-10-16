// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

const account = vi.hoisted(() => ({ logout: vi.fn(), theme: "light", systemDark: false }));

// Account menu fixture represents a desktop viewport.
vi.mock("../../src/app/shared/useMediaQuery", () => ({ useMediaQuery: () => account.systemDark }));
vi.mock("../../src/app/contexts/UserPreferencesContext", () => ({ useUserPreferences: () => ({ theme: account.theme }) }));

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
  WorkspaceHelpMenu: () => <button type="button">Help</button>,
}));

import { EflowTopBar } from "../../src/app/features/app-shell/components/EflowTopBar";

describe("Phase 02 account utility", () => {
  it.each([
    ["light", false, "#01006B"],
    ["light", true, "#01006B"],
    ["dark", false, "#ffffff"],
    ["dark", true, "#ffffff"],
    ["system", false, "#01006B"],
    ["system", true, "#ffffff"],
  ])("keeps the existing wordmark readable for %s with system dark %s", (theme, systemDark, color) => {
    account.theme = String(theme); account.systemDark = Boolean(systemDark);
    const view = render(<EflowVibeThemeProvider preference="light"><EflowTopBar onOpenMobileNavigation={() => undefined} onPageSelect={() => undefined} role="head" helpOpen={false} onHelpOpenChange={() => undefined} /></EflowVibeThemeProvider>);
    expect(view.container.querySelector('.eflow-topbar__wordmark svg path')?.getAttribute('fill')).toBe(color);
    view.unmount(); account.theme = "light"; account.systemDark = false;
  });

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
          helpOpen={false}
          onHelpOpenChange={() => undefined}
        />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByText("Head")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "Open account menu" }), { key: "ArrowDown" });

    const settings = await screen.findByRole("menuitem", { name: "Settings" });
    fireEvent.mouseEnter(settings);
    fireEvent.click(settings);
    await waitFor(() => expect(onPageSelect).toHaveBeenCalledWith("settings", "Appearance"));

    fireEvent.keyDown(screen.getByRole("button", { name: "Open account menu" }), { key: "ArrowDown" });
    const profile = await screen.findByRole("menuitem", { name: "Profile" });
    fireEvent.mouseEnter(profile);
    fireEvent.click(profile);
    await waitFor(() => expect(onPageSelect).toHaveBeenCalledWith("settings", "Profile"));

    fireEvent.keyDown(screen.getByRole("button", { name: "Open account menu" }), { key: "ArrowDown" });
    const logout = await screen.findByRole("menuitem", { name: "Log out" });
    fireEvent.mouseEnter(logout);
    fireEvent.click(logout);
    await waitFor(() => expect(account.logout).toHaveBeenCalledOnce());
  });
});
