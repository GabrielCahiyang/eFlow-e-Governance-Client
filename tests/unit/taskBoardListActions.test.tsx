// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/app/services/taskService";
import { ListTaskRow } from "../../src/app/features/tasks/components/board/ListTaskRow";

afterEach(cleanup);

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Publish completed report",
  status: "completed",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("Task board list actions", () => {
  it("shows N/A when an employee has no available row action", () => {
    render(createElement(ListTaskRow, {
      task: task({ auditHash: "audit-reference" }),
      role: "member",
      employeeById: {},
      currentUserId: "employee-1",
      onEditTeam: vi.fn(),
    }));

    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /manage publish completed report/i })).toBeNull();
  });

  it("shows Submit to the task lead when a legacy record stores the lead as a recommendation", () => {
    render(createElement(ListTaskRow, {
      task: task({
        status: "in_progress",
        recommendationLeadId: "employee-1",
      }),
      role: "member",
      employeeById: {},
      currentUserId: "employee-1",
      onEditTeam: vi.fn(),
      onSubmitRequest: vi.fn(),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Open actions for Publish completed report" }));
    expect(screen.getByText("Submit for review")).toBeTruthy();
    expect(screen.queryByText("N/A")).toBeNull();
  });
});
