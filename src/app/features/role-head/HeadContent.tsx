import { Settings } from "@carbon/icons-react";
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import {
  HeadTaskBoardView,
  useHeadTaskBoard,
} from "../tasks";
import { SubtasksWorkspace } from "../subtasks";
import { HeadProjectsWorkspace } from "../projects";
import { HeadReportsWorkspace } from "../reports";
import { ForReviewInbox, TaskReviewPanel, canUserReviewTask } from "../reviews";
import {
  assignTask,
  createTask,
  deleteTask,
  updateTask,
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
import { EmployeeAnalyticsWorkspace, OfficeIdentityAccessWorkspace } from "../team-management";
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
  const { user, can } = useAuth();
  const canAssignTasks = typeof can === "function" ? can("tasks.assign") : true;
  const canVerifyTasks = typeof can === "function" ? can("tasks.verify") : true;
  const [reviewId, setReviewId] = useState<string>();
  const reviewTask = deptTasks.find(task => task.id === reviewId);

  return (<>
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
      onCreateTask={canAssignTasks ? createTask : undefined}
      onAssign={canAssignTasks ? assignTask : undefined}
      onOpenReview={setReviewId}
      onUpdateTask={updateTask}
      onDeleteTask={deleteTask}
    />
    {reviewTask && <Modal isOpen title="Review task submission" onClose={() => setReviewId(undefined)}>
      <TaskReviewPanel task={reviewTask} canReview={canVerifyTasks && canUserReviewTask(reviewTask, user?.id, userProfile?.role)}
        onDecided={() => setReviewId(undefined)} />
    </Modal>}
  </>);
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
    "Analytics": EmployeeAnalyticsWorkspace,
    "Team Supervision": TeamSupervision,
    "Office Team": OfficeTeamWorkspace,
  },
  identity: {
    "Identity & Access": OfficeIdentityAccessWorkspace,
  },
  intelligence: {
    "Analytics": EmployeeAnalyticsWorkspace,
    "Team Intelligence": EmployeeInsights,
  },
  reports: {
    Reports: HeadReportsWorkspace,
  },
  announcements: {
    Announcements: HeadAnnouncementCenter,
  },

};

export const headDefaultPages: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Task Board",
  budget: "Office Budget",
  subtasks: "My Subtasks",
  reviews: "For Review",
  team: "Analytics",
  identity: "Identity & Access",
  intelligence: "Analytics",
  reports: "Reports",
  announcements: "Announcements",
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
