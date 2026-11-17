// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  stageAccountActivation: vi.fn(),
  listActivationOffices: vi.fn(),
  validateAccountActivation: vi.fn(),
  completeAccountActivation: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { id: "admin-1", role: "admin" },
  }),
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../src/app/shared/useExplicitDraft", () => ({
  useExplicitDraft: () => ({
    pendingRef: { current: false },
    markClean: vi.fn(),
  }),
}));

vi.mock("../../src/app/shared/skillTags", () => ({
  useSkillTags: () => ({ activeLabels: ["Budgeting", "Procurement"], loading: false }),
}));

vi.mock("../../src/app/features/account-activation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/account-activation")>();
  return {
    ...actual,
    stageAccountActivation: mocks.stageAccountActivation,
    listActivationOffices: mocks.listActivationOffices,
    validateAccountActivation: mocks.validateAccountActivation,
    completeAccountActivation: mocks.completeAccountActivation,
  };
});

vi.mock("../../src/app/features/account-activation/services/activationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/account-activation/services/activationService")>();
  return {
    ...actual,
    validateAccountActivation: mocks.validateAccountActivation,
    completeAccountActivation: mocks.completeAccountActivation,
  };
});

import { CreateUserModal } from "../../src/app/features/administration/components/user-management/CreateUserModal";
import { ActivateAccountPage } from "../../src/app/features/account-activation";

beforeEach(() => {
  mocks.stageAccountActivation.mockReset();
  mocks.listActivationOffices.mockReset();
  mocks.validateAccountActivation.mockReset();
  mocks.completeAccountActivation.mockReset();
  mocks.toast.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Streamlined Invite eFlow User + ActivateAccountPage full name", () => {
  it("renders Invite eFlow User with only Email and Role (auto-assigned to LEDIPO, no Office picker) and stages cleanly", async () => {
    mocks.listActivationOffices.mockResolvedValue({
      offices: [{ id: "org-ledipo", name: "LEDIPO", slug: "ledipo" }],
    });
    mocks.stageAccountActivation.mockResolvedValue({
      invitation_id: "inv-1",
      email_delivery_status: "sent",
    });

    render(
      <CreateUserModal
        isOpen
        mode="office_invite"
        onClose={vi.fn()}
        organizations={[
          {
            id: "org-ledipo",
            name: "LEDIPO",
            slug: "ledipo",
            is_active: true,
          } as any,
        ]}
        profiles={[]}
      />,
    );

    await waitFor(() => {
      expect(mocks.listActivationOffices).toHaveBeenCalled();
    });

    expect(screen.queryByPlaceholderText("Juan Dela Cruz")).toBeNull();
    expect(screen.queryByText("Basic Info")).toBeNull();
    expect(screen.queryByText("Skills")).toBeNull();
    expect(screen.queryByText(/Choose an office/i)).toBeNull();
    expect(screen.queryByText(/Account office only/i)).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("j.delacruz@eflow.gov.ph"), {
      target: { value: "maria@eflow.gov.ph" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send activation email" }));

    await waitFor(() => {
      expect(mocks.stageAccountActivation).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.stageAccountActivation.mock.calls[0][0];
    expect(payload.mode).toBe("office_invite");
    expect(payload.email).toBe("maria@eflow.gov.ph");
    expect(payload.org_id).toBe("org-ledipo");
    expect(payload.full_name).toBeUndefined();
    expect(payload.skills).toEqual({});
  });

  it("collects Full name on ActivateAccountPage and forwards it to activation", async () => {
    window.history.replaceState({}, "", "/activate-account?token=" + "t".repeat(48));
    mocks.validateAccountActivation.mockResolvedValue({
      email: "maria@eflow.gov.ph",
      full_name: null,
      office_name: "Treasury Office",
      account_role: "member",
      requested_privileged_role: null,
      expires_at: "2026-11-24T00:00:00Z",
      skills: {},
      available_skills: ["Budgeting", "Procurement"],
    });
    mocks.completeAccountActivation.mockResolvedValue({
      activated: true,
      next_step: "sign_in",
    });

    render(<ActivateAccountPage />);

    const nameInput = await screen.findByLabelText("Full name");
    fireEvent.change(nameInput, { target: { value: "Maria Santos" } });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPassword12!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPassword12!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Budgeting" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => {
      expect(mocks.completeAccountActivation).toHaveBeenCalledTimes(1);
    });

    expect(mocks.completeAccountActivation).toHaveBeenCalledWith(
      "t".repeat(48),
      "StrongPassword12!",
      expect.any(String),
      { Budgeting: true },
      "Maria Santos",
    );
  });
});
