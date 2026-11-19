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

  it("renders separate client (/) and admin (/admin) portal headers without Usage scenarios", () => {
    window.history.replaceState({}, "", "/");
    const { unmount } = render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Choose a development account|Usage scenarios/i })).toBeNull();
    expect(document.querySelector("#quick-login-picker")).toBeNull();
    unmount();

    window.history.replaceState({}, "", "/admin");
    render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to eFlow Admin" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Choose a development account|Usage scenarios/i })).toBeNull();
    expect(document.querySelector("#quick-login-picker")).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});
