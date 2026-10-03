// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserDirectoryFiltersBar } from "../../src/app/features/administration/components/user-management/UserDirectoryFiltersBar";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  filterAndSortUserDirectory,
  type UserDirectoryFilters,
} from "../../src/app/features/administration/selectors/userDirectory";
import type { UserProfile } from "../../src/app/types";

const profile = (id: string, fullName: string, orgId: string, active = true, workload = 0) => ({
  id,
  full_name: fullName,
  org_id: orgId,
  is_active: active,
  workload,
  role: "member",
} as UserProfile);

function Harness() {
  const [value, setValue] = useState<UserDirectoryFilters>(DEFAULT_USER_DIRECTORY_FILTERS);
  return <UserDirectoryFiltersBar value={value} organizations={[{ value: "bplo", label: "BPLO" }, { value: "ledipo", label: "LEDIPO" }]} onChange={setValue} />;
}

describe("user account directory filters", () => {
  it("filters by organization and supports office A–Z and Z–A", () => {
    const profiles = [
      profile("1", "Cheryl Gallo", "ledipo"),
      profile("2", "Tasya Salcedo", "bplo"),
      profile("3", "Raul Cam", "bplo"),
    ];
    const organizations = { ledipo: "LEDIPO", bplo: "BPLO" };

    expect(filterAndSortUserDirectory(profiles, organizations, { ...DEFAULT_USER_DIRECTORY_FILTERS, organizationId: "bplo" }).map((item) => item.full_name)).toEqual(["Raul Cam", "Tasya Salcedo"]);
    expect(filterAndSortUserDirectory(profiles, organizations, { ...DEFAULT_USER_DIRECTORY_FILTERS, sort: "organization-asc" }).map((item) => item.full_name)).toEqual(["Raul Cam", "Tasya Salcedo", "Cheryl Gallo"]);
    expect(filterAndSortUserDirectory(profiles, organizations, { ...DEFAULT_USER_DIRECTORY_FILTERS, sort: "organization-desc" }).map((item) => item.full_name)).toEqual(["Cheryl Gallo", "Raul Cam", "Tasya Salcedo"]);
  });

  it("updates filters and exposes a compact reset action", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Filter users by organization" }), { target: { value: "ledipo" } });
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((screen.getByRole("combobox", { name: "Filter users by organization" }) as HTMLSelectElement).value).toBe("all");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });
});
