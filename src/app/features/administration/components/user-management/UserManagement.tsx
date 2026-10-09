import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { RoleDefaultsTab, UserAccessTab } from "../../../permissions";
import { UsersTab } from "./UsersTab";
import { LockedAccountsTab } from './LockedAccountsTab';

import { requestNavigation } from "../../../../shared/navigationGuard";
export type UserManagementTab = "users" | "role-defaults" | "user-access" | "locked-accounts";

const PAGE_COPY: Record<
  UserManagementTab,
  { title: string; description: string }
> = {
  'locked-accounts': {title:'Locked out accounts',description:'Configure failed sign-in limits and unlock accounts. Only Admin can make changes.'},
  users: {
    title: "User Management",
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
}: {
  initialTab?: UserManagementTab;
}) {
  const [tab, setTab] = useState<UserManagementTab>(initialTab);
  const [selectedUserId, setSelectedUserId] = useState("");
  useEffect(() => setTab(initialTab), [initialTab]);
  const copy = PAGE_COPY[tab];

  const openAccess = (userId: string) => {
    setSelectedUserId(userId);
    setTab("user-access");
  };

  return (
    <div className="min-h-full space-y-5">
      <header>
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Administration · Identity & Access
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-neutral-950">
              {copy.title}
            </h1>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-neutral-500">
              {copy.description}
            </p>
          </div>
          {initialTab === "users" && tab === "user-access" ? (
            <button
              type="button"
              onClick={() => {
                void requestNavigation(() => setTab("users"));
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10.5px] font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              <ArrowLeft size={13} /> Back to accounts
            </button>
          ) : null}
        </div>
      </header>

      {tab === "users" ? <UsersTab onOpenAccess={openAccess} /> : null}
      {tab === 'locked-accounts' ? <LockedAccountsTab/> : null}
      {tab === "role-defaults" ? <RoleDefaultsTab /> : null}
      {tab === "user-access" ? (
        <UserAccessTab
          selectedUserId={selectedUserId || undefined}
          onSelectedUserIdChange={setSelectedUserId}
        />
      ) : null}
    </div>
  );
}
