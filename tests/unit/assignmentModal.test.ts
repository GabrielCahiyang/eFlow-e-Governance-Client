// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssignmentModal } from "../../src/app/features/proposal-import/components/AssignmentModal";

describe("proposal draft team assignment modal", () => {
  it("selects an employee and automatically designates the team leader", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      createElement(AssignmentModal, {
        open: true,
        onClose,
        employees: [
          {
            id: "profile-1",
            name: "Planning Staff One",
            email: "planning.staff1@gmail.com",
            jobTitle: "Member",
            jobDescription: "Planning employee",
            currentWorkload: 0,
            department: "planning-section",
            departmentName: "Planning & Programming Section",
          },
        ],
        selectedIds: [],
        leadId: null,
        onConfirm,
      }),
    );

    expect(screen.getByRole("dialog", { name: "Select Team and Leader" })).toBeTruthy();

    fireEvent.click(screen.getByText("Planning Staff One"));

    expect(document.body.textContent).toContain("1 member selected");
    expect(document.body.textContent).toContain("Leader: Planning Staff One");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith(["profile-1"], "profile-1");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
