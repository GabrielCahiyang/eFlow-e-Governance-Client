// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders separate client (/) and admin (/admin) portal headers with portal-scoped Usage scenarios", () => {
    window.history.replaceState({}, "", "/");
    const { unmount } = render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow" })).toBeTruthy();
    const clientPicker = screen.getByRole("button", { name: /Choose a development account/i });
    expect(clientPicker).toBeTruthy();
    expect(document.querySelector("#quick-login-picker")).toBeTruthy();
    fireEvent.click(clientPicker);
    expect(screen.getByRole("menuitem", { name: /jamessdrian12@gmail\.com/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /gabzcah@gmail\.com/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /kurtditch@gmail\.com/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /gabzcahv2@gmail\.com/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /admin@gmail\.com/i })).toBeNull();
    unmount();

    window.history.replaceState({}, "", "/admin");
    render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow Admin" })).toBeTruthy();
    const adminPicker = screen.getByRole("button", { name: /Choose a development account/i });
    expect(adminPicker).toBeTruthy();
    expect(document.querySelector("#quick-login-picker")).toBeTruthy();
    fireEvent.click(adminPicker);
    expect(screen.getByRole("menuitem", { name: /admin@gmail\.com/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /jamessdrian12@gmail\.com/i })).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});
