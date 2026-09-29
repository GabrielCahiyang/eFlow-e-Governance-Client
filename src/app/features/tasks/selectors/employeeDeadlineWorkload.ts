import type { Task } from "../taskTypes";
import { calculateDeadlineWorkload } from "./deadlineWorkload";

/** Keep the existing AI score while attaching readable task-time evidence for UI. */
export function withEmployeeDeadlineWorkload<T extends { id: string; currentWorkload: number }>(employees: T[], tasks: Task[], now = Date.now()) {
  return employees.map((employee) => {
    const deadlineWorkload = calculateDeadlineWorkload(tasks.filter((task) => task.assigneeId === employee.id || task.teamMemberIds?.includes(employee.id)), now, employee.id);
    return { ...employee, currentWorkload: deadlineWorkload.signal, deadlineWorkload };
  });
}
