// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EflowVibeThemeProvider } from "../../src/app/shared/vibe";

const storage = new Map<string, string>();
const storageMock = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, String(value)),
};

Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storageMock });
Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock });

const auth = vi.hoisted(() => ({
  clearError: vi.fn(),
  login: vi.fn(async () => undefined),
  register: vi.fn(async () => undefined),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ ...auth, error: null }),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ count: 1, error: null }),
        }),
      }),
    }),
  },
}));

import { LoginPage } from "../../src/app/components/Auth/LoginPage";

describe("Phase 02 auth presentation", () => {
  afterEach(() => cleanup());

  it("uses Vibe inputs while retaining the existing login automation identifiers and submit behavior", async () => {
    render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(document.querySelector("#login-email")).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector("#login-password")).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector("#login-submit")).toBeInstanceOf(HTMLButtonElement);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "employee@eflow.gov.ph" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.login).toHaveBeenCalledWith("employee@eflow.gov.ph", "safe-password");
    expect(screen.getByText("Government work, connected.")).toBeTruthy();
  });

  it("opens the Usage scenarios menu and filters scenarios between client (/) and admin (/admin) portals", async () => {
    window.history.replaceState({}, "", "/");
    const { unmount } = render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose a development account" }));

    expect(screen.queryByRole("menuitem", { name: "Admin — admin@gmail.com" })).toBeNull();
    const headAccount = await screen.findByRole("menuitem", { name: "Cheryl Gallo — bplo.head@gmail.com" });
    expect(headAccount).toBeTruthy();
    unmount();

    window.history.replaceState({}, "", "/admin");
    render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow Admin" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose a development account" }));

    expect(screen.queryByRole("menuitem", { name: "Cheryl Gallo — bplo.head@gmail.com" })).toBeNull();
    const superAdmin = await screen.findByRole("menuitem", { name: "Admin — admin@gmail.com" });
    expect(superAdmin).toBeTruthy();
    auth.login.mockClear();
    fireEvent.click(superAdmin);
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("admin@gmail.com", "admin123"));
    window.history.replaceState({}, "", "/");
  });
});
