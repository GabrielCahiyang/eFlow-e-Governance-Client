// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  renderHook,
  act,
} from "@testing-library/react";
const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  manage: true,
  role: "admin",
  blocker: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: api.rpc, from: api.from },
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "actor" },
    userProfile: { role: api.role },
    can: (p: string) => (p === "settings.manage" ? api.manage : true),
  }),
}));
vi.mock("../../src/app/shared/navigationGuard", () => ({
  useNavigationBlocker: api.blocker,
  requestNavigation: (fn: () => void) => fn(),
}));
vi.mock(
  "../../src/app/features/administration/components/user-management",
  () => ({ UserManagement: () => <div>Retained people tools</div> }),
);
vi.mock("../../src/app/features/administration/components/data-tools", () => ({
  BackupExportWorkspace: () => <div>Retained backup tools</div>,
}));
vi.mock("../../src/app/features/organization", () => ({
  OrgTreeBuilder: () => <div>Retained Office tools</div>,
}));
vi.mock("../../src/app/features/audit", () => ({
  AdminAuditLog: () => <div>Retained audit tools</div>,
}));
vi.mock("../../src/app/shared/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));
vi.mock("../../src/app/features/ai", () => ({
  useAiRuntimeStatus: () => ({ status: "unknown", endpoint: "" }),
}));
import { ApplicationSettings } from "../../src/app/features/administration/configuration/ApplicationSettings";
import { AdministrationWorkspace } from "../../src/app/features/administration/components/AdministrationWorkspace";
import { usePresentationBranding } from "../../src/app/features/administration/configuration/usePresentationBranding";
import {
  validatePresentationSettings,
  fetchPresentationSettings,
} from "../../src/app/features/administration/configuration/settingsService";
import {
  resolveSupportPage,
  getAuthorizedSupportPages,
} from "../../src/app/features/navigation/administrativePages";
let config: { key: string; value: string }[];
beforeEach(() => {
  api.manage = true;
  api.role = "admin";
  api.rpc.mockReset();
  api.blocker.mockClear();
  config = [
    { key: "organization_name", value: "Original City" },
    { key: "app_version", value: "2.0" },
  ];
  api.from.mockImplementation(() => ({
    select: () => ({
      in: () => Promise.resolve({ data: config, error: null }),
    }),
  }));
  api.rpc.mockImplementation(async (_name: string, p: any) => ({
    data: p.p_values,
    error: null,
  }));
});
afterEach(cleanup);
describe("R12 effective administration", () => {
  it("retains nine categories and resolves support aliases without widening access", () => {
    render(<AdministrationWorkspace />);
    expect(screen.getAllByRole("tab")).toHaveLength(9);
    for (const name of [
      "People & onboarding",
      "Offices & leadership",
      "Roles & permissions",
      "Workspaces & project access policy",
      "Application settings",
      "Email & integrations",
      "Runtime / AI health",
      "Audit",
      "Backup & export",
    ])
      expect(screen.getByRole("tab", { name, exact: true })).toBeTruthy();
    expect(resolveSupportPage("administration", "Email & Integrations")).toBe(
      "Email & Integrations",
    );
    expect(resolveSupportPage("administration")).toBe("System Settings");
    expect(getAuthorizedSupportPages("member", () => false)).toHaveLength(0);
    expect(
      getAuthorizedSupportPages("member", () => true).some(
        (x) => x.label === "Role Defaults",
      ),
    ).toBe(false);
  });
  it("saves only validated presentation keys and documents dormant session/timezone controls", async () => {
    render(<ApplicationSettings />);
    await screen.findByDisplayValue("Original City");
    expect(screen.queryByLabelText("Session Timeout (minutes)")).toBeNull();
    expect(
      screen.getByText(
        "The stored session_timeout_minutes value does not expire sessions. Supabase Auth controls token/session lifetimes; no local timer is advertised as server revocation.",
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Organization Name/), {
      target: { value: "New City" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByText(/Presentation settings saved and audited/);
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.rpc.mock.calls[0][1]).toMatchObject({
      p_values: { organization_name: "New City", app_version: "2.0" },
      p_expected: { organization_name: "Original City", app_version: "2.0" },
    });
  });
  it("keeps the same uncertain request and locks editing until verification succeeds", async () => {
    api.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Transport unavailable", code: "" },
    });
    render(<ApplicationSettings />);
    await screen.findByDisplayValue("Original City");
    fireEvent.change(screen.getByLabelText(/Organization Name/), {
      target: { value: "New City" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByRole("button", { name: "Verify settings save" });
    expect(
      (screen.getByLabelText(/Organization Name/) as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Verify settings save" }),
    );
    await screen.findByText(/saved and audited/);
    expect(api.rpc.mock.calls[1][1]).toEqual(api.rpc.mock.calls[0][1]);
  });
  it("allows a known rejected edit to be corrected and retries unavailable reads", async () => {
    api.from.mockImplementationOnce(() => ({
      select: () => ({
        in: () =>
          Promise.resolve({ data: null, error: { message: "offline" } }),
      }),
    }));
    render(<ApplicationSettings />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry settings" }),
    );
    await screen.findByDisplayValue("Original City");
    api.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "Settings changed. Reload." },
    });
    fireEvent.change(screen.getByLabelText(/Organization Name/), {
      target: { value: "Draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByText("Settings changed. Reload.");
    expect(
      (screen.getByLabelText(/Organization Name/) as HTMLInputElement).disabled,
    ).toBe(false);
  });
  it("makes view-only support read-only and protects dirty drafts", async () => {
    api.manage = false;
    render(<ApplicationSettings />);
    await screen.findByDisplayValue("Original City");
    expect(
      (screen.getByLabelText(/Organization Name/) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(api.rpc).not.toHaveBeenCalled();
    cleanup();
    api.manage = true;
    render(<ApplicationSettings />);
    await screen.findByDisplayValue("Original City");
    fireEvent.change(screen.getByLabelText(/Organization Name/), {
      target: { value: "Draft" },
    });
    expect(api.blocker.mock.lastCall?.[0].dirty).toBe(true);
  });
  it("rejects invalid values before writing and limits reads to the public allowlist", async () => {
    for (const app_version of ["<script>", "x".repeat(41), ""])
      expect(() =>
        validatePresentationSettings({
          organization_name: "City",
          app_version,
        }),
      ).toThrow();
    expect(() =>
      validatePresentationSettings({
        organization_name: "\nCity",
        app_version: "2",
      }),
    ).toThrow();
    config.push({ key: "smtp_password", value: "secret" });
    expect(await fetchPresentationSettings()).toEqual({
      organization_name: "Original City",
      app_version: "2.0",
    });
  });
  it("refreshes branding after confirmed save and clears actor-scoped state", async () => {
    const hook = renderHook(({ actor }) => usePresentationBranding(actor), {
      initialProps: { actor: "one" },
    });
    await waitFor(() =>
      expect(hook.result.current.organization_name).toBe("Original City"),
    );
    config[0].value = "Changed City";
    act(() =>
      window.dispatchEvent(new Event("eflow-presentation-settings-changed")),
    );
    await waitFor(() =>
      expect(hook.result.current.organization_name).toBe("Changed City"),
    );
    hook.rerender({ actor: "two" });
    expect(hook.result.current.organization_name).toBe("LGU Ormoc City");
  });
});
