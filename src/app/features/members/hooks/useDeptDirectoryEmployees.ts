import { useMemo } from "react";
import type { Employee } from "../../../services/employeeService";
import { useEmployees, useUsers, useDepartments } from "../../../hooks/useFirebaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useOrgs } from "../../../hooks/useSupabaseData";
import {
  getDirectoryProfileId,
  profileToDirectoryEmployee,
} from "../services/profileDirectoryAdapter";
import {
  getDepartmentEmployeeScopeIds,
  type DepartmentEmployeeScope,
} from "../services/departmentScope";
import { isEligibleDepartmentDirectoryEmployee } from "../services/departmentDirectoryEligibility";

export function useDeptDirectoryEmployees({
  scope = "with_children",
  includeCurrentUser = false,
  includeDepartmentHeads = false,
  activeOnly = false,
  excludeAdmins = false,
}: {
  scope?: DepartmentEmployeeScope;
  includeCurrentUser?: boolean;
  includeDepartmentHeads?: boolean;
  activeOnly?: boolean;
  excludeAdmins?: boolean;
} = {}) {
  const { employees: allEmployees, loading: employeesLoading } = useEmployees();
  const { users, loading: usersLoading } = useUsers();
  const { departments } = useDepartments();
  const { userProfile } = useAuth();
  const { orgs } = useOrgs();

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => {
      if (dept.id) {
        map.set(dept.id, dept.name);
      }
    });
    return map;
  }, [departments]);

  const usersAsEmployees = useMemo<Employee[]>(() => {
    return users
      .map((user) => profileToDirectoryEmployee(user, departmentNameById))
      .filter((employee): employee is Employee => Boolean(employee));
  }, [users, departmentNameById]);

  const userById = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    users.forEach((user) => {
      const id = getDirectoryProfileId(user);
      if (id) map.set(id, user);
    });
    return map;
  }, [users]);

  const userByEmail = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    users.forEach((user) => {
      if (user.email) {
        map.set(user.email.toLowerCase(), user);
      }
    });
    return map;
  }, [users]);

  const headUsers = useMemo(() => {
    const ids = new Set<string>();
    const emails = new Set<string>();
    departments.forEach((dept) => {
      if (!dept.headUserId) return;
      ids.add(dept.headUserId);
      const head = userById.get(dept.headUserId);
      if (head?.email) {
        emails.add(head.email.toLowerCase());
      }
    });
    return { ids, emails };
  }, [departments, userById]);

  const directoryEmployees = useMemo(() => {
    const merged = new Map<string, Employee>();
    const emails = new Set<string>();

    allEmployees.forEach((emp) => {
      merged.set(emp.id, emp);
      if (emp.email) {
        emails.add(emp.email.toLowerCase());
      }
    });

    usersAsEmployees.forEach((emp) => {
      const emailKey = emp.email?.toLowerCase();
      if (emailKey && emails.has(emailKey)) {
        return;
      }
      if (!merged.has(emp.id)) {
        merged.set(emp.id, emp);
      }
    });

    return Array.from(merged.values());
  }, [allEmployees, usersAsEmployees]);

  const scopedOrgIds = useMemo(() => {
    return getDepartmentEmployeeScopeIds(
      orgs,
      userProfile?.departmentId,
      scope,
    );
  }, [orgs, scope, userProfile?.departmentId]);

  const deptEmployees = useMemo(() => {
    if (!userProfile?.departmentId) return directoryEmployees;
    const currentUserId = userProfile.id || userProfile.uid;

    return directoryEmployees.filter((emp) => {
      const matchById = userById.get(emp.id);
      const matchByEmail = emp.email
        ? userByEmail.get(emp.email.toLowerCase())
        : undefined;
      const matchedUser = matchById || matchByEmail;

      return isEligibleDepartmentDirectoryEmployee(emp, matchedUser, {
        scopedOrgIds,
        currentUserId,
        currentUserEmail: userProfile.email,
        headUserIds: headUsers.ids,
        headUserEmails: headUsers.emails,
        includeCurrentUser,
        includeDepartmentHeads,
        activeOnly,
        excludeAdmins,
      });
    });
  }, [
    activeOnly,
    directoryEmployees,
    excludeAdmins,
    headUsers,
    includeCurrentUser,
    includeDepartmentHeads,
    userByEmail,
    userById,
    userProfile?.departmentId,
    userProfile?.email,
    userProfile?.id,
    userProfile?.uid,
    scopedOrgIds,
  ]);

  const directoryLoading = employeesLoading || usersLoading;

  return {
    deptEmployees,
    allEmployees: directoryEmployees,
    directoryLoading,
    userProfile,
    profilesById: userById,
    profilesByEmail: userByEmail,
  };
}
