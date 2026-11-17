// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkList } from "../../src/app/features/personal-work/components/WorkList";
import { WorkFilters } from "../../src/app/features/personal-work/components/WorkFilters";
import { readWorkFilters } from "../../src/app/features/personal-work/workLocation";
import { selectWorkRows } from "../../src/app/features/personal-work/workSelectors";
import type { WorkRow } from "../../src/app/features/personal-work/types";

vi.mock("../../src/app/features/work-status", () => ({
  useWorkStatuses: () => ({ definitions: [] }),
  resolveStatus: (_defs: unknown, _status: string, fallback: string) => ({
    label: fallback,
    color: "neutral",
  }),
}));

afterEach(() => cleanup());

function makeRow(overrides: Partial<WorkRow> = {}): WorkRow {
  return {
    key: "office-task:1",
    id: "1",
    rootId: "1",
    title: "Prepare logistics",
    kind: "office-task",
    projectTitle: "Ormoc MSME Outreach Program",
    workspaceId: "ws-1",
    workspaceName: "LEDIPO",
    timezone: "Asia/Singapore",
    status: "in_progress",
    due: "2026-11-20",
    progress: 0,
    mine: true,
    leading: false,
    actionable: true,
    history: false,
    relation: "Contributor",
    ...overrides,
  };
}

describe("My Work clarity, Subtask parent identification, and Filters", () => {
  it("renders clear column headers on Assigned work and explicit Project / Task labels on grouped Subtasks", () => {
    const taskRow = makeRow();
    const { rerender } = render(<WorkList rows={[taskRow]} onOpen={vi.fn()} />);

    expect(screen.getByText("Task")).toBeTruthy();
    expect(screen.getByText("Your role")).toBeTruthy();
    expect(screen.getByText("Due date")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Context")).toBeTruthy();
    expect(screen.getByText("Project: Ormoc MSME Outreach Program")).toBeTruthy();

    const subtaskRow = makeRow({
      key: "office-node:2",
      id: "2",
      rootId: "task-qa",
      title: "Prepare the participant briefing",
      rootTitle: "Prepare the LEDIPO Consultation Materials - QA",
      projectTitle: "QA — LEDIPO Consultation Readiness",
      kind: "office-node",
      workContext: {
        nodeId: "2",
        rootId: "task-qa",
        rootTitle: "Prepare the LEDIPO Consultation Materials - QA",
        path: [
          { id: "task-qa", title: "Prepare the LEDIPO Consultation Materials - QA", depth: 0, order: 0 },
          { id: "2", title: "Prepare the participant briefing", depth: 1, order: 0 },
        ],
        pathLabel: "Prepare the LEDIPO Consultation Materials - QA / Prepare the participant briefing",
        depth: 1,
        leadName: "Crisostomo Ibarra",
        contributors: [
          { id: "u1", name: "Cheryl Gallo", eligible: true },
          { id: "u2", name: "Gabriel Cahiyang", eligible: true },
          { id: "u3", name: "Andres Manili", eligible: true },
        ],
        due: "2026-11-20",
      },
    });

    rerender(<WorkList rows={[subtaskRow]} onOpen={vi.fn()} groupByParent />);
    expect(screen.getByText("Subtask")).toBeTruthy();
    expect(screen.getByText("Project", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("QA — LEDIPO Consultation Readiness", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Task", { selector: ".r10-work-group__tag" })).toBeTruthy();
    expect(screen.getByText("Prepare the LEDIPO Consultation Materials - QA")).toBeTruthy();
    expect(screen.queryByText("/")).toBeNull();
    expect(screen.getByLabelText("Lead: Crisostomo Ibarra").textContent).toBe("CI");
    expect(screen.getByLabelText("Cheryl Gallo").textContent).toBe("CG");
    expect(screen.getByLabelText("1 more: Andres Manili").textContent).toBe("+1");
  });

  it("renders functional Status, Project, and Your role filters inside the Filters popover and filters rows accurately", () => {
    const onChange = vi.fn();
    render(
      <WorkFilters
        filters={{
          date: "All my work",
          query: "",
          workspace: "",
          project: "",
          status: "",
          relation: "",
          recent: false,
        }}
        destination="Assigned work"
        workspaces={[{ id: "ws-1", name: "LEDIPO" }]}
        projects={["Ormoc MSME Outreach Program", "QA — LEDIPO Consultation Readiness"]}
        statuses={[
          { value: "todo", label: "Not started" },
          { value: "in_progress", label: "In progress" },
        ]}
        relations={["Contributor", "Task Lead"]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "in_progress" } });
    expect(onChange).toHaveBeenCalledWith({ status: "in_progress" });

    fireEvent.change(screen.getByLabelText("Filter by project"), {
      target: { value: "QA — LEDIPO Consultation Readiness" },
    });
    expect(onChange).toHaveBeenCalledWith({ project: "QA — LEDIPO Consultation Readiness" });

    fireEvent.change(screen.getByLabelText("Filter by your role"), { target: { value: "Task Lead" } });
    expect(onChange).toHaveBeenCalledWith({ relation: "Task Lead" });

    const parsed = readWorkFilters("?page=Assigned%20work&status=in_progress&project=Ormoc&role=Contributor");
    expect(parsed.status).toBe("in_progress");
    expect(parsed.project).toBe("Ormoc");
    expect(parsed.relation).toBe("Contributor");

    const rows = [
      makeRow({ key: "a", title: "Alpha", status: "in_progress", projectTitle: "Proj A", relation: "Contributor" }),
      makeRow({ key: "b", title: "Beta", status: "todo", projectTitle: "Proj B", relation: "Task Lead" }),
    ];
    expect(
      selectWorkRows(rows, "Assigned work", "All my work", "", "", false, new Date(), {
        status: "todo",
        project: "Proj B",
        relation: "Task Lead",
      }).map((r) => r.key),
    ).toEqual(["b"]);
  });
});
