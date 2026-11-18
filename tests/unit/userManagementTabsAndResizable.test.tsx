// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.test" },
    userProfile: { id: "admin-1", role: "admin", is_active: true },
    can: () => true,
  }),
}));
vi.mock("../../src/app/features/account-activation", () => ({
  listPendingActivations: vi.fn().mockResolvedValue({ invitations: [] }),
}));
vi.mock("../../src/app/features/administration/services/loginSecurityService", () => ({
  readLoginSecurity: vi.fn().mockResolvedValue({ accounts: [] }),
}));
vi.mock("../../src/app/features/administration/components/user-management/UsersTab", () => ({
  UsersTab: () => <div>Office Directory Content</div>,
}));
vi.mock("../../src/app/features/administration/components/user-management/PendingActivationsTable", () => ({
  PendingActivationsTable: () => <div>Pending Invitations Content</div>,
}));
vi.mock("../../src/app/features/administration/components/user-management/LockedAccountsTab", () => ({
  LockedAccountsTab: () => <div>Lockouts Content</div>,
}));
vi.mock("../../src/app/features/permissions", () => ({
  RoleDefaultsTab: () => null,
  UserAccessTab: () => null,
}));

import { UserManagement } from "../../src/app/features/administration/components/user-management/UserManagement";
import { administrativeSubPages } from "../../src/app/features/navigation/administrativePages";
import { useResizableColumns } from "../../src/app/components/ui/useResizableColumns";

afterEach(cleanup);

describe("Admin tabs and resizable column hook", () => {
  it("omits Project Guests from People & Accounts tabs and subpage index", () => {
    expect(administrativeSubPages.some((entry) => entry.label === "Project Guests")).toBe(false);

    render(<UserManagement />);
    expect(screen.getByRole("tab", { name: "Office Accounts" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pending Invitations" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Lockouts & Security" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Project Guests/i })).toBeNull();
  });

  it("supports keyboard resizing, clamping, and Home reset on table columns", () => {
    const { result } = renderHook(() =>
      useResizableColumns([
        { key: "title", defaultWidth: 160, minWidth: 110, maxWidth: 220 },
      ]),
    );

    expect(result.current.widths.title).toBe(160);
    const props = result.current.getResizeHandleProps("title", "title");

    act(() => {
      props.onKeyDown({
        key: "ArrowRight",
        preventDefault: () => {},
      } as unknown as React.KeyboardEvent<HTMLElement>);
    });
    expect(result.current.widths.title).toBe(180);

    act(() => {
      props.onKeyDown({
        key: "Home",
        preventDefault: () => {},
      } as unknown as React.KeyboardEvent<HTMLElement>);
    });
    expect(result.current.widths.title).toBe(160);

    act(() => {
      for (let i = 0; i < 6; i += 1) {
        result.current
          .getResizeHandleProps("title", "title")
          .onKeyDown({
            key: "ArrowLeft",
            preventDefault: () => {},
          } as unknown as React.KeyboardEvent<HTMLElement>);
      }
    });
    expect(result.current.widths.title).toBe(110);
  });
});
