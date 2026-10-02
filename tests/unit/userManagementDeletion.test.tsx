// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";

const deleteManagedUser = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

const profile = {
  id: "employee-1",
  full_name: "Juan Dela Cruz",
  email: "juan@example.test",
  role: "employee",
  org_id: "org-1",
  workload: 0,
  is_active: true,
  skills: {},
} as UserProfile;

const superAdminProfile = {
  ...profile,
  id: "super-admin-1",
  full_name: "Protected Admin",
  email: "root@example.test",
  role: "super_admin",
} as UserProfile;

vi.mock("../../src/app/hooks/useSupabaseData", () => ({
  useProfiles: () => ({ profiles: [profile, superAdminProfile], loading: false }),
  useOrgs: () => ({ orgs: [{ id: "org-1", name: "Finance", is_active: true }] }),
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ userProfile: { id: "admin-1", role: "super_admin" }, can: () => true }),
}));
vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("../../src/lib/supabaseService", () => ({ toggleUserActive: vi.fn() }));
vi.mock("../../src/app/features/administration/services/managedUserService", () => ({ deleteManagedUser }));
vi.mock("../../src/app/features/administration/components/user-management/CreateUserModal", () => ({ CreateUserModal: () => null }));
vi.mock("../../src/app/features/administration/components/user-management/EditUserModal", () => ({ EditUserModal: () => null }));
vi.mock("../../src/app/features/administration/components/user-management/UserDirectoryFiltersBar", () => ({ UserDirectoryFiltersBar: () => null }));
vi.mock("../../src/app/components/ui/DataTable", () => ({
  DataTable: ({ data, columns }: any) => <div>{data.map((item: UserProfile) => <div data-testid={`row-${item.id}`} key={item.id}><span>{item.full_name}</span>{columns.find((column: any) => column.key === "actions").render(item)}</div>)}</div>,
}));

import { UsersTab } from "../../src/app/features/administration/components/user-management/UsersTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("User Management deletion", () => {
  it("requires explicit confirmation before permanently deleting an account", async () => {
    deleteManagedUser.mockResolvedValue(undefined);
    render(<UsersTab onOpenAccess={vi.fn()} />);

    expect(screen.getByText("Protected Admin")).toBeTruthy();
    expect(within(screen.getByTestId("row-super-admin-1")).getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(within(screen.getByTestId("row-employee-1")).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/cannot be undone/i)).toBeTruthy();
    expect(deleteManagedUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await waitFor(() => expect(deleteManagedUser).toHaveBeenCalledWith("employee-1"));
    expect(toast).toHaveBeenCalledWith('User "Juan Dela Cruz" permanently deleted', "success");
  });
});
