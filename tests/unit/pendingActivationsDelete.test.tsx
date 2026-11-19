// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  listPendingActivations: vi.fn(),
  manageAccountActivation: vi.fn(),
}));

vi.mock("../../src/app/features/account-activation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/account-activation")>();
  return {
    ...actual,
    listPendingActivations: mocks.listPendingActivations,
    manageAccountActivation: mocks.manageAccountActivation,
  };
});

import { PendingActivationsTable } from "../../src/app/features/administration/components/user-management/PendingActivationsTable";

const baseInvite = {
  invitation_id: "inv-revoked-1",
  email: "andres@example.test",
  full_name: "Andres Manili",
  office_id: "org-ledipo",
  office_name: "LEDIPO",
  account_role: "member" as const,
  requested_privileged_role: null,
  source_mode: "office_invite" as const,
  status: "revoked" as const,
  email_delivery_status: "sent" as const,
  expires_at: "2026-11-20T15:44:00Z",
  created_at: "2026-11-18T15:44:00Z",
  last_sent_at: "2026-11-18T15:44:00Z",
  awaiting_authority: false,
};

beforeEach(() => {
  mocks.listPendingActivations.mockReset();
  mocks.manageAccountActivation.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PendingActivationsTable revoked invitation deletion", () => {
  it("deletes revoked invitations directly without a confirmation modal and refreshes the table", async () => {
    const onCountChange = vi.fn();
    mocks.listPendingActivations
      .mockResolvedValueOnce({
        invitations: [
          {
            ...baseInvite,
            invitation_id: "inv-pending-1",
            email: "pending@example.test",
            full_name: "Pending Person",
            status: "pending",
          },
          baseInvite,
        ],
      })
      .mockResolvedValueOnce({
        invitations: [
          {
            ...baseInvite,
            invitation_id: "inv-pending-1",
            email: "pending@example.test",
            full_name: "Pending Person",
            status: "pending",
          },
        ],
      });
    mocks.manageAccountActivation.mockResolvedValue({ ...baseInvite, deleted: true });

    render(<PendingActivationsTable actorId="admin-1" revision={0} onCountChange={onCountChange} />);

    await screen.findByText("Andres Manili");
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Role / Office" })).toBeNull();
    expect(screen.queryByText("LEDIPO")).toBeNull();

    // Only the revoked row has Delete; pending row has Resend & Revoke
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Resend" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(1);

    fireEvent.click(deleteButtons[0]);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await waitFor(() => {
      expect(mocks.manageAccountActivation).toHaveBeenCalledWith("inv-revoked-1", "delete");
    });

    await waitFor(() => {
      expect(screen.queryByText("Andres Manili")).toBeNull();
    });
    expect(screen.getByText("Invitation deleted.")).toBeTruthy();
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });
});
