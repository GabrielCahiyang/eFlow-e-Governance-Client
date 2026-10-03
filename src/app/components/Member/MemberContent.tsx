import { Settings } from "lucide-react";
import { AnnouncementCenter } from "../workflow/AnnouncementCenter";
import { YouAreLeadingView } from "../workflow/YouAreLeadingView";
import { LeaderReviewInbox } from "../Head/ForReviewInbox";
import { SubtasksWorkspace } from "../workflow/SubtasksWorkspace";
import {
  RolePageRouter,
  type RolePageSections,
} from "../Layout/RolePageRouter";
import {
  EmployeeDeadlines,
  EmployeeTaskHistory,
  EmployeeWorkReport,
} from "./EmployeeCoreWork";
import { EmployeePerformanceView } from "./EmployeePerformanceView";
import { EmployeeTaskWorkspace } from "./EmployeeTaskWorkspace";
import { EmployeeProjectsWorkspace } from "../../features/projects";

/**
 * Thin employee route manifest. The previous file mixed routing with more than
 * two thousand lines of disconnected prototype screens; active workflow pages
 * now live in focused components and share one task data source.
 */
export const employeePages: RolePageSections = {
  tasks: {
    "My Tasks": EmployeeTaskWorkspace,
  },
  projects: {
    Projects: EmployeeProjectsWorkspace,
  },
  subtasks: {
    "My Subtasks": SubtasksWorkspace,
  },
  budget: {
    // Compatibility destination for sessions/links created before contextual
    // task funding replaced the standalone petty-cash workspace.
    "Petty Cash & Expenses": EmployeeTaskWorkspace,
    "My Tasks": EmployeeTaskWorkspace,
  },
  leading: {
    "Leading Work": YouAreLeadingView,
  },
  reviews: {
    "Leader Reviews": LeaderReviewInbox,
  },
  deadlines: {
    Deadlines: EmployeeDeadlines,
  },
  history: {
    "Task History": EmployeeTaskHistory,
  },
  performance: {
    Performance: EmployeePerformanceView,
  },
  reports: {
    "Work Report": EmployeeWorkReport,
  },
  announcements: {
    Announcements: AnnouncementCenter,
  },

  // Compatibility aliases for a session that was already open before the
  // navigation consolidation. They are intentionally not shown in the sidebar.
  mywork: {
    "My Tasks": EmployeeTaskWorkspace,
    "My Subtasks": SubtasksWorkspace,
    "Pinned — You're Leading": YouAreLeadingView,
    Deadlines: EmployeeDeadlines,
    "Task History": EmployeeTaskHistory,
    Announcements: AnnouncementCenter,
    "My Work Report": EmployeeWorkReport,
  },
  leader: {
    "Pinned — You're Leading": YouAreLeadingView,
    "For Review": LeaderReviewInbox,
    "Team Workload": EmployeePerformanceView,
  },
  workspace: {
    "My Task Workspace": EmployeeTaskWorkspace,
    "My Performance Overview": EmployeePerformanceView,
  },
};

export const employeeDefaultPages: Record<string, string> = {
  tasks: "My Tasks",
  projects: "Projects",
  subtasks: "My Subtasks",
  budget: "My Tasks",
  leading: "Leading Work",
  reviews: "Leader Reviews",
  deadlines: "Deadlines",
  history: "Task History",
  performance: "Performance",
  reports: "Work Report",
  announcements: "Announcements",
  mywork: "My Tasks",
  leader: "Pinned — You're Leading",
  workspace: "My Task Workspace",
};

export function MemberContent({
  activeSection,
  activePage,
}: {
  activeSection: string;
  activePage?: string;
}) {
  return (
    <RolePageRouter
      sections={employeePages}
      defaults={employeeDefaultPages}
      activeSection={activeSection}
      activePage={activePage}
      fallback={(_section, page) => (
        <div className="flex h-full items-center justify-center text-center text-neutral-400">
          <div>
            <Settings size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-normal">
              Page unavailable
            </p>
            <p className="mt-1 text-[12px]">{page || "Member workspace"}</p>
          </div>
        </div>
      )}
    />
  );
}

export default MemberContent;
