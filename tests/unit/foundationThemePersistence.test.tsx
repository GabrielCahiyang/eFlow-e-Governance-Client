// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UserPreferencesProvider, useUserPreferences } from "../../src/app/contexts/UserPreferencesContext";

const settings = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock("../../src/app/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "fixture" } }) }));
vi.mock("../../src/app/services/userSettingsService", () => ({
  fetchUserPreferences: settings.fetch,
  upsertUserPreferences: settings.save,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});

it("defaults to light appearance, never activates dark mode, and rolls back a rejected preference save", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  settings.fetch.mockResolvedValue(null);
  settings.save.mockImplementation(async (_id, patch) => ({ user_id: "fixture", ...patch }));

  function Fixture() {
    const { theme, setTheme, error } = useUserPreferences();
    return (
      <>
        <output>{theme}</output>
        {["dark", "light", "system"].map((value) => (
          <button key={value} onClick={() => void setTheme(value as "light" | "dark" | "system").catch(() => {})}>
            {value}
          </button>
        ))}
        {error && <p role="alert">{error}</p>}
      </>
    );
  }

  render(
    <UserPreferencesProvider>
      <Fixture />
    </UserPreferencesProvider>,
  );

  await waitFor(() => expect(screen.getByText("light", { selector: "output" })).toBeTruthy());
  expect(settings.save).toHaveBeenCalledWith("fixture", { theme: "light" });
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(document.documentElement.dataset.theme).toBe("light");

  fireEvent.click(screen.getByRole("button", { name: "dark" }));
  await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
  expect(document.documentElement.dataset.theme).toBe("light");

  fireEvent.click(screen.getByRole("button", { name: "system" }));
  await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
  expect(screen.getByText("light", { selector: "output" })).toBeTruthy();

  settings.save.mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "light" }));
  await screen.findByRole("alert");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  vi.unstubAllGlobals();
});
