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
  phase2: vi.fn(),
  manage: true,
  role: "admin",
  blocker: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: api.rpc, from: api.from },
}));
vi.mock("../../src/app/shared/phase2Api", () => ({
  phase2Request: api.phase2,
  jsonRequest: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
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
  () => ({ UserManagement: ({initialTab}: {initialTab:string}) => <div>Retained people tools: {initialTab}</div> }),
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
  validateGeneralSystemSettings,
  fetchPresentationSettings,
  DEFAULT_GENERAL_SETTINGS,
} from "../../src/app/features/administration/configuration/settingsService";
import {
  getDueSoonWindowDays,
  getExportBrandHeader,
} from "../../src/app/shared/systemRuntimeConfig";
import {
  resolveSupportPage,
  resolveSupportSubTab,
  isSupportPageAuthorized,
  getAuthorizedSupportPages,
} from "../../src/app/features/navigation/administrativePages";
let config: { key: string; value: string }[];
beforeEach(() => {
  api.manage = true;
  api.role = "admin";
  api.rpc.mockReset();
  api.phase2.mockReset();
  api.blocker.mockClear();
  api.phase2.mockImplementation(async (path: string, init?: { body?: string }) => {
    if (path === "/auth/public-branding") {
      return {
        login_portal_title: "LGU Ormoc City",
        login_portal_subtitle: "Use your official LGU account.",
      };
    }
    if (path === "/admin/login-branding" && init?.body) {
      return JSON.parse(init.body);
    }
    return {};
  });
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
  it("retains authorized support leaves without a second destination selector", () => {
    render(<AdministrationWorkspace />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText('Retained people tools: users')).toBeTruthy();
    expect(getAuthorizedSupportPages('admin',()=>true).map(page=>page.label)).toEqual(['People & Accounts','Roles & Access','Account Audit','System & Maintenance','Backup & Export']);
    expect(resolveSupportPage("administration", "Email & Integrations")).toBe(
      "System & Maintenance",
    );
    expect(resolveSupportSubTab("administration", "Email & Integrations")).toBe("general");
    expect(resolveSupportPage("administration")).toBe("System & Maintenance");
    expect(getAuthorizedSupportPages("member", () => false)).toHaveLength(0);
    expect(
      getAuthorizedSupportPages("member", () => true).some(
        (x) => x.label === "Roles & Access",
      ),
    ).toBe(false);
  });
  it("keeps locked account management as its authorized leaf and restricts it to Admin", () => {
    render(<AdministrationWorkspace activePage="Locked out accounts" />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Retained people tools: locked-accounts")).toBeTruthy();
    expect(screen.queryByRole("group",{name:'People views'})).toBeNull();
    expect(resolveSupportPage("users","Locked out accounts")).toBe("People & Accounts");
    expect(resolveSupportSubTab("users","Locked out accounts")).toBe("locked-accounts");
    for(const role of ["head","member","accounting_staff"])
      expect(isSupportPageAuthorized(role,"users","Locked out accounts",()=>true)).toBe(false);
    expect(isSupportPageAuthorized("admin","users","Locked out accounts",()=>true)).toBe(true);
    cleanup();
    api.role="head";
    render(<AdministrationWorkspace activePage="Locked out accounts" />);
    expect(screen.queryByText("Retained people tools: locked-accounts")).toBeNull();
    expect(screen.queryByRole("button",{name:"Locked out accounts",exact:true})).toBeNull();
  });
  it("saves validated general system settings and updates runtime branding, deadlines, and exports cleanly", async () => {
    render(<ApplicationSettings />);
    await screen.findByDisplayValue("Original City");
    expect(screen.queryByLabelText(/Version String/)).toBeNull();
    expect(screen.queryByLabelText("Session Timeout (minutes)")).toBeNull();
    expect(screen.queryByText(/Calendars & session timeouts/i)).toBeNull();
    expect(screen.queryByLabelText(/Support \/ Reply-To Email/i)).toBeNull();
    expect(
      screen.queryByText(/Optional reply-to address included in account activation and password recovery emails/i),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText(/Organization Name/), {
      target: { value: "LEDIPO City" },
    });
    fireEvent.change(screen.getByLabelText(/Header Subtitle/i), {
      target: { value: "Investment Office" },
    });
    fireEvent.change(screen.getByLabelText(/Activation Link Expiry/i), {
      target: { value: "72" },
    });
    fireEvent.change(screen.getByLabelText(/Warning Window/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByText(/General settings saved and audited/);
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.rpc.mock.calls[0][0]).toBe("save_general_system_settings");
    expect(api.rpc.mock.calls[0][1]).toMatchObject({
      p_values: {
        ...DEFAULT_GENERAL_SETTINGS,
        organization_name: "LEDIPO City",
        organization_subtitle: "Investment Office",
        activation_expiry_hours: "72",
        due_soon_days: "5",
      },
      p_expected: {
        ...DEFAULT_GENERAL_SETTINGS,
        organization_name: "Original City",
      },
    });
    expect(getDueSoonWindowDays()).toBe(5);
    expect(getExportBrandHeader()).toBe("eFlow · LEDIPO City — Investment Office");
    expect(() =>
      validateGeneralSystemSettings({
        ...DEFAULT_GENERAL_SETTINGS,
        maintenance_banner_enabled: "true",
        maintenance_banner_message: "   ",
      }),
    ).toThrow(/Enter a maintenance notice message/i);

    fireEvent.change(screen.getByLabelText(/Sign-in Organization Label/i), {
      target: { value: "City of Ormoc Portal" },
    });
    fireEvent.change(screen.getByLabelText(/Sign-in Prompt Text/i), {
      target: { value: "Sign in with your verified LGU account." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await screen.findByText(/General settings saved and audited/);
    expect(api.phase2).toHaveBeenCalledWith(
      "/admin/login-branding",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          login_portal_title: "City of Ormoc Portal",
          login_portal_subtitle: "Sign in with your verified LGU account.",
        }),
      }),
    );
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
