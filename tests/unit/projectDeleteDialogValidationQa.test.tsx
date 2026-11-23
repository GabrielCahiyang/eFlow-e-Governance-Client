// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFlowCall: vi.fn(),
  deleteProject: vi.fn(),
  fetchProjectDeletionBlockers: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
}));

vi.mock("../../src/app/features/project-setup", () => ({
  projectFlowCall: (...args: unknown[]) => mocks.projectFlowCall(...args),
}));

vi.mock("../../src/app/features/projects/services/projectService", () => ({
  deleteProject: (...args: unknown[]) => mocks.deleteProject(...args),
  archiveProject: (...args: unknown[]) => mocks.archiveProject(...args),
  restoreProject: (...args: unknown[]) => mocks.restoreProject(...args),
}));

vi.mock("../../src/app/features/projects/services/projectLifecycleService", () => ({
  fetchProjectDeletionBlockers: (...args: unknown[]) =>
    mocks.fetchProjectDeletionBlockers(...args),
}));

import { ProjectDeleteDialog } from "../../src/app/features/projects/components/ProjectDeleteDialog";
import { ProjectArchiveDialog } from "../../src/app/features/projects/components/ProjectArchiveDialog";

beforeEach(() => {
  mocks.projectFlowCall.mockReset().mockResolvedValue({});
  mocks.deleteProject.mockReset().mockResolvedValue(undefined);
  mocks.fetchProjectDeletionBlockers.mockReset().mockResolvedValue([]);
  mocks.archiveProject.mockReset().mockResolvedValue(undefined);
  mocks.restoreProject.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("ProjectDeleteDialog (Discard project draft) Sir Nonel QA validations", () => {
  it("shows live character counters, minimum-5-char validation + anchored tooltip, title match validation, and warning tooltip on Discard draft", async () => {
    const onDeleted = vi.fn();
    render(
      <ProjectDeleteDialog
        projectId="proj-draft-1"
        projectTitle="s"
        draft
        open
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    const reasonInput = screen.getByLabelText(/Reason for deletion/i) as HTMLTextAreaElement;
    const confirmInput = screen.getByLabelText(/Type.*to confirm/i) as HTMLInputElement;
    const discardBtn = screen.getByRole("button", { name: "Discard draft" }) as HTMLButtonElement;

    // 1. Live bottom-right counters visible immediately on open (not hidden until 75%!)
    expect(screen.getByText("0 / 1,000")).toBeTruthy();
    expect(screen.getByText("0 / 200")).toBeTruthy();
    expect(discardBtn.disabled).toBe(true);

    // 2. Hovering disabled Discard draft button pops warning tooltip explaining what's missing
    fireEvent.mouseEnter(discardBtn.parentElement!);
    const blockedTip = await screen.findByRole("tooltip");
    expect(blockedTip.getAttribute("data-tone")).toBe("warning");
    expect(blockedTip.textContent).toContain("min. 5 characters");
    expect(blockedTip.textContent).toContain('type "s"');
    fireEvent.mouseLeave(discardBtn.parentElement!);

    // 3. Typing < 5 chars updates counter to 2 / 1,000, marks aria-invalid, and shows min-length error + anchored tooltip
    fireEvent.focus(reasonInput);
    fireEvent.change(reasonInput, { target: { value: "ww" } });
    expect(screen.getByText("2 / 1,000")).toBeTruthy();
    expect(reasonInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText(/Enter at least 5 characters \(3 more needed\)/i).length).toBeGreaterThanOrEqual(1);
    const reasonTip = await screen.findByRole("tooltip");
    expect(reasonTip.getAttribute("data-tone")).toBe("error");
    expect(reasonTip.textContent).toContain("Enter at least 5 characters (3 more needed).");

    // 4. Typing >= 5 chars clears the error & danger state
    fireEvent.change(reasonInput, { target: { value: "wwffff" } });
    expect(screen.getByText("6 / 1,000")).toBeTruthy();
    expect(reasonInput.getAttribute("aria-invalid")).toBeNull();
    fireEvent.blur(reasonInput);

    // 5. Typing wrong confirmation title shows mismatch error + anchored tooltip
    fireEvent.focus(confirmInput);
    fireEvent.change(confirmInput, { target: { value: "wrong" } });
    expect(screen.getByText("5 / 200")).toBeTruthy();
    expect(confirmInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText(/Must match "s" exactly/i).length).toBeGreaterThanOrEqual(1);
    expect(discardBtn.disabled).toBe(true);

    // 6. Typing exact confirmation title enables Discard draft & clears error
    fireEvent.change(confirmInput, { target: { value: "s" } });
    expect(confirmInput.getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByText("Project title confirmed.")).toBeTruthy();
    expect(discardBtn.disabled).toBe(false);
    fireEvent.blur(confirmInput);

    // 7. Hovering enabled Discard draft button pops irreversible warning tooltip
    fireEvent.mouseEnter(discardBtn.parentElement!);
    const readyTip = await screen.findByRole("tooltip");
    expect(readyTip.getAttribute("data-tone")).toBe("warning");
    expect(readyTip.textContent).toContain('Permanently discards "s"');
    expect(readyTip.textContent).toContain("cannot be undone");

    // 8. Submitting calls discard_private_project with trimmed values
    fireEvent.click(discardBtn);
    await waitFor(() => {
      expect(mocks.projectFlowCall).toHaveBeenCalledWith("discard_private_project", {
        p_project: "proj-draft-1",
        p_title: "s",
        p_reason: "wwffff",
      });
      expect(onDeleted).toHaveBeenCalledOnce();
    });
  });

  it("shows live counter and warning tooltip on ProjectArchiveDialog", async () => {
    render(
      <ProjectArchiveDialog
        projectId="proj-1"
        projectTitle="Road Repair"
        isArchived={false}
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("0 / 1,000")).toBeTruthy();
    const archiveBtn = screen.getByRole("button", { name: "Archive project" });
    fireEvent.mouseEnter(archiveBtn.parentElement!);
    const tip = await screen.findByRole("tooltip");
    expect(tip.getAttribute("data-tone")).toBe("warning");
    expect(tip.textContent).toContain('Moves "Road Repair" to Archived projects');
  });
});
