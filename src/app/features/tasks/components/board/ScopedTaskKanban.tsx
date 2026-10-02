import { isAdminRole } from "../../../../shared/roles";
import * as React from "react";
import type { UserProfile } from "../../../../types";
import type { Employee } from "../../../../services/employeeService";
import type { Task } from "../../../../services/taskService";
import { KanbanBoardView } from "./KanbanBoardView";

function profileToBoardEmployee(profile: UserProfile): Employee {
  const name = profile.full_name || profile.fullName || profile.email || "Team member";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "??";

  return {
    id: profile.id,
    name,
    email: profile.email,
    initials,
    department: profile.org_id || profile.departmentId || undefined,
    departmentName: profile.org_name || "",
    jobTitle: profile.role.replace(/_/g, " "),
    jobDescription: Object.keys(profile.skills || {}).filter((skill) => profile.skills[skill]).join(", "),
    currentWorkload: profile.workload || 0,
  };
}

export function ScopedTaskKanban({
  tasks,
  profiles,
  role,
  currentUserId,
  currentUserName,
  readOnly = false,
  onOpenTask,
}: {
  tasks: Task[];
  profiles: UserProfile[];
  role: "depthead" | "employee";
  currentUserId?: string;
  currentUserName?: string;
  readOnly?: boolean;
  onOpenTask?: (task: Task) => void;
}) {
  const employees = React.useMemo(
    () => profiles.filter((profile) => !isAdminRole(profile.role)).map(profileToBoardEmployee),
    [profiles],
  );

  return (
    <KanbanBoardView
      tasks={tasks}
      employees={employees}
      role={role}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      readOnly={readOnly}
      onOpenTask={onOpenTask}
    />
  );
}
