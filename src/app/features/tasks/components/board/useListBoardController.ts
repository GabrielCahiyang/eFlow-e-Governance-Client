import { useCallback, useMemo, useState, type DragEvent } from "react";
import type { Employee } from "../../../../services/employeeService";
import { updateTaskStatus, type Task, type TaskStatus } from "../../../../services/taskService";
import { getDirectBoardTransitionError, STATUS_ORDER } from "./model";

interface ListBoardControllerInput {
  tasks: Task[];
  employees: Employee[];
  role: "head" | "member";
  currentUserId?: string;
  currentUserName?: string;
}

export function useListBoardController({
  tasks,
  employees,
  role,
  currentUserId,
  currentUserName,
}: ListBoardControllerInput) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [listAssignModal, setListAssignModal] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });

  const employeeById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])) as Record<string, Employee>,
    [employees],
  );

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        (task.description || "").toLowerCase().includes(query) ||
        (task.assigneeName || "").toLowerCase().includes(query) ||
        (task.proposalTitle || "").toLowerCase().includes(query) ||
        (task.programTitle || "").toLowerCase().includes(query) ||
        (task.projectTitle || "").toLowerCase().includes(query) ||
        (task.activityTitle || "").toLowerCase().includes(query) ||
        (task.hierarchyPath || "").toLowerCase().includes(query) ||
        (task.tags || []).some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [tasks, searchQuery]);

  const grouped = useMemo(() => {
    const groups = new Map<TaskStatus, Task[]>();
    STATUS_ORDER.forEach((status) => groups.set(status, []));
    filteredTasks.forEach((task) => groups.get(task.status)?.push(task));
    return STATUS_ORDER.map((status) => ({ status, tasks: groups.get(status)! }));
  }, [filteredTasks]);

  const handleDrop = useCallback(
    async (event: DragEvent, newStatus: TaskStatus) => {
      event.preventDefault();
      setDragOverStatus(null);
      const taskId = event.dataTransfer.getData("text/plain");
      if (!taskId) return;
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.status === newStatus || task.status === "completed") return;

      const transitionError = getDirectBoardTransitionError(task, newStatus, role, currentUserId);
      if (transitionError) {
        alert(transitionError);
        return;
      }

      const actor = currentUserId ? { id: currentUserId, name: currentUserName } : undefined;
      try {
        await updateTaskStatus(taskId, newStatus, actor);
      } catch (error) {
        alert(error instanceof Error ? error.message : "That status change isn't allowed.");
      }
    },
    [tasks, role, currentUserId, currentUserName],
  );

  return {
    collapsedGroups,
    setCollapsedGroups,
    searchQuery,
    setSearchQuery,
    dragOverStatus,
    setDragOverStatus,
    listAssignModal,
    setListAssignModal,
    employeeById,
    filteredTasks,
    grouped,
    handleDrop,
  };
}
