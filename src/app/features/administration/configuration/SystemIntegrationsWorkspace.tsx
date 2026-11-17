import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { isAdminRole } from "../../../shared/roles";
import { requestNavigation } from "../../../shared/navigationGuard";
import { WorkspaceHeader, WorkspaceTabs, type WorkspaceTab } from "../../../components/ui/workspace";
import { ApplicationSettings } from "./ApplicationSettings";
import { SkillTagMaintenance } from "./SkillTagMaintenance";
import { StatusMaintenance } from "./StatusMaintenance";

export type SystemIntegrationsTab = "general" | "statuses" | "skills";

export function SystemIntegrationsWorkspace({
  initialTab = "general",
}: {
  initialTab?: SystemIntegrationsTab;
}) {
  const { userProfile } = useAuth();
  const isAdmin = isAdminRole(userProfile?.role);
  const [tab, setTab] = useState<SystemIntegrationsTab>(initialTab);

  useEffect(() => {
    if ((initialTab === "statuses" || initialTab === "skills") && !isAdmin) setTab("general");
    else setTab(initialTab);
  }, [initialTab, isAdmin]);

  const activeTab: SystemIntegrationsTab =
    (tab === "statuses" || tab === "skills") && !isAdmin ? "general" : tab;

  const tabs: WorkspaceTab[] = [
    {
      id: "general",
      label: "General",
      content: <ApplicationSettings embedded />,
    },
    ...(isAdmin
      ? [
          {
            id: "statuses",
            label: "Work Statuses",
            content: <StatusMaintenance embedded />,
          },
          {
            id: "skills",
            label: "Skill Tags",
            content: <SkillTagMaintenance embedded />,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-full space-y-6">
      <WorkspaceHeader
        title="System & Maintenance"
        description="Configure branding, invitation defaults, deadline rules, maintenance notices, work statuses, and skill tags."
      />
      <WorkspaceTabs
        label="System & Maintenance sections"
        value={activeTab}
        onValueChange={(next) =>
          void requestNavigation(() => setTab(next as SystemIntegrationsTab))
        }
        tabs={tabs}
      />
    </div>
  );
}
