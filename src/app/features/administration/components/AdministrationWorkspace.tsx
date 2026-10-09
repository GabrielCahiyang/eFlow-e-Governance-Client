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
import { ApplicationSettings } from "../configuration/ApplicationSettings";
import { ConfigurationMatrix } from "../configuration/ConfigurationMatrix";
import { EmailIntegrations } from "../configuration/EmailIntegrations";
import { RuntimeHealth } from "../configuration/RuntimeHealth";
import { useMediaQuery } from "../../../shared/useMediaQuery";
import "../../../components/ui/workspace/analyticalWorkspace.css";
import { requestNavigation } from "../../../shared/navigationGuard";
import { Button } from "../../../components/ui/button";
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
  const compact = useMediaQuery("(max-width: 767px)");
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
      content: <ApplicationSettings />,
    },
    {
      id: "Workspace Policy",
      label: "Workspaces & project access policy",
      permission: "navigation.system_settings",
      content: (
        <ConfigurationMatrix
          area="workspace"
          title="Workspaces & project access policy"
        />
      ),
    },
    {
      id: "Email & Integrations",
      label: "Email & integrations",
      permission: "navigation.system_settings",
      content: <EmailIntegrations />,
    },
    {
      id: "Runtime / AI Health",
      label: "Runtime / AI health",
      permission: "navigation.system_settings",
      content: <RuntimeHealth />,
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
  const peopleTabs = tabs.filter((tab) =>
    ["All Users", "Locked out accounts"].includes(tab.id),
  );
  const grouped = tabs
    .filter((tab) => !["Role Defaults", "User Access", "Locked out accounts"].includes(tab.id))
    .map((tab) => ({
      ...tab,
      content: tab.id === "All Users" && peopleTabs.length > 1 ? (
        <div className="space-y-5">
          <div role="group" aria-label="People views" className="flex flex-wrap gap-2">
            {peopleTabs.map((view) => (
              <Button
                key={view.id}
                type="button"
                variant={page === view.id ? "secondary" : "outline"}
                aria-pressed={page === view.id}
                onClick={() => select(view.id)}
              >
                {view.id === "All Users" ? "Accounts" : view.label}
              </Button>
            ))}
          </div>
          {(peopleTabs.find((view) => view.id === page) || peopleTabs[0]).content}
        </div>
      ) : tab.content,
      label:
        (
          {
            "All Users": "People & onboarding",
            "Office Structure": "Offices & leadership",
            "Account Audit": "Audit",
            "System Settings": "Application settings",
            "Backup & Export": "Backup & export",
          } as Record<string, string>
        )[tab.id] || tab.label,
    }));
  if (accessTabs.length)
    grouped.splice(2, 0, {
      id: "access",
      label: "Roles & permissions",
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
  const categoryOrder = [
    "All Users",
    "Office Structure",
    "access",
    "Workspace Policy",
    "System Settings",
    "Email & Integrations",
    "Runtime / AI Health",
    "Account Audit",
    "Backup & Export",
  ];
  grouped.sort(
    (a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id),
  );
  return (
    <WorkspaceShell className="eflow-admin-workspace">
      <WorkspaceHeader
        title="Admin Center"
        description="Platform support, effective configuration and operator health. Operational staffing, review and financial decisions retain their existing authorities."
      />
      <WorkspaceTabs
        label="Administration tools"
        orientation={compact ? "horizontal" : "vertical"}
        className="eflow-admin-categories"
        tabs={grouped}
        value={accessTabs.some((tab) => tab.id === page) ? "access" : peopleTabs.some((tab) => tab.id === page) ? "All Users" : page}
        onValueChange={(value) =>
          select(value === "access" ? accessTabs[0].id : value)
        }
      />
    </WorkspaceShell>
  );
}
