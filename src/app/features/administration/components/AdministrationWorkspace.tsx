import "../administrationWorkspace.css";
import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { isAdminRole } from "../../../shared/roles";
import {
  WorkspaceShell,
  WorkspaceHeader,
  WorkspaceTabs,
} from "../../../components/ui/workspace";
import { UserManagement } from "./user-management";
import { BackupExportWorkspace } from "./data-tools";
import { OrgTreeBuilder } from "../../organization";
import { AdminAuditLog } from "../../audit";
import { SystemSettings } from "../../../components/SuperAdmin/SystemSettings";
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  getAuthorizedSupportPages,
  resolveSupportPage,
  AccessDenied,
} from "../../navigation";

export function AdministrationWorkspace({
  activeSection = "users",
  activePage,
  onNavigate,
}: {
  activeSection?: string;
  activePage?: string;
  onNavigate?: (section: string, page: string) => void;
}) {
  const { userProfile, can } = useAuth();
  const initial = resolveSupportPage(activeSection, activePage) || "All Users";
  const [page, setPage] = useState<string>(initial);
  useEffect(() => {
    setPage(initial);
  }, [initial]);
  const admin = isAdminRole(userProfile?.role);
  const candidates = [
    {
      id: "All Users",
      label: "All Users",
      permission: "navigation.user_management",
      content: <UserManagement initialTab="users" />,
    },
    {id:'Locked out accounts',label:'Locked out accounts',permission:'navigation.user_management',content:<UserManagement initialTab="locked-accounts"/>},
    {
      id: "Role Defaults",
      label: "Role Defaults",
      permission: "navigation.user_management",
      content: <UserManagement initialTab="role-defaults" />,
    },
    {
      id: "User Access",
      label: "User Access",
      permission: "navigation.user_management",
      content: <UserManagement initialTab="user-access" />,
    },
    {
      id: "Office Structure",
      label: "Office Structure",
      permission: "navigation.organization",
      content: <OrgTreeBuilder />,
    },
    {
      id: "Account Audit",
      label: "Account Audit",
      permission: "navigation.audit",
      content: <AdminAuditLog />,
    },
    {
      id: "System Settings",
      label: "System Settings",
      permission: "navigation.system_settings",
      content: <SystemSettings />,
    },
    {
      id: "Backup & Export",
      label: "Backup & Export",
      permission: "navigation.data_tools",
      content: <BackupExportWorkspace />,
    },
  ];
  const allowed = getAuthorizedSupportPages(userProfile?.role || "", can);
  const tabs = candidates.filter((tab) =>
    allowed.some((item) => item.label === tab.id),
  );
  if (!tabs.some((tab) => tab.id === page))
    return (
      <AccessDenied
        permission={
          candidates.find((tab) => tab.id === page)?.permission ||
          "navigation.user_management"
        }
      />
    );
  const select = (value: string) => {
    const target = allowed.find((item) => item.label === value);
    if (!target) return;
    if (onNavigate) onNavigate(admin ? "users" : target.section, value);
    else void requestNavigation(() => setPage(value));
  };
  const accessTabs = tabs.filter((tab) =>
    ["Role Defaults", "User Access"].includes(tab.id),
  );
  const grouped = tabs
    .filter((tab) => !["Role Defaults", "User Access"].includes(tab.id))
    .map((tab) => ({
      ...tab,
      label:
        (
          {
            "All Users": "People",
            "Office Structure": "Offices",
            "Account Audit": "Audit",
            "System Settings": "System",
            "Backup & Export": "Backup",
          } as Record<string, string>
        )[tab.id] || tab.label,
    }));
  if (accessTabs.length)
    grouped.splice(2, 0, {
      id: "access",
      label: "Roles & Access",
      permission: "navigation.user_management",
      content: (
        <WorkspaceTabs
          label="Access views"
          tabs={accessTabs.map((tab) => ({
            ...tab,
            label: tab.id === "User Access" ? "Individual Access" : tab.label,
          }))}
          value={
            accessTabs.some((tab) => tab.id === page) ? page : accessTabs[0].id
          }
          onValueChange={select}
        />
      ),
    });
  return (
    <WorkspaceShell className="eflow-admin-workspace">
      <WorkspaceHeader
        title="Admin Center"
        description="Accounts, Offices, access and system support. Operational and financial decisions remain with their authorized roles."
      />
      <WorkspaceTabs
        label="Administration tools"
        tabs={grouped}
        value={accessTabs.some((tab) => tab.id === page) ? "access" : page}
        onValueChange={(value) =>
          select(value === "access" ? accessTabs[0].id : value)
        }
      />
    </WorkspaceShell>
  );
}
