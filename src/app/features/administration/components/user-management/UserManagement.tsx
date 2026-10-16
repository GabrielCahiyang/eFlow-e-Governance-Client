import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft } from "lucide-react";
import { RoleDefaultsTab, UserAccessTab } from "../../../permissions";
import { UsersTab } from "./UsersTab";
import { LockedAccountsTab } from './LockedAccountsTab';

import { requestNavigation } from "../../../../shared/navigationGuard";
import { writeNavigationLocation } from '../../../navigation';
import { WorkspaceHeader } from '../../../../components/ui/workspace';
import { Button } from '../../../../components/ui/button';
import { DEFAULT_USER_DIRECTORY_FILTERS, type UserDirectoryFilters } from '../../selectors/userDirectory';
import type { DataTableViewState } from '../../../../components/ui/DataTable';
export interface AccountDirectoryNavigation {
  actorId: string;
  selectedUserId: string;
  returnAccountId?: string;
  fromDirectory: boolean;
  returnFocus: boolean;
  filters: UserDirectoryFilters;
  table: DataTableViewState;
}
export type UserManagementTab = "users" | "role-defaults" | "user-access" | "locked-accounts";

const PAGE_COPY: Record<
  UserManagementTab,
  { title: string; description: string }
> = {
  'locked-accounts': {title:'Locked out accounts',description:'Configure failed sign-in limits and unlock accounts. Only Admin can make changes.'},
  users: {
    title: "All Users",
    description:
      "Manage accounts, roles, organizations, and individual access.",
  },
  "role-defaults": {
    title: "Role Defaults",
    description: "Set the baseline pages and actions available to each role.",
  },
  "user-access": {
    title: "User Access",
    description: "Manage individual access exceptions and organization scope.",
  },
};

export function UserManagement({
  initialTab = "users",
  directoryNavigation,
  onDirectoryNavigationChange,
}: {
  initialTab?: UserManagementTab;
  directoryNavigation?: AccountDirectoryNavigation;
  onDirectoryNavigationChange?: Dispatch<SetStateAction<AccountDirectoryNavigation>>;
}) {
  const [localTab, setTab] = useState<UserManagementTab>(initialTab);
  const tab = directoryNavigation ? initialTab : localTab;
  const [localSelectedUserId, setLocalSelectedUserId] = useState('');
  const [localReturnAccountId, setLocalReturnAccountId] = useState('');
  const [localFromDirectory, setLocalFromDirectory] = useState(false);
  const [localReturnFocus, setLocalReturnFocus] = useState(false);
  const [localFilters, setLocalFilters] = useState(DEFAULT_USER_DIRECTORY_FILTERS);
  const [localTable, setLocalTable] = useState<DataTableViewState>({ search: '', sortKey: null, sortDir: 'asc' });
  const selectedUserId = directoryNavigation?.selectedUserId ?? localSelectedUserId;
  const fromDirectory = directoryNavigation?.fromDirectory ?? localFromDirectory;
  const returnFocus = directoryNavigation?.returnFocus ?? localReturnFocus;
  const setSelectedUserId = (id: string) => {
    if (directoryNavigation && onDirectoryNavigationChange) onDirectoryNavigationChange(current => ({ ...current, selectedUserId: id }));
    else setLocalSelectedUserId(id);
  };
  useEffect(() => setTab(initialTab), [initialTab]);
  const copy = PAGE_COPY[tab];

  const openAccess = (userId: string) => {
    void requestNavigation(() => {
      if (directoryNavigation && onDirectoryNavigationChange) onDirectoryNavigationChange(current => ({ ...current, selectedUserId: userId, returnAccountId: userId, fromDirectory: true, returnFocus: false }));
      else { setLocalSelectedUserId(userId); setLocalReturnAccountId(userId); setLocalFromDirectory(true); setLocalReturnFocus(false); }
      setTab('user-access');
      writeNavigationLocation('users', 'User Access');
    });
  };

  return (
    <div className="min-h-full space-y-5">
      <WorkspaceHeader title={copy.title} description={copy.description} actions={
          fromDirectory && tab === "user-access" ? (
            <Button variant="outline"
              type="button"
              onClick={() => {
                void requestNavigation(() => {
                  if (directoryNavigation && onDirectoryNavigationChange) onDirectoryNavigationChange(current => ({ ...current, returnFocus: true }));
                  else setLocalReturnFocus(true);
                  setTab('users'); writeNavigationLocation('users', 'All Users');
                });
              }}
            >
              <ArrowLeft size={13} /> Back to accounts
            </Button>
          ) : null
      } />

      {tab === 'users' ? <UsersTab
        onOpenAccess={openAccess}
        directoryFilters={directoryNavigation?.filters ?? localFilters}
        onDirectoryFiltersChange={directoryNavigation && onDirectoryNavigationChange ? filters => onDirectoryNavigationChange(current => ({ ...current, filters })) : setLocalFilters}
        tableViewState={directoryNavigation?.table ?? localTable}
        onTableViewStateChange={directoryNavigation && onDirectoryNavigationChange ? table => onDirectoryNavigationChange(current => ({ ...current, table })) : setLocalTable}
        focusAccountId={returnFocus ? directoryNavigation?.returnAccountId || localReturnAccountId || selectedUserId : undefined}
        onFocusReturned={() => { if (directoryNavigation && onDirectoryNavigationChange) onDirectoryNavigationChange(current => ({ ...current, fromDirectory: false, returnFocus: false })); else { setLocalFromDirectory(false); setLocalReturnFocus(false); } }}
      /> : null}
      {tab === 'locked-accounts' ? <LockedAccountsTab/> : null}
      {tab === "role-defaults" ? <RoleDefaultsTab /> : null}
      {tab === "user-access" ? (
        <UserAccessTab
          selectedUserId={directoryNavigation ? selectedUserId : selectedUserId || undefined}
          onSelectedUserIdChange={setSelectedUserId}
        />
      ) : null}
    </div>
  );
}
