import { Settings } from "@carbon/icons-react";
import {
  HeadTaskBoardView,
  YouAreLeadingView,
  useHeadTaskBoard,
} from "../tasks";
import { SubtasksWorkspace } from "../subtasks";
import { HeadProjectsWorkspace } from "../projects";
import { HeadReportsWorkspace } from "../reports";
import { ForReviewInbox } from "../reviews";
import {
  assignTask,
  createTask,
  deleteTask,
  updateTask,
  verifyTask,
} from "../../services/taskService";
import { HeadDashboard } from "../../components/Head/HeadDashboard";
import { AnnouncementCenter } from "../../components/workflow/AnnouncementCenter";
import {
  RolePageRouter,
  type RolePageSections,
} from "../../components/Layout/RolePageRouter";
import { EmployeeInsights } from "./components/EmployeeInsights";
import { TeamSupervision } from "./components/TeamSupervision";
import { useAuth } from "../../contexts/AuthContext";
import { getHeadWorkspaceLabel } from "../../shared/roles";
import { OfficeBudgetWorkspace } from "../budget";
import { OfficeIdentityAccessWorkspace } from "../team-management";
import { OfficeTeamWorkspace } from "../office-team";

export function HeadTaskBoard() {
  const {
    allEmployees,
    deptEmployees,
    deptTasks,
    isLoading,
    notes,
    userProfile,
  } = useHeadTaskBoard();
  const workspaceLabel = getHeadWorkspaceLabel(userProfile?.role);

  return (
    <HeadTaskBoardView
      loading={isLoading}
      tasks={deptTasks}
      employees={deptEmployees}
      allEmployees={allEmployees}
      employeeNotes={notes}
      role="head"
      departmentFilter={userProfile?.departmentId}
      currentUserId={userProfile?.uid}
      currentUserName={userProfile?.fullName || userProfile?.email || ""}
      onCreateTask={createTask}
      onAssign={assignTask}
      onVerify={(taskId, approve, feedback) =>
        verifyTask(taskId, approve, feedback, {
          id: userProfile?.uid,
          name: userProfile?.fullName || userProfile?.email || workspaceLabel,
        })
      }
      onUpdateTask={updateTask}
      onDeleteTask={deleteTask}
    />
  );
}

function HeadAnnouncementCenter() {
  const { userProfile } = useAuth();
  return (
    <AnnouncementCenter
      eyebrow={`${getHeadWorkspaceLabel(userProfile?.role)} · Updates`}
    />
  );
}

// ==================== ROUTER ====================

// ── Core Workflow (Phase 1) screens ──

export const headPages: RolePageSections = {
  dashboard: {
    Dashboard: HeadDashboard,
  },
  projects: {
    Projects: HeadProjectsWorkspace,
  },
  tasks: {
    "Task Board": HeadTaskBoard,
  },
  budget: {
    "Office Budget": OfficeBudgetWorkspace,
  },
  subtasks: {
    "My Subtasks": SubtasksWorkspace,
  },
  reviews: {
    "For Review": ForReviewInbox,
  },
  team: {
    "Team Supervision": TeamSupervision,
    "Office Team": OfficeTeamWorkspace,
  },
  identity: {
    "Identity & Access": OfficeIdentityAccessWorkspace,
  },
  intelligence: {
    "Team Intelligence": EmployeeInsights,
  },
  leading: {
    "Leading Work": YouAreLeadingView,
  },
  reports: {
    Reports: HeadReportsWorkspace,
  },
  announcements: {
    Announcements: HeadAnnouncementCenter,
  },

  // Compatibility aliases for sessions opened before this navigation cleanup.
  command: {
    Dashboard: HeadDashboard,
    Projects: HeadProjectsWorkspace,
    "Pinned — You're Leading": YouAreLeadingView,
    "For Review": ForReviewInbox,
    Reports: HeadReportsWorkspace,
    Announcements: HeadAnnouncementCenter,
  },
  leader: {
    "Pinned — You're Leading": YouAreLeadingView,
    "For Review": ForReviewInbox,
    "Team Workload": TeamSupervision,
  },
  deptportfolio: {
    "Task Board & Composer": HeadTaskBoard,
    "Team Supervision": TeamSupervision,
    "Team Intelligence": EmployeeInsights,
  },
};

export const headDefaultPages: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Task Board",
  budget: "Office Budget",
  subtasks: "My Subtasks",
  reviews: "For Review",
  team: "Team Supervision",
  identity: "Identity & Access",
  intelligence: "Team Intelligence",
  leading: "Leading Work",
  reports: "Reports",
  announcements: "Announcements",
  command: "Dashboard",
  leader: "Pinned — You're Leading",
  deptportfolio: "Task Board & Composer",
};

export function HeadContent({
  activeSection,
  activePage,
}: {
  activeSection: string;
  activePage?: string;
}) {
  return (
    <RolePageRouter
      sections={headPages}
      defaults={headDefaultPages}
      activeSection={activeSection}
      activePage={activePage}
      fallback={(section) => (
        <div className="flex h-full items-center justify-center text-neutral-400">
          <div className="text-center">
            <Settings size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-normal">Section unavailable</p>
            <p className="mt-1 text-[12px]">Section: {section}</p>
          </div>
        </div>
      )}
    />
  );
}
