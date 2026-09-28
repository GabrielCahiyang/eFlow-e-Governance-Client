import { useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Plus, Trash2 } from "lucide-react";
import { useOrgs, useProfiles } from "../../../../hooks/useSupabaseData";
import { toggleUserActive } from "../../../../../lib/supabaseService";
import { useAuth } from "../../../../contexts/AuthContext";
import { DataTable, type Column } from "../../../../components/ui/DataTable";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import { useToast } from "../../../../components/ui/Toast";
import type { UserProfile } from "../../../../types";
import { CreateUserModal } from "./CreateUserModal";
import { EditUserModal } from "./EditUserModal";
import { UserDirectoryFiltersBar } from "./UserDirectoryFiltersBar";
import { RoleBadge, StatusBadge, WorkloadBar } from "./userManagementPrimitives";
import { deleteManagedUser } from "../../services/managedUserService";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  filterAndSortUserDirectory,
  type UserDirectoryFilters,
} from "../../selectors/userDirectory";

export function UsersTab({ onOpenAccess }: { onOpenAccess: (userId: string) => void }) {
  const { profiles, loading } = useProfiles();
  const { orgs } = useOrgs();
  const { toast } = useToast();
  const { can, userProfile } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<UserDirectoryFilters>(DEFAULT_USER_DIRECTORY_FILTERS);
  const orgOptions = useMemo(() => orgs.filter((org) => org.is_active).map((org) => ({ value: org.id, label: org.name })).sort((left, right) => left.label.localeCompare(right.label)), [orgs]);
  const orgMap = useMemo(() => Object.fromEntries(orgs.map((org) => [org.id, org.name])), [orgs]);
  const visibleProfiles = useMemo(
    () => profiles.filter((profile) =>
      profile.role !== "super_admin"
      && (userProfile?.role === "super_admin" || profile.role !== "admin"),
    ),
    [profiles, userProfile?.role],
  );
  const directoryProfiles = useMemo(
    () => filterAndSortUserDirectory(visibleProfiles, orgMap, filters),
    [filters, orgMap, visibleProfiles],
  );

  const canManageUsers = can("users.manage");
  const canEditProfile = (profile: UserProfile) =>
    canManageUsers && (userProfile?.role === "super_admin" || profile.role !== "admin");
  const canManageAccountLifecycle = (profile: UserProfile) =>
    canManageUsers && (
      userProfile?.role === "super_admin"
      || profile.role === "employee"
      || profile.role === "accounting_staff"
    );

  const handleToggleStatus = async (profile: UserProfile) => {
    try {
      await toggleUserActive(profile.id, !profile.is_active);
      toast(`${profile.full_name} ${profile.is_active ? "deactivated" : "activated"}`, profile.is_active ? "warning" : "success");
    } catch (error: any) { toast(error?.message || "Failed to update status", "error"); }
  };

  const handleDelete = async () => {
    if (!deleteUser || deleteUser.id === userProfile?.id) return;
    setDeleting(true);
    try {
      await deleteManagedUser(deleteUser.id);
      toast(`User "${deleteUser.full_name}" permanently deleted`, "success");
      setDeleteUser(null);
    } catch (error: any) {
      toast(error?.message || "Failed to delete account", "error");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<UserProfile>[] = [
    { key: "name", header: "Name", sortable: true, sortValue: (profile) => profile.full_name, render: (profile) => <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[10px] font-semibold text-neutral-600">{profile.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><div className="text-[11.5px] font-medium text-neutral-900">{profile.full_name}</div><div className="text-[9.5px] text-neutral-500">{profile.email}</div></div></div> },
    { key: "role", header: "Role", sortable: true, sortValue: (profile) => profile.role, render: (profile) => <RoleBadge role={profile.role} /> },
    { key: "organization", header: "Organization", sortable: true, sortValue: (profile) => orgMap[profile.org_id || ""] || "", render: (profile) => <span className="text-[11px] text-neutral-700">{orgMap[profile.org_id || ""] || "—"}</span> },
    { key: "workload", header: "Workload", sortable: true, sortValue: (profile) => profile.workload, render: (profile) => <WorkloadBar value={profile.workload} /> },
    { key: "status", header: "Status", sortable: true, sortValue: (profile) => profile.is_active ? 1 : 0, render: (profile) => <StatusBadge active={profile.is_active} /> },
    { key: "actions", header: "", width: "300px", render: (profile) => {
      const editable = canEditProfile(profile);
      const lifecycleManageable = canManageAccountLifecycle(profile);
      const protectedTitle = lifecycleManageable ? undefined : "Only the Super Admin can change or delete a leadership account";
      return <div className="flex items-center justify-end gap-1.5"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenAccess(profile.id); }} disabled={userProfile?.role !== "super_admin"} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[9.5px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40" title={userProfile?.role !== "super_admin" ? "Only the Super Admin can manage individual access" : "Manage individual access"}><KeyRound size={11} /> Access</button><button type="button" onClick={(event) => { event.stopPropagation(); if (editable) setEditUser(profile); }} disabled={!editable} title={editable ? "Edit profile details" : "The users.manage capability is required"} className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[9.5px] font-medium text-neutral-600 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40">Edit</button><button type="button" onClick={(event) => { event.stopPropagation(); if (lifecycleManageable) void handleToggleStatus(profile); }} disabled={!lifecycleManageable} title={protectedTitle} className={`rounded-lg px-2.5 py-1.5 text-[9.5px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${profile.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>{profile.is_active ? "Deactivate" : "Activate"}</button><button type="button" onClick={(event) => { event.stopPropagation(); if (lifecycleManageable) setDeleteUser(profile); }} disabled={!lifecycleManageable || profile.id === userProfile?.id} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[9.5px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40" title={protectedTitle || (profile.id === userProfile?.id ? "You cannot delete the account you are using" : "Permanently delete account")}><Trash2 size={11} /> Delete</button></div>;
    } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-[14px] font-semibold text-neutral-900">Account directory</h3><p className="mt-0.5 text-[10.5px] text-neutral-500">Identity, role, organization, workload, and access are managed from one workspace.</p></div><button type="button" onClick={() => setShowCreate(true)} disabled={!canManageUsers} title={canManageUsers ? "Create user" : "The users.manage capability is required"} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /> Create user</button></div>
      <DataTable
        key={filters.sort}
        data={directoryProfiles}
        totalRecords={visibleProfiles.length}
        columns={columns}
        keyExtractor={(profile) => profile.id}
        onRowClick={(profile) => { if (canEditProfile(profile)) setEditUser(profile); }}
        loading={loading}
        searchPlaceholder="Search by name, email, role, or organization…"
        searchFilter={(profile, query) => profile.full_name.toLowerCase().includes(query) || profile.email.toLowerCase().includes(query) || (orgMap[profile.org_id || ""] || "").toLowerCase().includes(query) || profile.role.toLowerCase().includes(query)}
        emptyMessage="No accounts match the current filters"
        toolbar={<UserDirectoryFiltersBar value={filters} organizations={orgOptions} onChange={setFilters} />}
      />
      <CreateUserModal isOpen={showCreate} onClose={() => setShowCreate(false)} orgOptions={orgOptions} organizations={orgs} profiles={visibleProfiles} />
      <EditUserModal isOpen={Boolean(editUser)} onClose={() => setEditUser(null)} user={editUser} orgOptions={orgOptions} organizations={orgs} profiles={visibleProfiles} />
      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => { if (!open && !deleting) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700"><AlertTriangle size={19} /></div>
            <AlertDialogTitle>Delete this account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser ? <>This will remove <strong className="font-semibold text-foreground">{deleteUser.full_name}</strong> and their login account. This action cannot be undone. Accounts linked to work or audit history must be deactivated instead.</> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="inline-flex h-9 items-center justify-center rounded-lg bg-red-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
