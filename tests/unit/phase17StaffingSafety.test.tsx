// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffingReviewPanel } from "../../src/app/features/interdepartment-collaboration/components/StaffingReviewPanel";
import type { CollaborationDraftSnapshot } from "../../src/app/features/interdepartment-collaboration/types";
import type { Organization, UserProfile } from "../../src/app/types";
import {
  installNavigationConfirmation,
  requestNavigation,
} from "../../src/app/shared/navigationGuard";

afterEach(cleanup);
const snapshot = {
  version: 1,
  proposalId: "plan",
  title: "Plan",
  description: "",
  planningAnchor: "",
  organizations: [
    { orgId: "office", staffingEnabled: true, participationRole: "owner" },
  ],
  tasks: [
    {
      key: "work",
      title: "Prepare brief",
      enabled: true,
      assignedMemberIds: ["lead", "member"],
      leadMemberId: "lead",
    },
  ],
} as CollaborationDraftSnapshot;
const profiles = [
  {
    id: "lead",
    full_name: "Current Lead",
    org_id: "office",
    role: "member",
    is_active: true,
  },
  {
    id: "member",
    full_name: "Contributor",
    org_id: "office",
    role: "member",
    is_active: true,
  },
] as UserProfile[];
const organizations = [
  { id: "office", name: "Planning Office" },
] as Organization[];
function props(onSave = vi.fn().mockResolvedValue(undefined)) {
  return { snapshot, profiles, organizations, canEditAll: true, onSave };
}

describe("Phase 17 staffing draft", () => {
  it("edits the draft directly, confirms the complete diff once and cancels with zero writes", async () => {
    const input = props();
    render(<StaffingReviewPanel {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Contributor" }));
    expect(input.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save team changes" }));
    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation.textContent).toContain("removed Contributor");
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    );
    expect(input.onSave).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", { name: "Save team changes" }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Save team changes",
      }),
    );
    await waitFor(() => expect(input.onSave).toHaveBeenCalledTimes(1));
    expect(input.onSave.mock.calls[0][0].tasks[0].assignedMemberIds).toEqual([
      "lead",
    ]);
  });
  it("retains a dirty draft during a source refresh and rejects overwriting the new plan", async () => {
    const input = props(),
      view = render(<StaffingReviewPanel {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Contributor" }));
    view.rerender(
      <StaffingReviewPanel
        {...input}
        snapshot={{ ...snapshot, description: "Updated externally" }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Remove Contributor" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save team changes" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Save team changes",
      }),
    );
    await screen.findByText(/plan changed while you were editing/);
    expect(input.onSave).not.toHaveBeenCalled();
  });
  it("keeps changes after a cancelled navigation and resets against the current source on discard", async () => {
    const input = props(),
      decide = vi.fn().mockResolvedValue(false),
      uninstall = installNavigationConfirmation(decide),
      destination = vi.fn();
    render(<StaffingReviewPanel {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Contributor" }));
    await requestNavigation(destination);
    expect(destination).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Remove Contributor" }),
    ).toBeNull();
    decide.mockResolvedValue(true);
    await requestNavigation(destination);
    await screen.findByRole("button", { name: "Remove Contributor" });
    expect(destination).toHaveBeenCalledTimes(1);
    uninstall();
  });
  it("rejects an addition that became inactive while confirmation was open", async () => {
    const input = {
      ...props(),
      snapshot: {
        ...snapshot,
        tasks: snapshot.tasks.map((task) => ({
          ...task,
          assignedMemberIds: ["lead"],
        })),
      },
    };
    const view = render(<StaffingReviewPanel {...input} />);
    fireEvent.click(screen.getByRole("button", { name: /\+.*Contributor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save team changes" }));
    const confirmation = await screen.findByRole("alertdialog");
    view.rerender(
      <StaffingReviewPanel
        {...input}
        profiles={profiles.map((person) =>
          person.id === "member" ? { ...person, is_active: false } : person,
        )}
      />,
    );
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Save team changes" }),
    );
    await screen.findByText(/no longer eligible/);
    expect(input.onSave).not.toHaveBeenCalled();
  });
});
