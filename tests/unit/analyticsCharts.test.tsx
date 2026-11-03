// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/app/features/analytics/hooks/useAnalyticsFunding", () => ({
  useAnalyticsFunding: () => ({ data: new Map(), errors: new Set() }),
}));
import { DeliveryAnalytics } from "../../src/app/features/analytics/components/DeliveryAnalytics";
import type { AnalyticsInput } from "../../src/app/features/analytics/types";
afterEach(cleanup);
const input: AnalyticsInput = {
  people: [{ id: "lead", name: "Gabriel" }],
  projects: [{ id: "p", title: "Seminar", status: "active" }],
  tasks: [
    {
      id: "a",
      title: "Prepare",
      status: "todo",
      assigneeId: "lead",
      linkedProjectId: "p",
      deadline: "2026-11-05",
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "b",
      title: "Finish",
      status: "completed",
      assigneeId: "lead",
      linkedProjectId: "p",
      createdAt: 1,
      updatedAt: 1,
    },
  ] as any,
  facts: {
    subtasks: [],
    progress: [],
    submissions: [],
    statusHistory: [],
    evidence: [],
  },
};
it("keeps the home overview graphical and opens a task drilldown from a donut legend", () => {
  render(<DeliveryAnalytics input={input} overview onOpenTask={vi.fn()} />);
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(
    within(screen.getByRole("region", { name: "Task status" })).getByRole(
      "button",
      { name: /Completed/ },
    ),
  );
  const table = screen.getByRole("table", { name: "Task analytics" });
  expect(within(table).getByText("Finish")).toBeTruthy();
  expect(within(table).queryByText("Prepare")).toBeNull();
});
it("opens a real task from detailed analytics and applies a deadline range", () => {
  const open = vi.fn();
  render(
    <DeliveryAnalytics input={input} initialTable="tasks" onOpenTask={open} />,
  );
  fireEvent.change(screen.getByLabelText("Deadline from"), {
    target: { value: "2026-11-04" },
  });
  const table = screen.getByRole("table", { name: "Task analytics" });
  expect(within(table).queryByText("Finish")).toBeNull();
  fireEvent.click(within(table).getByRole("button", { name: "Prepare" }));
  expect(open).toHaveBeenCalledWith(input.tasks[0]);
});
it("does not turn failed analytics reads into successful zero charts or employee comparisons", () => {
  render(
    <DeliveryAnalytics
      input={input}
      onOpenTask={vi.fn()}
      error="Access could not be verified"
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Access could not be verified",
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
});

it("drills active workload into unfinished tasks rather than completed work", () => {
  render(<DeliveryAnalytics input={input} overview onOpenTask={vi.fn()} />);
  fireEvent.click(within(screen.getByRole("region", {name:"Team workload"})).getByRole("button", {name:/Gabriel/}));
  const table=screen.getByRole("table", {name:"Task analytics"});
  expect(within(table).getByText("Prepare")).toBeTruthy();
  expect(within(table).queryByText("Finish")).toBeNull();
});
