import '../administrationWorkspace.css';
import { useAuth } from '../../../contexts/AuthContext';
import { WorkspaceShell } from '../../../components/ui/workspace';
import { UserManagement, type UserManagementTab } from './user-management';
import { useAccountDirectoryNavigation } from '../hooks/useAccountDirectoryNavigation';
import { BackupExportWorkspace } from './data-tools';
import { AdminAuditLog } from '../../audit';
import {
  SystemIntegrationsWorkspace,
  type SystemIntegrationsTab,
} from '../configuration/SystemIntegrationsWorkspace';
import {
  AccessDenied,
  administrativePages,
  isSupportPageAuthorized,
  resolveSupportPage,
  resolveSupportSubTab,
} from '../../navigation';

/** Selected-content outlet. The existing context rail/drawer owns destinations. */
export function AdministrationWorkspace({ activeSection = 'users', activePage }: {
  activeSection?: string;
  activePage?: string;
  onNavigate?: (section: string, page: string) => void;
}) {
  const { userProfile, can } = useAuth();
  const { navigation, update } = useAccountDirectoryNavigation(userProfile?.id || '', userProfile?.role || '');
  const role = userProfile?.role || '';
  const urlPage =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('page') || undefined
      : undefined;
  const canonicalActivePage = activePage ? resolveSupportPage(activeSection, activePage) : undefined;
  const canonicalUrlPage = urlPage ? resolveSupportPage(activeSection, urlPage) : undefined;
  const page = canonicalActivePage || canonicalUrlPage || resolveSupportPage(activeSection) || 'People & Accounts';
  // Keep specific sub-page tokens from ?page= (e.g. "User Access", "Status Maintenance")
  // when activePage has been normalized to the parent destination label.
  const requestedPage = urlPage && canonicalUrlPage === page ? urlPage : activePage || urlPage;
  const entry = administrativePages.find((item) => item.label === page);
  if (!isSupportPageAuthorized(role, activeSection, requestedPage, can)) {
    return <AccessDenied permission={entry?.permission || 'navigation.user_management'} />;
  }
  const subTab = resolveSupportSubTab(activeSection, requestedPage);
  const directoryProps = { directoryNavigation: navigation, onDirectoryNavigationChange: update };
  const peopleTab: UserManagementTab =
    subTab === 'locked-accounts' || subTab === 'invitations'
      ? subTab
      : 'users';
  const accessTab: UserManagementTab =
    subTab === 'user-access' ? 'user-access' : 'role-defaults';
  const systemTab: SystemIntegrationsTab =
    subTab === 'statuses' || subTab === 'skills' || subTab === 'workload' || subTab === 'retention' ? subTab : 'general';

  const contents = {
    'People & Accounts': <UserManagement initialTab={peopleTab} {...directoryProps} />,
    'Roles & Access': <UserManagement initialTab={accessTab} {...directoryProps} />,
    'Account Audit': <AdminAuditLog />,
    'System & Maintenance': <SystemIntegrationsWorkspace initialTab={systemTab} />,
    'System & Integrations': <SystemIntegrationsWorkspace initialTab={systemTab} />,
    'Backup & Export': <BackupExportWorkspace />,
  };
  return <WorkspaceShell key={`${userProfile?.id || ''}:${role}`} className="eflow-admin-workspace">{contents[page as keyof typeof contents]}</WorkspaceShell>;
}
