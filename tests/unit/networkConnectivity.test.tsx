// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";
import { LoadingScreen } from "../../src/app/features/app-shell/LoadingScreen";
import { ViewLoadingState } from "../../src/app/components/ui/ViewLoadingState";
import { WorkspaceRecoveryState } from "../../src/app/features/app-shell/components/WorkspaceRecoveryState";
import {
  ProjectViewLoading,
  ProjectWorkspaceSkeleton,
} from "../../src/app/components/workflow/ProjectWorkspaceSkeleton";
import {
  NETWORK_ERROR_MESSAGE,
  userFacingError,
} from "../../src/app/shared/userFacingError";
import {
  SLOW_CONNECTION_THRESHOLD_MS,
  installConnectivityMonitor,
  resetConnectivityForTests,
} from "../../src/app/shared/networkConnectivity";

vi.mock("../../src/app/shared/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("../../src/app/contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ theme: "light" }),
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    userProfile: {
      avatar_path: null,
      departmentId: "office-1",
      fullName: "Cheryl Gallo",
      role: "head",
    },
    logout: vi.fn(),
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
  MessagesButton: () => <button type="button">Chat</button>,
}));
vi.mock("../../src/app/features/guided-tours", () => ({
  WorkspaceHelpMenu: () => <button type="button">Help</button>,
}));

import { EflowTopBar } from "../../src/app/features/app-shell/components/EflowTopBar";

const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

beforeEach(() => {
  setNavigatorOnline(true);
  resetConnectivityForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalOnLineDescriptor) {
    Object.defineProperty(Navigator.prototype, "onLine", originalOnLineDescriptor);
  }
  resetConnectivityForTests();
});

describe("networkConnectivity & offline/slow UI states", () => {
  it("replaces 'Getting things done' with 'No internet connection' and Retry when offline", () => {
    setNavigatorOnline(false);
    resetConnectivityForTests();

    const { container } = render(<LoadingScreen />);
    expect(screen.getByRole("heading", { name: "No internet connection" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Getting things done" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(container.querySelector(".eflow-loading--offline")).toBeTruthy();
  });

  it("updates LoadingScreen and ViewLoadingState dynamically on offline/online events", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("heading", { name: "Getting things done" })).toBeVisible();

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("heading", { name: "No internet connection" })).toBeVisible();

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByRole("heading", { name: "Getting things done" })).toBeVisible();

    cleanup();
    const view = render(<ViewLoadingState />);
    expect(screen.getByRole("status", { name: "Getting things done" })).toBeVisible();

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status", { name: "No internet connection" })).toBeVisible();
    expect(screen.getByText("No internet connection")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(view.container.querySelector(".eflow-view-loading--offline")).toBeTruthy();
  });

  it("switches LoadingScreen and ViewLoadingState to 'Slow internet' only when a monitored request is slow, not from a local timer", async () => {
    vi.useFakeTimers();
    let resolveSlow!: (res: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        }),
    );
    window.fetch = fetchMock as typeof fetch;
    installConnectivityMonitor();

    const { container } = render(<LoadingScreen />);
    expect(screen.getByRole("heading", { name: "Getting things done" })).toBeVisible();

    //Without an in-flight slow request, elapsed time alone must NOT spam "Slow internet".
    act(() => {
      vi.advanceTimersByTime(SLOW_CONNECTION_THRESHOLD_MS + 1000);
    });
    expect(screen.getByRole("heading", { name: "Getting things done" })).toBeVisible();
    expect(container.querySelector(".eflow-loading--slow")).toBeNull();

    // When a real monitored request stalls past SLOW_CONNECTION_THRESHOLD_MS, show "Slow internet".
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
    const pendingRemote = window.fetch(`${baseUrl}/rest/v1/tasks`);
    act(() => {
      vi.advanceTimersByTime(SLOW_CONNECTION_THRESHOLD_MS + 10);
    });
    expect(screen.getByRole("heading", { name: "Slow internet connection" })).toBeVisible();
    expect(container.querySelector(".eflow-loading--slow")).toBeTruthy();

    cleanup();
    const view = render(<ViewLoadingState />);
    expect(screen.getByRole("status", { name: "Slow internet connection" })).toBeVisible();
    expect(screen.getByText("Slow internet")).toBeVisible();
    expect(view.container.querySelector(".eflow-view-loading--slow")).toBeTruthy();

    // Completing the slow request immediately clears the "Slow internet" state.
    await act(async () => {
      resolveSlow(new Response("[]", { status: 200 }));
      await pendingRemote;
    });
    expect(screen.getByRole("status", { name: "Getting things done" })).toBeVisible();
    expect(view.container.querySelector(".eflow-view-loading--slow")).toBeNull();
  });

  it("shows topbar signal indicator beside Help with red downward accent when offline and clears on retry", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    window.fetch = fetchMock as typeof fetch;

    const { container } = render(
      <EflowVibeThemeProvider preference="light">
        <EflowTopBar
          onOpenMobileNavigation={() => undefined}
          onPageSelect={() => undefined}
          role="head"
          helpOpen={false}
          onHelpOpenChange={() => undefined}
        />
      </EflowVibeThemeProvider>,
    );

    expect(container.querySelector(".eflow-topbar--offline")).toBeNull();
    expect(screen.queryByText("No internet")).toBeNull();

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(container.querySelector(".eflow-topbar--offline")).toBeTruthy();
    const signalButton = screen.getByRole("status", {
      name: "No internet connection. Click to retry.",
    });
    expect(signalButton).toHaveClass("eflow-topbar__connectivity--offline");
    expect(signalButton).toHaveTextContent("No internet");

    // Ensure it sits directly before Help in the utilities container.
    const utilities = container.querySelector(".eflow-topbar__utilities");
    expect(utilities?.firstElementChild).toBe(signalButton);

    setNavigatorOnline(true);
    fireEvent.click(signalButton);
    await waitFor(() => {
      expect(container.querySelector(".eflow-topbar--offline")).toBeNull();
      expect(screen.queryByText("No internet")).toBeNull();
    });
  });

  it("ignores local gateway/Vite failures while detecting real remote slow & offline states", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/controlpanelEflow/")) {
        throw new TypeError("Failed to fetch");
      }
      return new Response(null, { status: 200 });
    });
    window.fetch = fetchMock as typeof fetch;

    installConnectivityMonitor();

    const { container } = render(
      <EflowVibeThemeProvider preference="light">
        <EflowTopBar
          onOpenMobileNavigation={() => undefined}
          onPageSelect={() => undefined}
          role="head"
          helpOpen={false}
          onHelpOpenChange={() => undefined}
        />
      </EflowVibeThemeProvider>,
    );

    // Local gateway error must not show "No internet".
    await expect(window.fetch("http://127.0.0.1:8322/controlpanelEflow/api/health")).rejects.toThrow();
    expect(container.querySelector(".eflow-topbar--offline")).toBeNull();

    // Slow monitored request triggers "Slow internet".
    let resolveSlow!: (res: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        }),
    );
    const pendingRemote = window.fetch(`${import.meta.env.VITE_SUPABASE_URL || window.location.origin}/rest/v1/tasks`);
    act(() => {
      vi.advanceTimersByTime(SLOW_CONNECTION_THRESHOLD_MS + 10);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeTruthy();
    expect(screen.getByText("Slow internet")).toBeVisible();

    // Fast subsequent completion restores healthy state.
    await act(async () => {
      resolveSlow(new Response("[]", { status: 200 }));
      await pendingRemote;
    });
    await act(async () => {
      await window.fetch(`${import.meta.env.VITE_SUPABASE_URL || window.location.origin}/rest/v1/tasks`);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeNull();
  });

  it("does not flicker when fast sibling requests finish during a slow request, and ignores uploads or hidden tabs", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    window.fetch = fetchMock as typeof fetch;

    installConnectivityMonitor();

    const { container } = render(
      <EflowVibeThemeProvider preference="light">
        <EflowTopBar
          onOpenMobileNavigation={() => undefined}
          onPageSelect={() => undefined}
          role="head"
          helpOpen={false}
          onHelpOpenChange={() => undefined}
        />
      </EflowVibeThemeProvider>,
    );

    const baseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin;

    // 1. Storage/upload requests taking >3.5s must not flash "Slow internet".
    let resolveUpload!: (res: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveUpload = resolve; }),
    );
    const pendingUpload = window.fetch(`${baseUrl}/storage/v1/object/receipts/test.pdf`);
    act(() => {
      vi.advanceTimersByTime(SLOW_CONNECTION_THRESHOLD_MS + 100);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeNull();
    await act(async () => {
      resolveUpload(new Response("{}", { status: 200 }));
      await pendingUpload;
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeNull();

    // 2. While a monitored request is still stalled, a fast sibling fetch must not flicker slow -> online.
    let resolveSlow!: (res: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveSlow = resolve; }),
    );
    const pendingRest = window.fetch(`${baseUrl}/rest/v1/tasks`);
    act(() => {
      vi.advanceTimersByTime(SLOW_CONNECTION_THRESHOLD_MS + 10);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeTruthy();

    await act(async () => {
      await window.fetch(`${baseUrl}/rest/v1/profiles`);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeTruthy();

    await act(async () => {
      resolveSlow(new Response("[]", { status: 200 }));
      await pendingRest;
      await window.fetch(`${baseUrl}/rest/v1/tasks`);
    });
    expect(container.querySelector(".eflow-topbar--slow")).toBeNull();
  });

  it("sanitizes TypeError: Failed to fetch and renders the redesigned WorkspaceRecoveryState", async () => {
    expect(userFacingError(new TypeError("Failed to fetch"), "fallback")).toBe(NETWORK_ERROR_MESSAGE);
    expect(userFacingError("TypeError: Failed to fetch", "fallback")).toBe(NETWORK_ERROR_MESSAGE);

    const onRetry = vi.fn(async () => undefined);
    render(<WorkspaceRecoveryState error="TypeError: Failed to fetch" onRetry={onRetry} />);

    expect(screen.queryByText(/TypeError: Failed to fetch/i)).toBeNull();
    expect(screen.getByRole("heading", { name: "No internet connection" })).toBeVisible();
    expect(screen.getByText(NETWORK_ERROR_MESSAGE)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });

  it("renders the redesigned All projects portfolio skeleton layout", () => {
    const { container } = render(<ProjectViewLoading view="index" />);
    expect(screen.getByRole("status", { name: "Loading project view" })).toBeVisible();
    expect(container.querySelector('[data-project-loading-view="index"]')).toBeTruthy();
    expect(container.querySelectorAll(".eflow-project-index-skeleton__filter")).toHaveLength(4);
    expect(container.querySelectorAll(".eflow-project-index-skeleton__row")).toHaveLength(4);

    cleanup();
    const standalone = render(<ProjectWorkspaceSkeleton view="index" />);
    expect(standalone.container.querySelector(".eflow-project-index-skeleton__table")).toBeTruthy();
  });
});
