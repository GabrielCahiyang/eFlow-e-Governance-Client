// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Organization } from "../../src/app/types";

const mocks = vi.hoisted(() => ({
  fetchDepartmentFiscalYears: vi.fn(),
  writeNavigationLocation: vi.fn(),
  can: vi.fn(() => true),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "head-1" },
    userProfile: { id: "head-1", role: "head", org_id: "org-ledipo" },
    can: mocks.can,
  }),
}));

vi.mock("../../src/app/features/budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/budget")>();
  return {
    ...actual,
    getCurrentFiscalYear: () => 2026,
    fetchDepartmentFiscalYears: mocks.fetchDepartmentFiscalYears,
  };
});

vi.mock("../../src/app/features/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/navigation")>();
  return {
    ...actual,
    writeNavigationLocation: mocks.writeNavigationLocation,
  };
});

vi.mock("../../src/app/features/project-setup", () => ({
  ProjectFlowError: class extends Error {},
  ProjectSetupWizard: ({ importPdf }: { importPdf?: boolean }) => (
    <div data-testid="project-setup-wizard">
      {importPdf ? "AI project wizard" : "Manual project wizard"}
    </div>
  ),
}));

vi.mock("../../src/app/components/ui/Modal", () => ({
  Modal: ({ isOpen, title, children, footer }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
  ModalButton: ({ children, onClick, disabled }: any) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { CreateProjectDialog } from "../../src/app/features/project-table/components/CreateProjectDialog";

const orgs = [{ id: "org-ledipo", name: "LEDIPO", is_active: true }] as Organization[];

beforeEach(() => {
  mocks.fetchDepartmentFiscalYears.mockReset();
  mocks.writeNavigationLocation.mockReset();
  mocks.can.mockReset();
  mocks.can.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe("CreateProjectDialog current-year Office Budget gate", () => {
  it.each([false, true])(
    "blocks project creation (importPdf=%s) when FY 2026 Office Budget is not configured and navigates to Office Budget",
    async (importPdf) => {
      mocks.fetchDepartmentFiscalYears.mockResolvedValue([
        { year: 2025, status: "locked", amount: 500000 },
      ]);
      const onClose = vi.fn();

      render(
        <CreateProjectDialog
          open
          importPdf={importPdf}
          officeId="org-ledipo"
          officeName="LEDIPO"
          organizations={orgs}
          onClose={onClose}
          onCreated={vi.fn()}
        />,
      );

      expect(await screen.findByText("Set up your FY 2026 Office Budget first")).toBeTruthy();
      expect(screen.queryByTestId("project-setup-wizard")).toBeNull();
      expect(screen.getByText("FY 2026 · Not yet configured")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /Configure Office Budget/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mocks.writeNavigationLocation).toHaveBeenCalledWith("budget", "Office Budget", "push", {
        parameters: { view: "annual", fy: "2026" },
      });
    },
  );

  it("blocks project creation when FY 2026 Office Budget is still a draft", async () => {
    mocks.fetchDepartmentFiscalYears.mockResolvedValue([
      { year: 2026, status: "draft", amount: 250000 },
    ]);

    render(
      <CreateProjectDialog
        open
        importPdf
        officeId="org-ledipo"
        officeName="LEDIPO"
        organizations={orgs}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Finalize your FY 2026 Office Budget first")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Review & lock Office Budget/i })).toBeTruthy();
    expect(screen.queryByTestId("project-setup-wizard")).toBeNull();
  });

  it("blocks project creation when FY 2026 Office Budget is closed", async () => {
    mocks.fetchDepartmentFiscalYears.mockResolvedValue([
      { year: 2026, status: "closed", amount: 250000 },
    ]);

    render(
      <CreateProjectDialog
        open
        officeId="org-ledipo"
        officeName="LEDIPO"
        organizations={orgs}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(await screen.findByText("FY 2026 Office Budget is closed")).toBeTruthy();
    expect(screen.queryByTestId("project-setup-wizard")).toBeNull();
  });

  it.each([false, true])(
    "opens the project setup wizard (importPdf=%s) immediately once FY 2026 Office Budget is locked",
    async (importPdf) => {
      mocks.fetchDepartmentFiscalYears.mockResolvedValue([
        { year: 2026, status: "locked", amount: 500000 },
      ]);

      render(
        <CreateProjectDialog
          open
          importPdf={importPdf}
          officeId="org-ledipo"
          officeName="LEDIPO"
          organizations={orgs}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />,
      );

      expect(await screen.findByTestId("project-setup-wizard")).toBeTruthy();
      expect(screen.getByTestId("project-setup-wizard").textContent).toBe(
        importPdf ? "AI project wizard" : "Manual project wizard",
      );
    },
  );

  it("shows a retryable error instead of bypassing the gate when the budget check fails", async () => {
    mocks.fetchDepartmentFiscalYears
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce([{ year: 2026, status: "locked", amount: 500000 }]);

    render(
      <CreateProjectDialog
        open
        officeId="org-ledipo"
        officeName="LEDIPO"
        organizations={orgs}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Unable to verify Office Budget")).toBeTruthy();
    expect(screen.queryByTestId("project-setup-wizard")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(screen.getByTestId("project-setup-wizard")).toBeTruthy();
    });
  });
});
