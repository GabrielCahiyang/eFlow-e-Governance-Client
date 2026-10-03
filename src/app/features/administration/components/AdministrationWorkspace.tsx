import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { isAdminRole } from "../../../shared/roles";
import { WorkspaceShell, WorkspaceHeader, WorkspaceTabs } from "../../../components/ui/workspace";
import { UserManagement } from "./user-management";
import { BackupExportWorkspace } from "./data-tools";
import { OrgTreeBuilder } from "../../organization";
import { AdminAuditLog } from "../../audit";
import { SystemSettings } from "../../../components/SuperAdmin/SystemSettings";

const SUPPORT_PAGES: Record<string, string> = { org_tree: "Office Structure", audit: "Account Audit", administration: "System Settings", migration: "Backup & Export", permissions: "Role Defaults" };
export function AdministrationWorkspace({activeSection = "users", activePage}: {activeSection?: string; activePage?: string}) {
  const { userProfile, can } = useAuth();
  const initial = SUPPORT_PAGES[activeSection] || activePage || "All Users";
  const [page,setPage] = useState(initial);
  useEffect(() => {setPage(initial);}, [initial]);
  const admin = isAdminRole(userProfile?.role);
  const candidates = [
    {id:"All Users",label:"All Users",permission:"navigation.user_management",content:<UserManagement initialTab="users" />},
    {id:"Role Defaults",label:"Role Defaults",permission:"navigation.user_management",content:<UserManagement initialTab="role-defaults" />},
    {id:"User Access",label:"User Access",permission:"navigation.user_management",content:<UserManagement initialTab="user-access" />},
    {id:"Office Structure",label:"Office Structure",permission:"navigation.organization",content:<OrgTreeBuilder />},
    {id:"Account Audit",label:"Account Audit",permission:"navigation.audit",content:<AdminAuditLog />},
    {id:"System Settings",label:"System Settings",permission:"navigation.system_settings",content:<SystemSettings />},
    {id:"Backup & Export",label:"Backup & Export",permission:"navigation.data_tools",content:<BackupExportWorkspace />},
  ];
  const tabs = candidates.filter(tab => can(tab.permission) && (admin || tab.id === "All Users"));
  const value = tabs.some(tab => tab.id===page) ? page : tabs[0]?.id || "";
  return <WorkspaceShell><WorkspaceHeader title="Administration" description="Manage accounts, office assignments, access, and system support." /><WorkspaceTabs label="Administration tools" tabs={tabs} value={value} onValueChange={setPage} /></WorkspaceShell>;
}
