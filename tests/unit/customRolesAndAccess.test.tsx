// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockApi = vi.hoisted(() => ({
  rolePermissions: [] as Array<{ role: string; permission: string; allowed: boolean }>,
  customRoles: [] as Array<{
    key: string;
    label: string;
    description: string;
    base_role: "head" | "accounting_staff" | "member";
    created_at?: string;
    updated_at?: string;
  }>,
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: mockApi.from,
    channel: mockApi.channel,
    removeChannel: mockApi.removeChannel,
  },
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({
    toast: mockApi.showToast,
    showToast: mockApi.showToast,
  }),
}));

import {
  ACTION_PERMISSION_KEYS,
  FALLBACK_DEFAULTS,
  VISIBLE_PAGE_PERMISSION_KEYS,
  buildCustomRoleKey,
  buildRoleCatalog,
  createCustomRole,
  deleteCustomRole,
  resolveAccountRoleDisplay,
  resolvePermissions,
  resolveRoleSelection,
  restoreRoleDefaults,
  rolePermissionAllowed,
} from "../../src/app/features/permissions";
import { RoleDefaultsTab } from "../../src/app/features/permissions/components/RoleDefaultsTab";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  filterAndSortUserDirectory,
} from "../../src/app/features/administration/selectors/userDirectory";
import type { Organization, UserProfile } from "../../src/app/types";
import { getLeadershipSlotConflict } from "../../src/app/features/administration/services/leadershipConstraints";

function installSupabaseMocks() {
  mockApi.channel.mockReturnValue({
    on: function () {
      return this;
    },
    subscribe: () => ({ unsubscribe: vi.fn() }),
  });
  mockApi.removeChannel.mockResolvedValue(undefined);

  mockApi.from.mockImplementation((table: string) => {
    if (table === "role_permissions") {
      return {
        select: () => Promise.resolve({ data: [...mockApi.rolePermissions], error: null }),
        upsert: async (
          payload:
            | { role: string; permission: string; allowed: boolean }
            | Array<{ role: string; permission: string; allowed: boolean }>,
        ) => {
          const items = Array.isArray(payload) ? payload : [payload];
          for (const row of items) {
            const idx = mockApi.rolePermissions.findIndex(
              (item) => item.role === row.role && item.permission === row.permission,
            );
            if (idx >= 0) mockApi.rolePermissions[idx] = { ...row };
            else mockApi.rolePermissions.push({ ...row });
          }
          return { error: null };
        },
        delete: () => ({
          eq: async (col: string, val: string) => {
            if (col === "role") {
              mockApi.rolePermissions = mockApi.rolePermissions.filter((row) => row.role !== val);
            }
            return { error: null };
          },
        }),
      };
    }

    if (table === "custom_roles") {
      return {
        select: () => ({
          order: async () => ({ data: [...mockApi.customRoles], error: null }),
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({
              data: mockApi.customRoles.find((row) => row.key === val) || null,
              error: null,
            }),
          }),
        }),
        insert: (row: {
          key: string;
          label: string;
          description: string;
          base_role: "head" | "accounting_staff" | "member";
        }) => ({
          select: () => ({
            single: async () => {
              const duplicate = mockApi.customRoles.some(
                (item) => item.label.toLowerCase() === row.label.toLowerCase(),
              );
              if (duplicate) return { data: null, error: { code: "23505", message: "duplicate" } };
              const saved = {
                ...row,
                created_at: "2026-11-17T00:00:00Z",
                updated_at: "2026-11-17T00:00:00Z",
              };
              mockApi.customRoles.push(saved);
              return { data: saved, error: null };
            },
          }),
        }),
        update: (patch: { label: string; description: string; updated_at?: string }) => ({
          eq: (_col: string, val: string) => ({
            select: () => ({
              single: async () => {
                const idx = mockApi.customRoles.findIndex((row) => row.key === val);
                if (idx < 0) return { data: null, error: { message: "not found" } };
                mockApi.customRoles[idx] = { ...mockApi.customRoles[idx], ...patch };
                return { data: mockApi.customRoles[idx], error: null };
              },
            }),
          }),
        }),
        delete: () => ({
          eq: async (_col: string, val: string) => {
            mockApi.customRoles = mockApi.customRoles.filter((row) => row.key !== val);
            return { error: null };
          },
        }),
      };
    }

    return {
      select: () => Promise.resolve({ data: [], error: null }),
    };
  });
}

beforeEach(() => {
  mockApi.rolePermissions = [];
  mockApi.customRoles = [];
  mockApi.showToast.mockClear();
  installSupabaseMocks();
});

afterEach(() => {
  cleanup();
});

describe("dynamic custom roles & redesigned RoleDefaultsTab", () => {
  it("inherits base_role defaults, applies custom overrides, and keeps individual overrides highest precedence", () => {
    const customRole = { key: "budget_reviewer", baseRole: "accounting_staff" as const };
    const roleRows = [
      { role: "budget_reviewer", permission: "tasks.verify", allowed: true },
      { role: "budget_reviewer", permission: "navigation.accounting_overview", allowed: false },
    ];
    const overrides = [
      { userId: "u1", permission: "navigation.audit", allowed: true },
    ];

    const resolved = resolvePermissions("accounting_staff", roleRows, overrides, customRole);
    expect(resolved.has("tasks.verify")).toBe(true);
    expect(resolved.has("navigation.accounting_overview")).toBe(false);
    expect(resolved.has("navigation.audit")).toBe(true);

    // Base accounting_staff defaults are unaffected by custom role overrides.
    expect(rolePermissionAllowed("accounting_staff", "navigation.accounting_overview", roleRows)).toBe(true);
    expect(rolePermissionAllowed("budget_reviewer", "navigation.accounting_overview", roleRows, "accounting_staff")).toBe(false);
  });

  it("generates non-reserved role keys and supports create, delete, and restoreRoleDefaults", async () => {
    expect(buildCustomRoleKey("Admin")).toBe("admin_custom");
    expect(buildCustomRoleKey("Budget Reviewer")).toBe("budget_reviewer");

    const created = await createCustomRole({
      label: "Budget Reviewer",
      baseRole: "accounting_staff",
      description: "Reviews quarterly liquidations",
    });
    expect(created.key).toBe("budget_reviewer");
    expect(mockApi.customRoles).toHaveLength(1);

    mockApi.rolePermissions.push({
      role: "budget_reviewer",
      permission: "reports.view",
      allowed: true,
    });
    await restoreRoleDefaults("budget_reviewer");
    expect(mockApi.rolePermissions).toHaveLength(0);

    await expect(restoreRoleDefaults("admin")).rejects.toThrow(/cannot be changed/i);

    mockApi.rolePermissions.push({
      role: "budget_reviewer",
      permission: "reports.view",
      allowed: true,
    });
    await deleteCustomRole("budget_reviewer");
    expect(mockApi.customRoles).toHaveLength(0);
    expect(mockApi.rolePermissions).toHaveLength(0);
  });

  it("resolves catalog selection and filters user directory by both base and custom roles", () => {
    const catalog = buildRoleCatalog([
      {
        key: "budget_reviewer",
        label: "Budget Reviewer",
        description: "",
        baseRole: "accounting_staff",
      },
    ]);
    expect(resolveRoleSelection("budget_reviewer", catalog)).toEqual({
      role: "accounting_staff",
      customRoleKey: "budget_reviewer",
      label: "Budget Reviewer",
    });
    expect(resolveAccountRoleDisplay("accounting_staff", "budget_reviewer", catalog)).toEqual({
      label: "Budget Reviewer",
      baseLabel: "Accounting Staff",
      isCustom: true,
    });

    const sampleUsers: UserProfile[] = [
      {
        id: "u1",
        full_name: "Ana Reviewer",
        avatar_path: null,
        email: "ana@test.local",
        email_notifications_enabled: true,
        employee_id: "E1",
        org_id: "org1",
        role: "accounting_staff",
        custom_role_key: "budget_reviewer",
        skills: {},
        workload: 10,
        burnout_level: "low",
        is_active: true,
        created_at: "",
        updated_at: "",
        uid: "u1",
        employeeId: "E1",
        fullName: "Ana Reviewer",
        avatarPath: null,
        emailNotificationsEnabled: true,
        departmentId: "org1",
        burnoutLevel: "low",
        status: "active",
        createdAt: 0,
        lastLogin: 0,
      },
      {
        id: "u2",
        full_name: "Ben Head",
        avatar_path: null,
        email: "ben@test.local",
        email_notifications_enabled: true,
        employee_id: "E2",
        org_id: "org1",
        role: "head",
        custom_role_key: null,
        skills: {},
        workload: 20,
        burnout_level: "low",
        is_active: true,
        created_at: "",
        updated_at: "",
        uid: "u2",
        employeeId: "E2",
        fullName: "Ben Head",
        avatarPath: null,
        emailNotificationsEnabled: true,
        departmentId: "org1",
        burnoutLevel: "low",
        status: "active",
        createdAt: 0,
        lastLogin: 0,
      },
    ];

    expect(
      filterAndSortUserDirectory(sampleUsers, { org1: "LEDIPO" }, {
        ...DEFAULT_USER_DIRECTORY_FILTERS,
        role: "budget_reviewer",
      }).map((u) => u.id),
    ).toEqual(["u1"]);

    expect(
      filterAndSortUserDirectory(sampleUsers, { org1: "LEDIPO" }, {
        ...DEFAULT_USER_DIRECTORY_FILTERS,
        role: "head",
      }).map((u) => u.id),
    ).toEqual(["u2"]);
  });

  it("renders the master-detail workspace without helper box, supports Restore default & creating a custom role live", async () => {
    const view = render(<RoleDefaultsTab />);
    expect(view.container.querySelector(".eflow-permissions-surface")).not.toBeNull();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore default" })).toBeTruthy();
    });

    // Helper clutter removed and old Refresh button renamed.
    expect(screen.queryByText(/How role defaults work/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Refresh role defaults/i })).toBeNull();

    // Admin is initially selected with locked Allowed controls.
    const adminAllowed = screen.getAllByLabelText(/Admin: Allowed/i);
    const adminAll = screen.getAllByLabelText(/^Admin:/i);
    expect(adminAllowed).toHaveLength(8);
    expect(adminAll).toHaveLength(VISIBLE_PAGE_PERMISSION_KEYS.length + ACTION_PERMISSION_KEYS.length);
    const restoreBtn = screen.getByRole("button", { name: "Restore default" }) as HTMLButtonElement;
    expect(restoreBtn.disabled).toBe(true);

    // Selecting Member unlocks permissions and Restore default.
    fireEvent.click(screen.getByRole("button", { name: /Member/i }));
    expect((screen.getByRole("button", { name: "Restore default" }) as HTMLButtonElement).disabled).toBe(false);

    // Toggle a Member capability (first switch) and verify persistence call + toast.
    const firstMemberSwitch = screen.getAllByLabelText(/^Member:/i)[0];
    fireEvent.click(firstMemberSwitch);
    await waitFor(() => {
      expect(mockApi.rolePermissions.some((row) => row.role === "member")).toBe(true);
    });

    // Click Restore default and confirm in dialog.
    fireEvent.click(screen.getByRole("button", { name: "Restore default" }));
    await screen.findByText(/Restore default access for Member/i);
    fireEvent.click(screen.getByRole("button", { name: "Restore default" }));
    await waitFor(() => {
      expect(mockApi.rolePermissions.some((row) => row.role === "member")).toBe(false);
    });
  }, 20000);

  it("supports creating and editing custom roles with in-modal permissions and an Edit button", async () => {
    render(<RoleDefaultsTab />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore default" })).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Create custom role" })[0]);
    expect((screen.getByLabelText("Account type") as HTMLSelectElement).value).toBe("member");
    fireEvent.change(screen.getByLabelText(/Role name/i), { target: { value: "Budget Reviewer" } });
    const modalVerifyGroup = screen.getByRole("group", { name: "Review and verify submissions" });
    fireEvent.click(modalVerifyGroup.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => {
      expect(screen.getAllByText("Budget Reviewer").length).toBeGreaterThanOrEqual(1);
    });
    expect(mockApi.customRoles.some((item) => item.key === "budget_reviewer" && item.base_role === "member")).toBe(true);
    expect(
      mockApi.rolePermissions.some(
        (row) => row.role === "budget_reviewer" && row.permission === "tasks.verify" && row.allowed,
      ),
    ).toBe(true);

    // Custom role shows "Edit" (not "Rename") and opens editable modal.
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit custom role" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Role name/i), { target: { value: "Senior Budget Reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getAllByText("Senior Budget Reviewer").length).toBeGreaterThanOrEqual(1);
    });
    expect(FALLBACK_DEFAULTS.accounting_staff.length).toBeGreaterThan(0);
  }, 20000);

  it("repairs an OJT role for assignment and invitation in an office with a Head", async () => {
    mockApi.customRoles.push({ key: "ojt", label: "OJT", description: "On the job training", base_role: "head" });
    mockApi.rolePermissions.push({ role: "ojt", permission: "navigation.reviews", allowed: true });
    const office: Organization = { id: "ledipo", name: "LEDIPO", slug: "ledipo", org_type: "department", is_active: true, head_user_id: "office-head", parent_id: null, path: "ledipo", description: "", created_at: "", updated_at: "" };
    const leadershipWarning = (role: string) => getLeadershipSlotConflict({ role, orgId: office.id, organizations: [office], profiles: [] });

    render(<RoleDefaultsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /OJT/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const accountType = screen.getByLabelText("Account type") as HTMLSelectElement;
    expect(accountType.value).toBe("head");
    fireEvent.change(accountType, { target: { value: "member" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit custom role" })).toBeNull());

    const catalog = buildRoleCatalog([{ key: "ojt", label: "OJT", description: "On the job training", baseRole: mockApi.customRoles[0].base_role }]);
    const assignment = resolveRoleSelection("ojt", catalog);
    expect(assignment).toEqual({ role: "member", customRoleKey: "ojt", label: "OJT" });
    expect(leadershipWarning(assignment.role)).toBeNull();
    expect(leadershipWarning(resolveRoleSelection("head", catalog).role)).toContain("already has");
    expect(mockApi.rolePermissions).toContainEqual(expect.objectContaining({ role: "ojt", permission: "navigation.reviews", allowed: true }));
  }, 20000);
});
