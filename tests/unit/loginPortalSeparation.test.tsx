// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithAccountProtection: vi.fn(),
  getUser: vi.fn(),
  single: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  authListener: null as ((event: string, session: { user: { id: string } } | null) => void) | null,
}));

vi.mock("../../src/app/features/authentication", () => ({
  signInWithAccountProtection: mocks.signInWithAccountProtection,
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener) => {
        mocks.authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mocks.single })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("../../src/app/services/permissionService", async () => {
  const actual = await vi.importActual<typeof import("../../src/app/services/permissionService")>(
    "../../src/app/services/permissionService",
  );
  return {
    ...actual,
    fetchEffectivePermissions: vi.fn(async (_id: string, role: string) =>
      actual.resolvePermissions(role, [], []),
    ),
    fetchOrganizationScopeGrants: vi.fn(async () => []),
  };
});

import { AuthProvider, useAuth } from "../../src/app/contexts/AuthContext";
import {
  getLoginPortal,
  isAdminLoginPath,
  isRoleAllowedForPortal,
} from "../../src/app/shared/loginPortal";

let latestAuth: ReturnType<typeof useAuth> | null = null;

function CaptureAuth() {
  latestAuth = useAuth();
  return null;
}

describe("Client (/) vs Admin (/admin) login portal separation", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    latestAuth = null;
  });

  beforeEach(() => {
    mocks.signInWithAccountProtection.mockReset().mockResolvedValue(undefined);
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.single.mockReset();
    mocks.signOut.mockClear();
  });

  it("identifies /admin paths and enforces role-portal boundaries", () => {
    expect(isAdminLoginPath("/")).toBe(false);
    expect(isAdminLoginPath("/admin")).toBe(true);
    expect(isAdminLoginPath("/admin/")).toBe(true);
    expect(getLoginPortal("/")).toBe("client");
    expect(getLoginPortal("/admin")).toBe("admin");

    expect(isRoleAllowedForPortal("admin", "client")).toBe(false);
    expect(isRoleAllowedForPortal("super_admin", "client")).toBe(false);
    expect(isRoleAllowedForPortal("head", "client")).toBe(true);
    expect(isRoleAllowedForPortal("member", "client")).toBe(true);
    expect(isRoleAllowedForPortal("accounting_staff", "client")).toBe(true);

    expect(isRoleAllowedForPortal("admin", "admin")).toBe(true);
    expect(isRoleAllowedForPortal("super_admin", "admin")).toBe(true);
    expect(isRoleAllowedForPortal("head", "admin")).toBe(false);
    expect(isRoleAllowedForPortal("member", "admin")).toBe(false);
  });

  it("rejects an Admin account on the normal client login (/) with 'Email or password is incorrect.'", async () => {
    window.history.replaceState({}, "", "/");
    mocks.single.mockResolvedValue({
      data: { id: "user-1", is_active: true, role: "admin" },
      error: null,
    });

    render(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>,
    );

    let caughtError: unknown;
    await act(async () => {
      try {
        await latestAuth?.login("admin@gmail.com", "admin123");
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Email or password is incorrect.");
    expect(mocks.signInWithAccountProtection).toHaveBeenCalledWith(
      "admin@gmail.com",
      "admin123",
      "client",
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(latestAuth?.userProfile).toBeNull();
  });

  it("rejects a non-admin account on /admin with 'Email or password is incorrect.'", async () => {
    window.history.replaceState({}, "", "/admin");
    mocks.single.mockResolvedValue({
      data: { id: "user-1", is_active: true, role: "head" },
      error: null,
    });

    render(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>,
    );

    let caughtError: unknown;
    await act(async () => {
      try {
        await latestAuth?.login("bplo.head@gmail.com", "123456");
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Email or password is incorrect.");
    expect(mocks.signInWithAccountProtection).toHaveBeenCalledWith(
      "bplo.head@gmail.com",
      "123456",
      "admin",
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(latestAuth?.userProfile).toBeNull();
  });

  it("redirects Admin logout back to /admin", async () => {
    window.history.replaceState({}, "", "/users");
    mocks.single.mockResolvedValue({
      data: { id: "admin-1", full_name: "System Admin", is_active: true, role: "admin" },
      error: null,
    });

    render(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>,
    );

    act(() => {
      mocks.authListener?.("INITIAL_SESSION", { user: { id: "admin-1" } });
    });

    await waitFor(() => expect(latestAuth?.userProfile?.role).toBe("admin"));

    await act(async () => {
      await latestAuth?.logout();
    });

    expect(window.location.pathname).toBe("/admin");
  });
});
