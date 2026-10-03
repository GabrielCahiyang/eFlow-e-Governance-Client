import { useMemo } from "react";
import { useTasks, useEmployeeNotes } from "../../../hooks/useFirebaseData";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { getDescendantOrgIds } from "../../../../lib/supabaseService";
import { useDeptDirectoryEmployees } from "../../members";

/**
 * Keeps the Department Head board's legacy organization-scoping behavior in
 * the tasks feature. Pending-assignment work intentionally remains visible for
 * triage even when it has no organization ID.
 */
export function useHeadTaskBoard() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { deptEmployees, allEmployees, directoryLoading, userProfile } =
    useDeptDirectoryEmployees({
      scope: "exact",
      includeCurrentUser: true,
      includeDepartmentHeads: true,
      activeOnly: true,
      excludeAdmins: true,
    });
  const { notes, loading: notesLoading } = useEmployeeNotes();
  const { orgs } = useOrgs();

  const scopedOrgIds = useMemo(
    () => getDescendantOrgIds(orgs, userProfile?.departmentId),
    [orgs, userProfile?.departmentId],
  );
  const deptTasks = useMemo(() => {
    if (scopedOrgIds.length === 0) return tasks;
    return tasks.filter(
      (task) =>
        !task.orgId ||
        scopedOrgIds.includes(task.orgId) ||
        task.status === "pending_assignment",
    );
  }, [tasks, scopedOrgIds]);

  return {
    allEmployees,
    deptEmployees,
    deptTasks,
    // The board can render safely while directory notes are still arriving.
    // Keep the primary loading state focused on the task stream so the page
    // does not remain blank for secondary metadata.
    isLoading: tasksLoading,
    directoryLoading,
    notesLoading,
    notes,
    userProfile,
  };
}
