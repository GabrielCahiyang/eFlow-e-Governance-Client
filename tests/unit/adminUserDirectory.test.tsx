// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";

const base = {
  email: "user@example.test",
  org_id: "org-1",
  workload: 0,
  is_active: true,
  skills: {},
} as UserProfile;
const profiles = [
  { ...base, id: "admin-current", full_name: "Andres Manili", role: "admin" },
  { ...base, id: "admin-other", full_name: "Other Admin", role: "admin" },
  { ...base, id: "head-1", full_name: "Cheryl Gallo", role: "head" },
  { ...base, id: "assistant-1", full_name: "Crisostomo Ibarra", role: "member" },
] as UserProfile[];

vi.mock("../../src/app/hooks/useSupabaseData", () => ({
  useProfiles: () => ({ profiles, loading: false }),
  useOrgs: () => ({ orgs: [{ id: "org-1", name: "LEDIPO", is_active: true }] }),
}));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ userProfile: profiles[0], can: () => true }),
}));
vi.mock("../../src/app/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../src/lib/supabaseService", () => ({ toggleUserActive: vi.fn() }));
vi.mock("../../src/app/features/administration/services/managedUserService", () => ({ deleteManagedUser: vi.fn() }));
vi.mock("../../src/app/features/administration/components/user-management/CreateUserModal", () => ({ CreateUserModal: () => null }));
vi.mock("../../src/app/features/administration/components/user-management/EditUserModal", () => ({ EditUserModal: ({ user }: { user: UserProfile | null }) => user ? <div data-testid="editing-user">{user.full_name}</div> : null }));
vi.mock("../../src/app/features/administration/components/user-management/UserDirectoryFiltersBar", () => ({ UserDirectoryFiltersBar: () => null }));
vi.mock("../../src/app/components/ui/DataTable", () => ({
  DataTable: ({ data, columns }: any) => <div>{data.map((item: UserProfile) => <div data-testid={`row-${item.id}`} key={item.id}><span>{item.full_name}</span>{columns.find((column: any) => column.key === "actions").render(item)}</div>)}</div>,
}));

import { UsersTab } from "../../src/app/features/administration/components/user-management/UsersTab";

afterEach(cleanup);

describe("Admin user directory", () => {
  it("shows Admin accounts and gives Admin authority over leadership accounts", () => {
    render(<UsersTab onOpenAccess={vi.fn()} />);

    expect(screen.getByText("Andres Manili")).toBeTruthy();
    const ownRow = screen.getByTestId("row-admin-current");
    expect(within(ownRow).getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(true);
    expect(within(ownRow).getByRole("button", { name: "Deactivate" }).hasAttribute("disabled")).toBe(true);
    const otherAdmin = screen.getByTestId("row-admin-other");
    expect(within(otherAdmin).getByRole("button", { name: "Deactivate" }).hasAttribute("disabled")).toBe(false);
    expect(within(otherAdmin).getByRole("button", { name: "Access" }).hasAttribute("disabled")).toBe(true);

    const headRow = screen.getByTestId("row-head-1");
    expect(within(headRow).getByRole("button", { name: "Edit" }).hasAttribute("disabled")).toBe(false);
    expect(within(headRow).getByRole("button", { name: "Deactivate" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(within(headRow).getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("editing-user").textContent).toBe("Cheryl Gallo");

    const assistantRow = screen.getByTestId("row-assistant-1");
    expect(within(assistantRow).getByRole("button", { name: "Edit" }).hasAttribute("disabled")).toBe(false);
  });
});
