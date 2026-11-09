// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "../../src/app/contexts/AuthContext";
import { loadWithQueryCache, readCachedQuery } from "../../src/app/shared/queryCache";
import { resetAuthCaches } from "../../src/app/shared/authCacheReset";

const auth = vi.hoisted(() => ({
  session: undefined as ((event: string, session: unknown) => void) | undefined,
  permissionChanged: undefined as (() => void) | undefined,
  permissions: vi.fn(),
  grants: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("../../src/app/features/authentication", () => ({ signInWithAccountProtection: vi.fn() }));
vi.mock("../../src/app/services/permissionService", () => ({
  fetchEffectivePermissions: auth.permissions,
  fetchOrganizationScopeGrants: auth.grants,
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof auth.session) => {
        auth.session = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: auth.profile,
        }),
      }),
    }),
    channel: () => {
      const channel = {
        on: (_event: string, filter: { table: string }, callback: () => void) => {
          if (filter.table === "user_permission_overrides") auth.permissionChanged = callback;
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  resetAuthCaches();
  vi.resetAllMocks();
});

it("evicts the old actor scope after a permission change for the same account", async () => {
  auth.grants.mockResolvedValue([]);
  auth.profile.mockResolvedValue({ data: { id: "head", role: "head", org_id: "office", is_active: true } });
  auth.permissions.mockResolvedValueOnce(new Set(["navigation.budget"])).mockResolvedValueOnce(new Set());
  const view = renderHook(() => useAuth(), { wrapper: ({ children }: { children: ReactNode }) =>
    <AuthProvider>{children}</AuthProvider> });
  act(() => auth.session?.("SIGNED_IN", { user: { id: "head" } }));
  await waitFor(() => expect(view.result.current.can("navigation.budget")).toBe(true));
  await loadWithQueryCache({ domain: "department-budget", scope: "head:office:2026", fetcher: async () => ["old-budget"] });

  const revision = view.result.current.accessRevision;
  act(() => auth.permissionChanged?.());
  await waitFor(() => expect(view.result.current.can("navigation.budget")).toBe(false));
  expect(view.result.current.accessRevision).not.toBe(revision);
  expect(readCachedQuery("department-budget", "head:office:2026").hit).toBe(false);
});

it("keeps a verified profile on connection failure and clears data if access is later denied", async () => {
  auth.grants.mockResolvedValue([]);
  auth.profile.mockResolvedValueOnce({ data: { id: "head", role: "head", org_id: "office", is_active: true } })
    .mockResolvedValueOnce({ error: new TypeError("Failed to fetch") })
    .mockResolvedValueOnce({ error: { code: "PGRST116", message: "No visible profile" } });
  auth.permissions.mockResolvedValue(new Set(["navigation.budget"]));
  const view = renderHook(() => useAuth(), { wrapper: ({ children }: { children: ReactNode }) =>
    <AuthProvider>{children}</AuthProvider> });
  act(() => auth.session?.("SIGNED_IN", { user: { id: "head" } }));
  await waitFor(() => expect(view.result.current.can("navigation.budget")).toBe(true));
  await loadWithQueryCache({ domain: "department-budget", scope: "head:office:2026", fetcher: async () => ["old-budget"] });
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(view.result.current.can("navigation.budget")).toBe(true);
  expect(readCachedQuery("department-budget", "head:office:2026").hit).toBe(true);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(view.result.current.userProfile).toBeNull();
  expect(readCachedQuery("department-budget", "head:office:2026").hit).toBe(false);
});

it("evicts cached Office data when the same role loses a cross-Office grant", async () => {
  auth.profile.mockResolvedValue({ data: { id: "head", role: "head", org_id: "office", is_active: true } });
  auth.permissions.mockResolvedValue(new Set(["navigation.budget"]));
  auth.grants.mockResolvedValueOnce([{ orgId: "other-office", accessLevel: "read", expiresAt: null }]).mockResolvedValueOnce([]);
  const view = renderHook(() => useAuth(), { wrapper: ({ children }: { children: ReactNode }) =>
    <AuthProvider>{children}</AuthProvider> });
  act(() => auth.session?.("SIGNED_IN", { user: { id: "head" } }));
  await waitFor(() => expect(view.result.current.can("navigation.budget")).toBe(true));
  await loadWithQueryCache({ domain: "department-budget", scope: "head:other-office:2026", fetcher: async () => ["other-office-budget"] });
  const revision = view.result.current.accessRevision;
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(view.result.current.accessRevision).toBe(revision + 1);
  expect(view.result.current.can("navigation.budget")).toBe(true);
  expect(readCachedQuery("department-budget", "head:other-office:2026").hit).toBe(false);
});
