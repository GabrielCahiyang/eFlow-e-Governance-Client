import { describe, expect, it } from "vitest";
import { calculateDeadlineWorkload, workingHoursBetween, taskDurationHours, workloadDeadline, taskEstimateError } from "../../src/app/features/tasks/selectors/deadlineWorkload";
import type { Task } from "../../src/app/features/tasks/taskTypes";
import { withEmployeeDeadlineWorkload } from "../../src/app/features/tasks/selectors/employeeDeadlineWorkload";
const task = (deadline: string, estimatedHours = 8, patch: Partial<Task> = {}): Task => ({ id: crypto.randomUUID(), title: "Work", status: "todo", createdAt: 1, updatedAt: 1, deadline, estimatedHours, ...patch });
const monday = Date.parse("2026-09-28T08:00:00+08:00");
describe("task duration and deadline pressure", () => {
  it("requires valid provided estimates while keeping older plans without estimates readable", () => {
    for (const hours of [-8, 0, NaN, Infinity]) expect(taskEstimateError(hours)).toBe("Estimated task days must be greater than zero.");
    expect(taskEstimateError(undefined)).toBeUndefined();
    expect(taskEstimateError(1)).toBeUndefined();
  });
  it("updates assignment choices from current deadlines and includes supporting team members", () => {
    const employees = [{ id: "a", currentWorkload: 0 }, { id: "b", currentWorkload: 100 }];
    const rows = withEmployeeDeadlineWorkload(employees, [task("2026-09-28T18:00:00+08:00", 24, { assigneeId: "a", teamMemberIds: ["a", "b"] })], monday);
    expect(rows.map((row) => row.deadlineWorkload.label)).toEqual(["Very high", "Very high"]);
    expect(rows[1].deadlineWorkload.remainingHours).toBe(12);
    expect(employees[0].currentWorkload).toBe(0);
    expect(rows[0].currentWorkload).toBeGreaterThanOrEqual(85);
  });
  it("rates three tasks due in a week below two tasks due tonight and tomorrow", () => {
    const week = calculateDeadlineWorkload(Array.from({ length: 3 }, () => task("2026-10-02")), monday);
    const urgent = calculateDeadlineWorkload([task("2026-09-28T18:00:00+08:00"), task("2026-09-29T08:00:00+08:00")], monday);
    expect(week.label).toBe("Moderate"); expect(week.pressurePercent).toBe(60);
    expect(urgent.label).toBe("Very high"); expect(urgent.pressurePercent).toBe(200);
  });
  it("excludes weekends, lunch, finished work, review work, and archived tasks", () => {
    expect(workingHoursBetween(Date.parse("2026-10-02T08:00+08:00"), Date.parse("2026-10-05T17:00+08:00"))).toBe(16);
    const result = calculateDeadlineWorkload([task("2026-09-28", 80, { status: "completed" }), task("2026-09-28", 80, { status: "for_review" }), task("2026-09-28", 80, { archivedAt: 1 })], monday);
    expect(result.remainingHours).toBe(0); expect(result.label).toBe("Light");
  });
  it("marks unknown data, preserves timestamps, and uses remaining shared effort", () => {
    expect(calculateDeadlineWorkload([task("2026-10-02", 0)], monday).label).toBe("Estimate needed");
    expect(workloadDeadline(task("2026-09-28"))).toBe(Date.parse("2026-09-28T23:59:59.999+08:00"));
    expect(calculateDeadlineWorkload([task("2026-10-02", 16, { percentComplete: 50, assigneeId: "a", teamMemberIds: ["a", "b"] })], monday, "a").remainingHours).toBe(4);
    expect(taskDurationHours("2 days")).toBe(16); expect(taskDurationHours("3 hours")).toBe(3); expect(taskDurationHours("TBD")).toBeUndefined();
  });
});
