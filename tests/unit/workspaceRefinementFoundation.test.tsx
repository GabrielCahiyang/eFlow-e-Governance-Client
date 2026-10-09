// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionMenu, PeopleAvatarStack, WorkspacePopover } from "../../src/app/components/ui/workspace";
import { ProjectLifecycleLabel, ProjectScheduleLabel, ProjectStatusBadge } from "../../src/app/features/projects/presentation/projectPresentation";

afterEach(cleanup);
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

describe("R1 shared presentation", () => {
  it("makes all participant names available on click, including overflow and missing identities", async () => {
    render(<PeopleAvatarStack limit={1} people={[{ id: "a", name: "Alex Rivera" }, { id: "b", name: "Maria Santos with a long name" }, { id: "c", name: "" }]} />);
    expect(screen.getByRole("img", { name: "Alex Rivera" }).tabIndex).toBe(0);
    expect(screen.queryByRole("img", { name: /Maria/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all people" }));
    expect(await screen.findByText("Maria Santos with a long name")).toBeTruthy();
    expect(screen.getByText("Name unavailable")).toBeTruthy();
  });
  it("handles empty and zero-visible avatar stacks", () => {
    const view = render(<PeopleAvatarStack people={[]} />);
    expect(screen.getByText("No people assigned")).toBeTruthy();
    view.rerender(<PeopleAvatarStack limit={0} people={[{ id: "a", name: "Alex" }]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Show all people" }).textContent).toContain("+1");
  });
  it("preserves popover and action-menu triggers when adding supplemental Vibe help", async () => {
    const select = vi.fn();
    render(<><WorkspacePopover tooltip="Supported fields" trigger={<button>Columns</button>}><p>Essential column guidance</p></WorkspacePopover><ActionMenu tooltip="Workspace actions" trigger={<button>Actions</button>} actions={[{ id: "refresh", label: "Refresh", onSelect: select }]} /></>);
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(await screen.findByText("Essential column guidance")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "Columns" }), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Refresh" }));
    expect(select).toHaveBeenCalledOnce();
  });
  it("uses semantic pairs and readable text for Planning beside On track and keeps existing status meanings", () => {
    const view = render(<><ProjectLifecycleLabel status="planning" /><ProjectScheduleLabel health="on_track" /></>);
    expect(screen.getByRole("status", { name: "Project lifecycle: Planning" }).querySelector(".eflow-project-label--info")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Project schedule: On track" }).querySelector(".eflow-project-label--positive")).toBeTruthy();
    for (const health of ["overdue", "at_risk", "due_soon", "completed"] as const) {
      view.rerender(<ProjectStatusBadge status="active" health={health} />);
      expect(screen.getByRole("status").textContent).toMatch(/Overdue|At risk|Due soon|Completed/);
    }
    view.rerender(<ProjectScheduleLabel health="on_track" empty />);
    expect(screen.getByRole("status").textContent).toBe("No scheduled work");
  });
});
