// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn() }));
vi.mock(
  "../../src/app/features/projects/services/projectMutationService",
  () => ({ updateProject: api.save }),
);
vi.mock(
  "../../src/app/features/projects/services/projectMetadata",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fetchProjectMetadata: api.read,
  }),
);
vi.mock("../../src/app/features/project-readiness", () => ({
  ProjectReadinessPanel: ({ canManage }: { canManage: boolean }) => (
    <button disabled={!canManage}>Confirm fixture plan</button>
  ),
}));
import { ProjectSettingsPage } from "../../src/app/features/projects/components/project-command/ProjectSettingsPage";
import { ProjectMetadataConflict } from "../../src/app/features/projects/services/projectMetadata";
import type { Project } from "../../src/app/features/projects/services/types";
const original: Project = {
  id: "project",
  title: "Initial project",
  description: "Original scope",
  priority: "medium",
  status: "planning",
  createdAt: 1,
  updatedAt: 1,
  metadataVersion: "2026-10-20T00:00:00.123456Z",
};
const newer = {
  ...original,
  title: "Saved in another tab",
  description: "New scope",
  updatedAt: 2,
  metadataVersion: "2026-10-20T00:00:01.987654Z",
};
const props = {
  project: original,
  canManage: true,
  onResolve: vi.fn(),
  onBack: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  api.save.mockResolvedValue(undefined);
  api.read.mockResolvedValue(newer);
});
afterEach(cleanup);
describe("project settings conflict and freshness contract", () => {
  it("retains entries on realtime conflict until the user explicitly reviews the latest version", async () => {
    const view = render(<ProjectSettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "My unsaved scope" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm fixture plan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    view.rerender(<ProjectSettingsPage {...props} project={newer} />);
    expect(screen.getByText(/Project updated elsewhere/)).toBeTruthy();
    expect(screen.getByDisplayValue("My unsaved scope")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Keep my entries against this version",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledExactlyOnceWith(
        "project",
        expect.objectContaining({ description: "My unsaved scope" }),
        newer.metadataVersion,
      ),
    );
  });
  it("retains a server conflict draft, fetches current values and supports explicit replacement", async () => {
    api.save.mockRejectedValue(new ProjectMetadataConflict());
    render(<ProjectSettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText(/^Project name/), {
      target: { value: "Local title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("button", { name: "Use latest values" });
    expect(screen.getByDisplayValue("Local title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use latest values" }));
    expect(screen.getByDisplayValue(newer.title)).toBeTruthy();
    expect(api.save).toHaveBeenCalledTimes(1);
  });
  it("never replays a successful save if its readback fails", async () => {
    api.read.mockRejectedValue(new Error("Refresh unavailable"));
    render(<ProjectSettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Saved once" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText(
      "Saved. Refresh project details before editing again.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh project details" }),
    );
    await screen.findByText("Refresh unavailable");
    expect(api.save).toHaveBeenCalledTimes(1);
  });
  it("resets all draft state when the project changes and closes save access on revocation", () => {
    const view = render(<ProjectSettingsPage {...props} />);
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Private old draft" },
    });
    view.rerender(
      <ProjectSettingsPage {...props} project={{ ...newer, id: "other" }} />,
    );
    expect(screen.queryByDisplayValue("Private old draft")).toBeNull();
    view.rerender(
      <ProjectSettingsPage
        {...props}
        project={{ ...newer, id: "other" }}
        canManage={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });
});
