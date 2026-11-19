// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  normalizeRoleLabel,
  validateCustomRoleName,
  type ExistingRoleLabelEntry,
} from "../../src/app/features/permissions/validation/roleNameValidation";
import { CustomRoleModal } from "../../src/app/features/permissions/components/CustomRoleModal";

afterEach(() => {
  cleanup();
});

const existingCatalog: ExistingRoleLabelEntry[] = [
  { key: "admin", label: "Admin", isBuiltIn: true },
  { key: "head", label: "Head", isBuiltIn: true },
  { key: "accounting_staff", label: "Accounting Staff", isBuiltIn: true },
  { key: "member", label: "Member", isBuiltIn: true },
  { key: "ojt", label: "OJT", isBuiltIn: false },
  { key: "bagong_role", label: "Bagong Role", isBuiltIn: false },
];

describe("custom role name uniqueness & reserved-name validation", () => {
  it("blocks every built-in role name and alias regardless of case, spacing, or separators", () => {
    for (const candidate of [
      "Admin",
      "admin",
      "SUPER ADMIN",
      "Super-Admin",
      "Administrator",
      "Head",
      "  head  ",
      "Office Head",
      "Department Head",
      "Dept_Head",
      "Assistant Head",
      "Accounting Staff",
      "accounting_staff",
      "Accounting-Staff",
      "Member",
      "MEMBER",
      "Employee",
      "Viewer",
    ]) {
      const err = validateCustomRoleName(candidate, existingCatalog);
      expect(err, `expected "${candidate}" to be rejected`).toMatch(/built-in/i);
    }
  });

  it("blocks duplicates of existing custom roles across case, whitespace, and punctuation variants", () => {
    for (const candidate of [
      "OJT",
      "ojt",
      "  Ojt ",
      "Bagong Role",
      "bagong role",
      "Bagong   Role",
      "Bagong-Role",
      "BAGONG_ROLE",
    ]) {
      const err = validateCustomRoleName(candidate, existingCatalog);
      expect(err, `expected "${candidate}" to be flagged as duplicate`).toMatch(/already exists/i);
    }
    expect(normalizeRoleLabel("Bagong-Role")).toBe("bagong role");
  });

  it("allows keeping or recasing the same role name while editing that role, but blocks colliding with another role", () => {
    expect(validateCustomRoleName("OJT", existingCatalog, "ojt")).toBeNull();
    expect(validateCustomRoleName("Ojt", existingCatalog, "ojt")).toBeNull();
    expect(validateCustomRoleName("Bagong Role", existingCatalog, "ojt")).toMatch(/already exists/i);
    expect(validateCustomRoleName("Head", existingCatalog, "ojt")).toMatch(/built-in/i);
    expect(validateCustomRoleName("Project Coordinator", existingCatalog, "ojt")).toBeNull();
  });

  it("rejects punctuation-only names and overly short names", () => {
    expect(validateCustomRoleName("A", existingCatalog)).toMatch(/between 2 and 60/i);
    expect(validateCustomRoleName("---", existingCatalog)).toMatch(/at least 2 letters or numbers/i);
  });

  it("shows live inline validation in CustomRoleModal and prevents submitting duplicate or built-in names", () => {
    const onSubmit = vi.fn();
    render(
      <CustomRoleModal
        open
        mode="create"
        existingRoles={existingCatalog}
        saving={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText(/Role name/i);
    const submitBtn = screen.getByRole("button", { name: "Create role" }) as HTMLButtonElement;

    // Built-in role collision
    fireEvent.change(input, { target: { value: "Head" } });
    expect(screen.getByRole("alert").textContent).toMatch(/built-in Head role/i);
    expect(submitBtn.disabled).toBe(true);

    // Custom role duplicate collision (different case + hyphen)
    fireEvent.change(input, { target: { value: "bagong-role" } });
    expect(screen.getByRole("alert").textContent).toMatch(/already exists/i);
    expect(submitBtn.disabled).toBe(true);

    // Unique name clears the error and enables submission
    fireEvent.change(input, { target: { value: "Project Coordinator" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: "Project Coordinator" }));
  });
});
