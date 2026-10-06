import { isAdminRole } from "../../../../shared/roles";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, KeyRound, Plus, Trash2 } from "lucide-react";
import { useOrgs, useProfiles } from "../../../../hooks/useSupabaseData";
import { toggleUserActive } from "../../../../../lib/supabaseService";
import { useAuth } from "../../../../contexts/AuthContext";
import { Button } from "../../../../components/ui/button";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
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
import {
  RoleBadge,
  StatusBadge,
  WorkloadBar,
} from "./userManagementPrimitives";
import { deleteManagedUser } from "../../services/managedUserService";
import { isLastActiveAdmin } from "../../selectors/adminAccountProtection";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  filterAndSortUserDirectory,
  type UserDirectoryFilters,
} from "../../selectors/userDirectory";

import { AccountInspector } from "./AccountInspector";
import { useConfirmation } from "../../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
export function UsersTab({
  onOpenAccess,
}: {
  onOpenAccess: (userId: string) => void;
}) {
  const { profiles, loading } = useProfiles();
  const { orgs } = useOrgs();
  const { toast } = useToast();
  const { can, userProfile } = useAuth();
  const [inspected, setInspected] = useState<UserProfile | null>(null);
  const confirmation = useConfirmation();
  const [lifecycleResult, setLifecycleResult] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const deletePending = useRef(false);
  const statusPending = useRef(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const lifecycleDraft = useExplicitDraft(
    "Account lifecycle change",
    false,
    changingStatus,
    () => {},
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<UserDirectoryFilters>(
    DEFAULT_USER_DIRECTORY_FILTERS,
  );
  const orgOptions = useMemo(
    () =>
      orgs
        .filter((org) => org.is_active)
        .map((org) => ({ value: org.id, label: org.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [orgs],
  );
  const orgMap = useMemo(
    () => Object.fromEntries(orgs.map((org) => [org.id, org.name])),
    [orgs],
  );
  const visibleProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          isAdminRole(userProfile?.role) || !isAdminRole(profile.role),
      ),
    [profiles, userProfile?.role],
  );
  const directoryProfiles = useMemo(
    () => filterAndSortUserDirectory(visibleProfiles, orgMap, filters),
    [filters, orgMap, visibleProfiles],
  );

  const canManageUsers = can("users.manage");
  const canEditProfile = (profile: UserProfile) =>
    canManageUsers &&
    (isAdminRole(userProfile?.role) || !isAdminRole(profile.role));
  const canManageAccountLifecycle = (profile: UserProfile) =>
    canManageUsers &&
    (isAdminRole(userProfile?.role) ||
      profile.role === "member" ||
      profile.role === "accounting_staff") &&
    !isLastActiveAdmin(profile, profiles) &&
    profile.id !== userProfile?.id;

  const handleToggleStatus = async (profile: UserProfile) => {
    if (statusPending.current || !canManageAccountLifecycle(profile)) return;
    statusPending.current = true;
    lifecycleDraft.pendingRef.current = true;
    setChangingStatus(true);
    setLifecycleError("");
    try {
      if (
        !(await confirmation.confirm({
          title: `${profile.is_active ? "Deactivate" : "Activate"} account?`,
          description: `${profile.full_name} · ${profile.email}. ${profile.is_active ? "This removes active access; work and audit history remain. Any leadership assignment is still protected by the server." : "This restores active access under the current role and Office scope."}`,
          actionLabel: profile.is_active
            ? "Deactivate account"
            : "Activate account",
          danger: profile.is_active,
        }))
      )
        return;
      await toggleUserActive(profile.id, !profile.is_active);
      setLifecycleResult(
        `${profile.full_name}: ${profile.is_active ? "Inactive" : "Active"}. Saved.`,
      );
      toast(
        `${profile.full_name} ${profile.is_active ? "deactivated" : "activated"}`,
        profile.is_active ? "warning" : "success",
      );
    } catch (error: any) {
      setLifecycleError(error?.message || "Failed to update status");
      toast(error?.message || "Failed to update status", "error");
    } finally {
      statusPending.current = false;
      lifecycleDraft.pendingRef.current = false;
      setChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (
      !deleteUser ||
      deleteUser.id === userProfile?.id ||
      deletePending.current
    )
      return;
    deletePending.current = true;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteManagedUser(deleteUser.id);
      toast(`User "${deleteUser.full_name}" permanently deleted`, "success");
      setDeleteUser(null);
    } catch (error: any) {
      setDeleteError(error?.message || "Failed to delete account");
      toast(error?.message || "Failed to delete account", "error");
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  };

  const columns: Column<UserProfile>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (profile) => profile.full_name,
      render: (profile) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-[10px] font-semibold text-secondary-foreground">
            {profile.full_name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <button
              type="button"
              aria-label={`Inspect account ${profile.full_name}`}
              className="text-left text-[11.5px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                setInspected(profile);
              }}
            >
              {profile.full_name}
            </button>
            <div className="text-[9.5px] text-muted-foreground">
              {profile.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (profile) => profile.role,
      render: (profile) => <RoleBadge role={profile.role} />,
    },
    {
      key: "organization",
      header: "Organization",
      sortable: true,
      sortValue: (profile) => orgMap[profile.org_id || ""] || "",
      render: (profile) => (
        <span className="text-[11px] text-secondary-foreground">
          {orgMap[profile.org_id || ""] || "—"}
        </span>
      ),
    },
    {
      key: "workload",
      header: "Workload",
      sortable: true,
      sortValue: (profile) => profile.workload,
      render: (profile) => <WorkloadBar value={profile.workload} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (profile) => (profile.is_active ? 1 : 0),
      render: (profile) => <StatusBadge active={profile.is_active} />,
    },
    {
      key: "actions",
      header: "",
      action: true,
      width: "300px",
      render: (profile) => {
        const editable = canEditProfile(profile);
        const lifecycleManageable = canManageAccountLifecycle(profile);
        const protectedTitle = isLastActiveAdmin(profile, profiles)
          ? "The last active Admin account is protected"
          : profile.id === userProfile?.id
            ? "You cannot deactivate or delete the account you are using"
            : lifecycleManageable
              ? undefined
              : "Only Admin can change or delete a leadership account";
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAccess(profile.id);
              }}
              disabled={
                !isAdminRole(userProfile?.role) || isAdminRole(profile.role)
              }
              variant="outline"
              size="sm"
              className="eflow-directory-action"
              title={
                isAdminRole(profile.role)
                  ? "Admin access is always available"
                  : !isAdminRole(userProfile?.role)
                    ? "Only Admin can manage individual access"
                    : "Manage individual access"
              }
            >
              <KeyRound size={11} /> Access
            </Button>
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (editable) setEditUser(profile);
              }}
              disabled={!editable}
              title={
                editable
                  ? "Edit profile details"
                  : "The users.manage capability is required"
              }
              variant="secondary"
              size="sm"
              className="eflow-directory-action"
            >
              Edit
            </Button>
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (lifecycleManageable) void handleToggleStatus(profile);
              }}
              disabled={!lifecycleManageable || changingStatus}
              title={protectedTitle}
              variant="outline"
              size="sm"
              className="eflow-directory-action"
            >
              {profile.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (lifecycleManageable) {
                  setDeleteError(null);
                  setDeleteUser(profile);
                }
              }}
              disabled={!lifecycleManageable || profile.id === userProfile?.id}
              variant="outline"
              size="sm"
              className="eflow-directory-action text-destructive"
              title={
                protectedTitle ||
                (profile.id === userProfile?.id
                  ? "You cannot delete the account you are using"
                  : "Permanently delete account")
              }
            >
              <Trash2 size={11} /> Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="eflow-foundation-surface eflow-directory space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground">
            Account directory
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            Identity, role, organization, workload, and access are managed from
            one workspace.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!canManageUsers}
          title={
            canManageUsers
              ? "Create user"
              : "The users.manage capability is required"
          }
        >
          <Plus size={14} /> Create user
        </Button>
      </div>
      {confirmation.dialog}
      {lifecycleResult && (
        <FeedbackState tone="success" title="Saved account change">
          {lifecycleResult}
        </FeedbackState>
      )}
      {lifecycleError && (
        <FeedbackState tone="error" title="Account status needs review">
          {lifecycleError}
        </FeedbackState>
      )}
      {inspected && (
        <AccountInspector
          profile={inspected}
          office={orgMap[inspected.org_id || ""] || "Unassigned"}
          protection={
            isLastActiveAdmin(inspected, profiles)
              ? "The last active Admin must retain Admin access and cannot be deactivated or deleted."
              : inspected.id === userProfile?.id
                ? "You cannot deactivate or delete your own account."
                : !canManageAccountLifecycle(inspected)
                  ? "Leadership account status is managed by Admin."
                  : ""
          }
          onClose={() => setInspected(null)}
          onEdit={
            canEditProfile(inspected)
              ? () => {
                  setInspected(null);
                  window.requestAnimationFrame(() => setEditUser(inspected));
                }
              : undefined
          }
          onAccess={
            isAdminRole(userProfile?.role) && !isAdminRole(inspected.role)
              ? () => {
                  setInspected(null);
                  onOpenAccess(inspected.id);
                }
              : undefined
          }
        />
      )}
      <DataTable
        density="compact"
        key={filters.sort}
        data={directoryProfiles}
        totalRecords={visibleProfiles.length}
        columns={columns}
        keyExtractor={(profile) => profile.id}
        onRowClick={(profile) => {
          if (canEditProfile(profile)) setEditUser(profile);
        }}
        loading={loading}
        searchPlaceholder="Search by name, email, role, or organization…"
        searchFilter={(profile, query) =>
          profile.full_name.toLowerCase().includes(query) ||
          profile.email.toLowerCase().includes(query) ||
          (orgMap[profile.org_id || ""] || "").toLowerCase().includes(query) ||
          profile.role.toLowerCase().includes(query)
        }
        emptyMessage="No accounts match the current filters"
        toolbar={
          <UserDirectoryFiltersBar
            value={filters}
            organizations={orgOptions}
            onChange={setFilters}
          />
        }
      />
      <CreateUserModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        orgOptions={orgOptions}
        organizations={orgs}
        profiles={visibleProfiles}
      />
      <EditUserModal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        user={editUser}
        orgOptions={orgOptions}
        organizations={orgs}
        profiles={visibleProfiles}
      />
      <AlertDialog
        open={Boolean(deleteUser)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteUser(null);
        }}
      >
        <AlertDialogContent
          aria-busy={deleting || undefined}
          onEscapeKeyDown={(event) => {
            if (deleting) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
              <AlertTriangle size={19} />
            </div>
            <AlertDialogTitle>
              Delete this account permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser ? (
                <>
                  This will remove{" "}
                  <strong className="font-semibold text-foreground">
                    {deleteUser.full_name}
                  </strong>{" "}
                  and their login account. This action cannot be undone.
                  Accounts linked to work or audit history must be deactivated
                  instead.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <FeedbackState tone="error" title="Account was not deleted">
              {deleteError} Use Delete account to retry.
            </FeedbackState>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              variant="destructive"
              pending={deleting}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
