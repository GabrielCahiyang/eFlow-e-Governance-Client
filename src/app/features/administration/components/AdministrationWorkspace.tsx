import '../administrationWorkspace.css';
import { useAuth } from '../../../contexts/AuthContext';
import { WorkspaceShell } from '../../../components/ui/workspace';
import { UserManagement } from './user-management';
import { useAccountDirectoryNavigation } from '../hooks/useAccountDirectoryNavigation';
import { BackupExportWorkspace } from './data-tools';
import { AdminAuditLog } from '../../audit';
import { ApplicationSettings } from '../configuration/ApplicationSettings';
import { ConfigurationMatrix } from '../configuration/ConfigurationMatrix';
import { EmailIntegrations } from '../configuration/EmailIntegrations';
import { RuntimeHealth } from '../configuration/RuntimeHealth';
import { getAuthorizedSupportPages, resolveSupportPage, AccessDenied, administrativePages } from '../../navigation';

/** Selected-content outlet. The existing context rail/drawer owns destinations. */
export function AdministrationWorkspace({ activeSection = 'users', activePage }: {
  activeSection?: string;
  activePage?: string;
  onNavigate?: (section: string, page: string) => void;
}) {
  const { userProfile, can } = useAuth();
  const { navigation, update } = useAccountDirectoryNavigation(userProfile?.id || '', userProfile?.role || '');
  const page = resolveSupportPage(activeSection, activePage) || 'All Users';
  const allowed = getAuthorizedSupportPages(userProfile?.role || '', can);
  if (!allowed.some(item => item.label === page)) return <AccessDenied permission={administrativePages.find(item => item.label === page)?.permission || 'navigation.user_management'} />;
  const directoryProps = { directoryNavigation: navigation, onDirectoryNavigationChange: update };
  const contents = {
    'All Users': <UserManagement initialTab="users" {...directoryProps} />,
    'Locked out accounts': <UserManagement initialTab="locked-accounts" />,
    'Role Defaults': <UserManagement initialTab="role-defaults" />,
    'User Access': <UserManagement initialTab="user-access" {...directoryProps} />,
    'Account Audit': <AdminAuditLog />,
    'System Settings': <ApplicationSettings />,
    'Workspace Policy': <ConfigurationMatrix area="workspace" title="Workspaces & project access policy" />,
    'Email & Integrations': <EmailIntegrations />,
    'Runtime / AI Health': <RuntimeHealth />,
    'Backup & Export': <BackupExportWorkspace />,
  };
  return <WorkspaceShell key={`${userProfile?.id || ''}:${userProfile?.role || ''}`} className="eflow-admin-workspace">{contents[page as keyof typeof contents]}</WorkspaceShell>;
}
