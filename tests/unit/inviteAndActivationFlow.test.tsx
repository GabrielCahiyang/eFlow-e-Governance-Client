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
import {
  evaluatePasswordRequirements,
  generateStrongPassword,
  isStrongActivationPassword,
  validateActivationFields,
} from "../../src/app/features/account-activation/validation";
import { buildRoleCatalog } from "../../src/app/features/permissions";
import type { Organization } from "../../src/app/types";

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

  it.each(["office_invite", "ledipo_create"] as const)("submits OJT as a Member from %s when LEDIPO already has a Head", async (mode) => {
    const office: Organization = { id: "org-ledipo", name: "LEDIPO", slug: "ledipo", org_type: "department", is_active: true, head_user_id: "office-head", parent_id: null, path: "ledipo", description: "", created_at: "", updated_at: "" };
    mocks.listActivationOffices.mockResolvedValue({ offices: [office] });
    mocks.stageAccountActivation.mockResolvedValue({ invitation_id: "inv-1", email_delivery_status: "sent" });
    const roleCatalog = buildRoleCatalog([{ key: "ojt", label: "OJT", description: "On the job training", baseRole: "member" }]);
    render(<CreateUserModal isOpen mode={mode} onClose={vi.fn()} organizations={[office]} profiles={[]} roleCatalog={roleCatalog} />);
    await waitFor(() => expect(mocks.listActivationOffices).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("j.delacruz@eflow.gov.ph"), { target: { value: "ojt@example.test" } });
    if (mode === "ledipo_create") {
      fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "OJT Applicant" } });
      expect(screen.queryByPlaceholderText(/Loading LEDIPO/i)).toBeNull();
      expect(screen.queryByText("This account belongs to LEDIPO.")).toBeNull();
      expect(screen.queryByText(/Personal Data Sheet/i)).toBeNull();
    }
    const role = screen.getByRole("combobox", { name: /Role/ });
    const submit = screen.getByRole("button", { name: "Send activation email" });
    fireEvent.change(role, { target: { value: "head" } });
    expect(screen.getByText(/LEDIPO already has/)).toBeTruthy();
    expect(screen.getByText("Approval after activation")).toBeTruthy();
    fireEvent.click(submit);
    expect(mocks.stageAccountActivation).not.toHaveBeenCalled();

    fireEvent.change(role, { target: { value: "ojt" } });
    expect(screen.queryByText(/LEDIPO already has/)).toBeNull();
    expect(screen.queryByText("Approval after activation")).toBeNull();
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.stageAccountActivation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode, role: "member", custom_role_key: "ojt", org_id: office.id })));
  }, 20000);

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

    const nameInput = await screen.findByLabelText("Full name", {}, { timeout: 5000 });
    fireEvent.change(nameInput, { target: { value: "Maria Santos" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "StrongPassword12!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPassword12!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(await screen.findByRole("button", { name: "Budgeting" }));
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

  it("enforces formal validation requiring a letter, number, and special character, suggests strong passwords, supports Back navigation, and defaults to light mode", async () => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
    window.history.replaceState({}, "", "/activate-account?token=" + "t".repeat(48));
    mocks.validateAccountActivation.mockResolvedValue({
      email: "maria@eflow.gov.ph",
      full_name: "Maria Santos",
      office_name: "Treasury Office",
      account_role: "member",
      requested_privileged_role: null,
      expires_at: "2026-11-24T00:00:00Z",
      skills: {},
      available_skills: [],
    });
    mocks.completeAccountActivation.mockResolvedValue({
      activated: true,
      next_step: "sign_in",
    });

    render(<ActivateAccountPage />);

    const nameInput = (await screen.findByLabelText("Full name")) as HTMLInputElement;
    // Light mode enforced by default even if document was previously dark
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.classList.contains("light-app-theme")).toBe(true);

    // Step 1 formal validation blocks empty/short full name before advancing
    fireEvent.change(nameInput, { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(await screen.findAllByText(/2 to 160 characters/i)).not.toHaveLength(0);

    fireEvent.change(nameInput, { target: { value: "Maria Santos" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const newPasswordInput = (await screen.findByLabelText("New password")) as HTMLInputElement;
    const confirmInput = screen.getByLabelText("Confirm password") as HTMLInputElement;

    // Back returns to Step 1 preserving full name, then Continue returns to Step 2
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(((await screen.findByLabelText("Full name")) as HTMLInputElement).value).toBe("Maria Santos");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const step2PasswordInput = (await screen.findByLabelText("New password")) as HTMLInputElement;
    const step2ConfirmInput = screen.getByLabelText("Confirm password") as HTMLInputElement;

    // Rejects password missing a number and special character
    fireEvent.change(step2PasswordInput, { target: { value: "OnlyLettersHere" } });
    fireEvent.blur(step2PasswordInput);
    fireEvent.change(step2ConfirmInput, { target: { value: "OnlyLettersHere" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));

    expect(mocks.completeAccountActivation).not.toHaveBeenCalled();
    expect(await screen.findAllByText(/missing a number, a special character/i)).not.toHaveLength(0);

    // Rejects password missing only a special character
    fireEvent.change(step2PasswordInput, { target: { value: "LettersAnd1234" } });
    fireEvent.change(step2ConfirmInput, { target: { value: "LettersAnd1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));

    expect(mocks.completeAccountActivation).not.toHaveBeenCalled();
    expect(await screen.findAllByText(/missing a special character/i)).not.toHaveLength(0);

    // Strong password suggestion populates both fields, reveals new password, and passes all rules
    fireEvent.click(screen.getByRole("button", { name: /Suggest strong password/i }));
    expect(step2PasswordInput.type).toBe("text");
    expect(step2PasswordInput.value.length).toBeGreaterThanOrEqual(12);
    expect(step2ConfirmInput.value).toBe(step2PasswordInput.value);
    expect(isStrongActivationPassword(step2PasswordInput.value)).toBe(true);
    expect(screen.getByRole("button", { name: /Copy password/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));
    await waitFor(() => expect(mocks.completeAccountActivation).toHaveBeenCalledTimes(1));
  }, 20000);

  it("validates activation rules and generated passwords in pure helpers", () => {
    expect(evaluatePasswordRequirements("abcdefghijkl")).toEqual({
      length: true,
      letter: true,
      number: false,
      special: false,
      noControlChars: true,
    });
    expect(validateActivationFields({ fullName: "A", password: "short", confirmation: "other" })).toEqual({
      fullName: "Enter your full name (2 to 160 characters).",
      password: "Use at least 12 characters.",
      confirmation: "The passwords do not match.",
    });

    for (let i = 0; i < 10; i += 1) {
      const generated = generateStrongPassword();
      expect(generated.length).toBe(16);
      expect(isStrongActivationPassword(generated)).toBe(true);
    }
  });
});
