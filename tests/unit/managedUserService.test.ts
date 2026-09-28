import { beforeEach, describe, expect, it, vi } from "vitest";

const controlPanelFetch = vi.hoisted(() => vi.fn());
const refreshProfiles = vi.hoisted(() => vi.fn());

vi.mock("../../src/app/shared/controlPanelClient", () => ({ controlPanelFetch }));
vi.mock("../../src/lib/supabaseService", () => ({ refreshProfiles }));

import { deleteManagedUser } from "../../src/app/features/administration/services/managedUserService";

describe("managed user deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshProfiles.mockResolvedValue(undefined);
  });

  it("permanently deletes through the authenticated admin gateway and refreshes the directory", async () => {
    controlPanelFetch.mockResolvedValue({ ok: true });

    await deleteManagedUser("employee/one");

    expect(controlPanelFetch).toHaveBeenCalledWith(
      "admin/users/employee%2Fone",
      { method: "DELETE" },
      { retryOnEndpointChange: true },
    );
    expect(refreshProfiles).toHaveBeenCalledOnce();
  });

  it("shows the gateway reason and leaves the directory untouched when history blocks deletion", async () => {
    controlPanelFetch.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ detail: "This account is linked to audit history." }),
    });

    await expect(deleteManagedUser("employee-1")).rejects.toThrow("linked to audit history");
    expect(refreshProfiles).not.toHaveBeenCalled();
  });
});
