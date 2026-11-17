import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { isAdminRole } from "../../../../shared/roles";
import { RoleDefaultsTab, UserAccessTab } from "../../../permissions";
import { UsersTab } from "./UsersTab";
import { PendingActivationsTable } from "./PendingActivationsTable";
import { ProjectGuestAccounts } from "../../guests/ProjectGuestAccounts";
import { LockedAccountsTab } from "./LockedAccountsTab";
import { listPendingActivations } from "../../../account-activation";
import { readLoginSecurity } from "../../services/loginSecurityService";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { writeNavigationLocation } from "../../../navigation";
import {
  WorkspaceHeader,
  WorkspaceTabs,
  type WorkspaceTab,
} from "../../../../components/ui/workspace";
import { Button } from "../../../../components/ui/button";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  type UserDirectoryFilters,
} from "../../selectors/userDirectory";
import type { DataTableViewState } from "../../../../components/ui/DataTable";
export interface AccountDirectoryNavigation {
  actorId: string;
  selectedUserId: string;
  returnAccountId?: string;
  fromDirectory: boolean;
  returnFocus: boolean;
  filters: UserDirectoryFilters;
  table: DataTableViewState;
}
export type UserManagementTab =
  | "users"
  | "invitations"
  | "guests"
  | "locked-accounts"
  | "role-defaults"
  | "user-access";

const PEOPLE_TABS = new Set<UserManagementTab>([
  "users",
  "invitations",
  "guests",
  "locked-accounts",
]);

export function UserManagement({
  initialTab = "users",
  directoryNavigation,
  onDirectoryNavigationChange,
}: {
  initialTab?: UserManagementTab;
  directoryNavigation?: AccountDirectoryNavigation;
  onDirectoryNavigationChange?: Dispatch<SetStateAction<AccountDirectoryNavigation>>;
}) {
  const { userProfile, can } = useAuth();
  const isAdmin = isAdminRole(userProfile?.role);
  const canManageUsers = can("users.manage");
  const [tab, setTab] = useState<UserManagementTab>(initialTab);
  const [activationRevision, setActivationRevision] = useState(0);
  const [attention, setAttention] = useState({ pendingApprovals: 0, pendingTotal: 0, lockedCount: 0 });
  const [localSelectedUserId, setLocalSelectedUserId] = useState("");
  const [localReturnAccountId, setLocalReturnAccountId] = useState("");
  const [localFromDirectory, setLocalFromDirectory] = useState(false);
  const [localReturnFocus, setLocalReturnFocus] = useState(false);
  const [localFilters, setLocalFilters] = useState<UserDirectoryFilters>(
    DEFAULT_USER_DIRECTORY_FILTERS,
  );
  const [localTable, setLocalTable] = useState<DataTableViewState>({
    search: "",
    sortKey: null,
    sortDir: "asc",
  });
  const selectedUserId = directoryNavigation?.selectedUserId ?? localSelectedUserId;
  const fromDirectory = directoryNavigation?.fromDirectory ?? localFromDirectory;
  const returnFocus = directoryNavigation?.returnFocus ?? localReturnFocus;
  const setSelectedUserId = (id: string) => {
    if (directoryNavigation && onDirectoryNavigationChange)
      onDirectoryNavigationChange((current) => ({ ...current, selectedUserId: id }));
    else setLocalSelectedUserId(id);
  };
  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    if (!isAdmin || !canManageUsers || userProfile?.is_active === false || !PEOPLE_TABS.has(tab)) return;
    let live = true;
    void Promise.allSettled([listPendingActivations(), readLoginSecurity()]).then(([invites, lockouts]) => {
      if (!live) return;
      const pendingList = invites.status === "fulfilled" && Array.isArray(invites.value.invitations) ? invites.value.invitations : [];
      const pendingApprovals = pendingList.filter((item) => item.awaiting_authority).length;
      const lockedCount = lockouts.status === "fulfilled" ? lockouts.value.accounts.length : 0;
      setAttention({ pendingApprovals, pendingTotal: pendingList.length, lockedCount });
    });
    return () => {
      live = false;
    };
  }, [isAdmin, canManageUsers, userProfile?.id, userProfile?.is_active, activationRevision, tab]);

  const openAccess = (userId: string) => {
    void requestNavigation(() => {
      if (directoryNavigation && onDirectoryNavigationChange)
        onDirectoryNavigationChange((current) => ({
          ...current,
          selectedUserId: userId,
          returnAccountId: userId,
          fromDirectory: true,
          returnFocus: false,
        }));
      else {
        setLocalSelectedUserId(userId);
        setLocalReturnAccountId(userId);
        setLocalFromDirectory(true);
        setLocalReturnFocus(false);
      }
      setTab("user-access");
      writeNavigationLocation("users", "User Access");
    });
  };

  const inAccessCenter = tab === "role-defaults" || tab === "user-access";
  const headerCopy = inAccessCenter
    ? {
        title: "Roles & Access",
        description:
          "Choose what each role can open by default, or customize permissions for one specific person.",
      }
    : {
        title: "People & Accounts",
        description:
          "Manage staff accounts, pending invitations, temporary project guests, and locked accounts.",
      };

  const directoryNode = (
    <UsersTab
      onOpenAccess={openAccess}
      onInvitationCreated={() => setActivationRevision((n) => n + 1)}
      directoryFilters={directoryNavigation?.filters ?? localFilters}
      onDirectoryFiltersChange={
        directoryNavigation && onDirectoryNavigationChange
          ? (filters) =>
              onDirectoryNavigationChange((current) => ({ ...current, filters }))
          : setLocalFilters
      }
      tableViewState={directoryNavigation?.table ?? localTable}
      onTableViewStateChange={
        directoryNavigation && onDirectoryNavigationChange
          ? (table) =>
              onDirectoryNavigationChange((current) => ({ ...current, table }))
          : setLocalTable
      }
      focusAccountId={
        returnFocus
          ? directoryNavigation?.returnAccountId ||
            localReturnAccountId ||
            selectedUserId
          : undefined
      }
      onFocusReturned={() => {
        if (directoryNavigation && onDirectoryNavigationChange)
          onDirectoryNavigationChange((current) => ({
            ...current,
            fromDirectory: false,
            returnFocus: false,
          }));
        else {
          setLocalFromDirectory(false);
          setLocalReturnFocus(false);
        }
      }}
    />
  );

  const peopleTabs: WorkspaceTab[] = [
    {
      id: "users",
      label: "Office Accounts",
      content: directoryNode,
    },
    ...(isAdmin
      ? [
          {
            id: "invitations",
            label: attention.pendingTotal
              ? `Pending Invitations (${attention.pendingTotal})`
              : "Pending Invitations",
            content: (
              <PendingActivationsTable
                key={`${userProfile?.id}:${userProfile?.role}`}
                actorId={userProfile?.id || ""}
                revision={activationRevision}
                onCountChange={(count) =>
                  setAttention((prev) => ({ ...prev, pendingTotal: count }))
                }
              />
            ),
          },
          {
            id: "guests",
            label: "Project Guests",
            content: <ProjectGuestAccounts key={userProfile?.id} />,
          },
          {
            id: "locked-accounts",
            label: attention.lockedCount
              ? `Lockouts & Security (${attention.lockedCount})`
              : "Lockouts & Security",
            content: <LockedAccountsTab />,
          },
        ]
      : []),
  ];

  const accessTabs: WorkspaceTab[] = [
    {
      id: "role-defaults",
      label: "Role Defaults",
      content: <RoleDefaultsTab />,
    },
    {
      id: "user-access",
      label: "Individual Access",
      content: (
        <UserAccessTab
          selectedUserId={
            directoryNavigation ? selectedUserId : selectedUserId || undefined
          }
          onSelectedUserIdChange={setSelectedUserId}
        />
      ),
    },
  ];

  const switchPeopleTab = (next: string) => {
    void requestNavigation(() => {
      const nextTab = next as UserManagementTab;
      setTab(nextTab);
      if (nextTab === "users") writeNavigationLocation("users", "All Users");
      else if (nextTab === "invitations") writeNavigationLocation("users", "Pending Invitations");
      else if (nextTab === "guests") writeNavigationLocation("users", "Project Guests");
      else if (nextTab === "locked-accounts") writeNavigationLocation("users", "Locked out accounts");
    });
  };

  const switchAccessTab = (next: string) => {
    void requestNavigation(() => {
      const nextTab = next as UserManagementTab;
      setTab(nextTab);
      writeNavigationLocation(
        "users",
        nextTab === "user-access" ? "User Access" : "Role Defaults",
      );
    });
  };

  return (
    <div className="min-h-full space-y-5">
      <WorkspaceHeader
        title={headerCopy.title}
        description={headerCopy.description}
        actions={
          fromDirectory && tab === "user-access" ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                void requestNavigation(() => {
                  if (directoryNavigation && onDirectoryNavigationChange)
                    onDirectoryNavigationChange((current) => ({
                      ...current,
                      returnFocus: true,
                    }));
                  else setLocalReturnFocus(true);
                  setTab("users");
                  writeNavigationLocation("users", "All Users");
                });
              }}
            >
              <ArrowLeft size={13} aria-hidden="true" /> Back to accounts
            </Button>
          ) : null
        }
      />

      {!inAccessCenter &&
        isAdmin &&
        (attention.pendingApprovals > 0 || attention.lockedCount > 0) && (
          <div className="eflow-admin-attention-banner" role="status">
            <span className="inline-flex items-center gap-2">
              <AlertCircle size={16} aria-hidden="true" />
              <span>
                {[
                  attention.pendingApprovals > 0
                    ? `${attention.pendingApprovals} invitation${attention.pendingApprovals === 1 ? "" : "s"} waiting for Admin role approval`
                    : "",
                  attention.lockedCount > 0
                    ? `${attention.lockedCount} locked account${attention.lockedCount === 1 ? "" : "s"} needing review`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {attention.pendingApprovals > 0 && tab !== "invitations" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => switchPeopleTab("invitations")}
                >
                  Review invitations
                </Button>
              )}
              {attention.lockedCount > 0 && tab !== "locked-accounts" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => switchPeopleTab("locked-accounts")}
                >
                  Review locked accounts
                </Button>
              )}
            </div>
          </div>
        )}

      {inAccessCenter ? (
        <WorkspaceTabs
          label="Roles & Access views"
          value={tab}
          onValueChange={switchAccessTab}
          tabs={accessTabs}
        />
      ) : isAdmin ? (
        <WorkspaceTabs
          label="People & Accounts views"
          value={tab}
          onValueChange={switchPeopleTab}
          tabs={peopleTabs}
        />
      ) : (
        directoryNode
      )}
    </div>
  );
}
