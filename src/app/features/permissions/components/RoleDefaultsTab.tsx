import "../permissionPresentation.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { getRoleLabel, isAdminRole } from "../../../shared/roles";
import {
  ACTION_PERMISSION_KEYS,
  FALLBACK_DEFAULTS,
  PERMISSION_LABELS,
  VISIBLE_PAGE_PERMISSION_KEYS,
  type PermissionKey,
} from "../constants";
import { useRoleCatalog } from "../hooks/useRoleCatalog";
import { rolePermissionAllowed } from "../selectors";
import {
  createCustomRole,
  deleteCustomRole,
  fetchRolePermissions,
  restoreRoleDefaults,
  setRolePermission,
  updateCustomRole,
} from "../services/permissionService";
import type { CustomRoleDefinition, RolePermissionRow } from "../types";
import { CustomRoleModal, type CustomRoleModalProps } from "./CustomRoleModal";

type PermissionCategoryFilter = "all" | "pages" | "actions";

const ALL_CAPABILITY_KEYS = [...VISIBLE_PAGE_PERMISSION_KEYS, ...ACTION_PERMISSION_KEYS];

function CapabilitySection({
  title,
  keys,
  selectedRoleKey,
  selectedRoleLabel,
  fallbackRole,
  isBuiltIn,
  isLocked,
  rows,
  savingKey,
  onToggle,
}: {
  title: string;
  keys: readonly PermissionKey[];
  selectedRoleKey: string;
  selectedRoleLabel: string;
  fallbackRole: string;
  isBuiltIn: boolean;
  isLocked: boolean;
  rows: RolePermissionRow[];
  savingKey: string | null;
  onToggle: (roleKey: string, permission: string, nextAllowed: boolean) => void;
}) {
  if (keys.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-4 py-3">
        <h4 className="text-[13px] font-semibold text-neutral-900">{title}</h4>
        <span className="text-[12px] text-neutral-500">
          {keys.length} {keys.length === 1 ? "permission" : "permissions"}
        </span>
      </div>
      <div className="divide-y divide-neutral-200">
        {keys.map((permission) => {
          const allowed = rolePermissionAllowed(selectedRoleKey, permission, rows, fallbackRole);
          const baselineAllowed = (FALLBACK_DEFAULTS[fallbackRole] || []).includes(permission);
          const isCustomized = isBuiltIn && !isLocked && allowed !== baselineAllowed;
          const rowKey = `${selectedRoleKey}:${permission}`;
          const busy = savingKey === rowKey;

          return (
            <div key={permission} className="eflow-role-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-neutral-900">
                    {PERMISSION_LABELS[permission] || permission}
                  </span>
                  {isCustomized ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      Modified
                    </span>
                  ) : null}
                </div>
                {isLocked ? (
                  <p className="mt-0.5 text-[12px] text-neutral-400">
                    System admin permission (locked).
                  </p>
                ) : isBuiltIn ? (
                  <p className="mt-0.5 text-[12px] text-neutral-400">
                    Default: {baselineAllowed ? "Allowed" : "Denied"}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={`${selectedRoleLabel}: ${allowed ? "Allowed" : "Denied"}`}
                aria-pressed={isLocked ? undefined : allowed}
                disabled={isLocked || busy}
                onClick={() => onToggle(selectedRoleKey, permission, !allowed)}
                className={`eflow-role-permission inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  isLocked
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-600 opacity-85"
                    : allowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:brightness-95"
                      : "border-neutral-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                } disabled:opacity-60`}
              >
                {isLocked ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {busy ? "Saving…" : allowed ? "Allowed" : "Denied"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RoleDefaultsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const { roleCatalog, customRoles, reload: reloadCatalog } = useRoleCatalog();

  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PermissionCategoryFilter>("all");

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<CustomRoleDefinition | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchRolePermissions());
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not load role defaults.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (roleCatalog.some((entry) => entry.key === selectedRoleKey)) return;
    setSelectedRoleKey(roleCatalog[0]?.key || "admin");
  }, [roleCatalog, selectedRoleKey]);

  const builtInRoles = useMemo(
    () => roleCatalog.filter((entry) => entry.isBuiltIn),
    [roleCatalog],
  );
  const customEntries = useMemo(
    () => roleCatalog.filter((entry) => !entry.isBuiltIn),
    [roleCatalog],
  );

  const selectedRole = useMemo(
    () => roleCatalog.find((entry) => entry.key === selectedRoleKey) || roleCatalog[0],
    [roleCatalog, selectedRoleKey],
  );

  const selectedCustomDefinition = useMemo(
    () => customRoles.find((item) => item.key === selectedRole?.key) || null,
    [customRoles, selectedRole],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visiblePageKeys = useMemo(() => {
    if (categoryFilter === "actions") return [];
    return VISIBLE_PAGE_PERMISSION_KEYS.filter((permission) =>
      !normalizedQuery
        ? true
        : (PERMISSION_LABELS[permission] || permission).toLowerCase().includes(normalizedQuery),
    );
  }, [categoryFilter, normalizedQuery]);

  const visibleActionKeys = useMemo(() => {
    if (categoryFilter === "pages") return [];
    return ACTION_PERMISSION_KEYS.filter((permission) =>
      !normalizedQuery
        ? true
        : (PERMISSION_LABELS[permission] || permission).toLowerCase().includes(normalizedQuery),
    );
  }, [categoryFilter, normalizedQuery]);

  const countAllowedForRole = useCallback(
    (roleKey: string, baseRole: string) =>
      ALL_CAPABILITY_KEYS.filter((perm) =>
        rolePermissionAllowed(roleKey, perm, rows, baseRole),
      ).length,
    [rows],
  );

  const hasCustomizedPermissions = useMemo(() => {
    if (!selectedRole || !selectedRole.isBuiltIn || selectedRole.isLocked) return false;
    return ALL_CAPABILITY_KEYS.some((permission) => {
      const current = rolePermissionAllowed(
        selectedRole.key,
        permission,
        rows,
        selectedRole.baseRole,
      );
      const baseline = (FALLBACK_DEFAULTS[selectedRole.baseRole] || []).includes(permission);
      return current !== baseline;
    });
  }, [selectedRole, rows]);

  const handleToggle = async (roleKey: string, permission: string, nextAllowed: boolean) => {
    if (isAdminRole(roleKey)) return;
    const key = `${roleKey}:${permission}`;
    setSavingKey(key);
    try {
      await setRolePermission(roleKey, permission, nextAllowed);
      setRows(await fetchRolePermissions());
      const label = roleCatalog.find((item) => item.key === roleKey)?.label || roleKey;
      toast(`${label} default updated.`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not update role default.",
        "error",
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleRestoreDefault = async () => {
    if (!selectedRole || selectedRole.isLocked || restoring) return;
    const ok = await confirm({
      title: `Restore default access for ${selectedRole.label}?`,
      description: `Resets all customized permissions for ${selectedRole.label} back to the baseline defaults for ${getRoleLabel(selectedRole.baseRole)}.`,
      actionLabel: "Restore default",
      cancelLabel: "Keep current",
    });
    if (!ok) return;

    setRestoring(true);
    try {
      await restoreRoleDefaults(selectedRole.key);
      setRows(await fetchRolePermissions());
      toast(`${selectedRole.label} restored to default permissions.`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not restore role defaults.",
        "error",
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setModalError(null);
    setModalMode("create");
  };

  const handleOpenEditModal = () => {
    if (!selectedCustomDefinition) return;
    setEditingRole(selectedCustomDefinition);
    setModalError(null);
    setModalMode("edit");
  };

  const handleModalSubmit: CustomRoleModalProps["onSubmit"] = async (values) => {
    setModalSaving(true);
    setModalError(null);
    try {
      if (modalMode === "create") {
        const created = await createCustomRole({
          ...values,
          existingKeys: customRoles.map((r) => r.key),
          existingRoles: roleCatalog,
        });
        await Promise.all([reloadCatalog(), fetchRolePermissions().then(setRows)]);
        setSelectedRoleKey(created.key);
        setModalMode(null);
        toast(`Created custom role "${created.label}".`, "success");
      } else if (modalMode === "edit" && editingRole) {
        const updated = await updateCustomRole(editingRole.key, {
          ...values,
          existingRoles: roleCatalog,
        });
        await Promise.all([reloadCatalog(), fetchRolePermissions().then(setRows)]);
        setModalMode(null);
        toast(`Updated custom role "${updated.label}".`, "success");
      }
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Could not save custom role.");
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteCustomRole = async () => {
    if (!selectedCustomDefinition) return;
    const baseLabel = getRoleLabel(selectedCustomDefinition.baseRole);
    const ok = await confirm({
      title: `Delete "${selectedCustomDefinition.label}"?`,
      description: `Any accounts currently assigned "${selectedCustomDefinition.label}" will safely revert to standard ${baseLabel} permissions.`,
      actionLabel: "Delete role",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteCustomRole(selectedCustomDefinition.key);
      await reloadCatalog();
      setRows(await fetchRolePermissions());
      setSelectedRoleKey("member");
      toast(`Deleted custom role "${selectedCustomDefinition.label}".`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not delete custom role.",
        "error",
      );
    }
  };

  return (
    <div className="eflow-permissions-surface space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-neutral-900">Role defaults</h3>
          <p className="text-[13px] text-neutral-500">
            Choose a role to view or change its default permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRestoreDefault()}
            disabled={!selectedRole || !selectedRole.isBuiltIn || selectedRole.isLocked || restoring || loading || Boolean(savingKey)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {restoring ? "Restoring…" : "Restore default"}
          </Button>
          <Button type="button" onClick={handleOpenCreateModal}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Create custom role
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-[13px] text-neutral-500">
          Loading role defaults…
        </div>
      ) : (
        <div className="eflow-roles-workspace">
          <aside className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3.5 py-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
                Built-in roles
              </span>
              <span className="text-[11px] font-medium text-neutral-400">
                {builtInRoles.length}
              </span>
            </div>
            <div className="space-y-1 p-2">
              {builtInRoles.map((role) => {
                const selected = selectedRole?.key === role.key;
                const count = countAllowedForRole(role.key, role.baseRole);
                return (
                  <button
                    key={role.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedRoleKey(role.key)}
                    className="eflow-role-list-item"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {role.isLocked ? (
                          <LockKeyhole className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        )}
                        <span className="truncate">{role.label}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {role.isLocked ? "System admin · Locked" : "Built-in role"}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                      {count}/{ALL_CAPABILITY_KEYS.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-y border-neutral-200 px-3.5 py-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
                Custom roles
              </span>
              <span className="text-[11px] font-medium text-neutral-400">
                {customEntries.length}
              </span>
            </div>
            <div className="space-y-1 p-2">
              {customEntries.length === 0 ? (
                <div className="px-2.5 py-3 text-[12px] text-neutral-400">
                  No custom roles yet. Use{" "}
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                  >
                    Create custom role
                  </button>{" "}
                  to add a tailored role.
                </div>
              ) : (
                customEntries.map((role) => {
                  const selected = selectedRole?.key === role.key;
                  const count = countAllowedForRole(role.key, role.baseRole);
                  return (
                    <button
                      key={role.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedRoleKey(role.key)}
                      className="eflow-role-list-item"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium">
                          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
                          <span className="truncate">{role.label}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-400">
                          Custom role · {getRoleLabel(role.baseRole)}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                        {count}/{ALL_CAPABILITY_KEYS.length}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {selectedRole ? (
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[15px] font-semibold text-neutral-900">
                        {selectedRole.label}
                      </h4>
                      {selectedRole.isBuiltIn ? (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
                          {selectedRole.isLocked ? "Built-in · Locked" : "Built-in"}
                        </span>
                      ) : (
                        <>
                          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-700">
                            Custom role
                          </span>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                            Account type: {getRoleLabel(selectedRole.baseRole)}
                          </span>
                        </>
                      )}
                      {hasCustomizedPermissions ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                          Modified from default
                        </span>
                      ) : null}
                    </div>
                    {selectedRole.description ? (
                      <p className="mt-1.5 text-[13px] text-neutral-500">
                        {selectedRole.description}
                      </p>
                    ) : null}
                  </div>

                  {!selectedRole.isBuiltIn && selectedCustomDefinition ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenEditModal}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeleteCustomRole()}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-neutral-100 pt-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search permissions…"
                      maxLength={120}
                      aria-label="Search permissions"
                      className="h-9 w-full rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] placeholder:text-neutral-400 focus:outline-none"
                    />
                  </div>

                  <div
                    role="group"
                    aria-label="Permission group"
                    className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
                  >
                    {(
                      [
                        ["all", "All"],
                        ["pages", "Page access"],
                        ["actions", "Actions"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = categoryFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCategoryFilter(value)}
                          className={`min-h-[30px] rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                            active
                              ? "bg-white text-neutral-900 shadow-xs"
                              : "text-neutral-500 hover:text-neutral-900"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {visiblePageKeys.length === 0 && visibleActionKeys.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                  <EmptyState
                    illustration="search"
                    size="compact"
                    title="No matching permissions"
                    description="Clear the search filter or switch to All."
                  />
                </div>
              ) : (
                <>
                  <CapabilitySection
                    title="Page access"
                    keys={visiblePageKeys}
                    selectedRoleKey={selectedRole.key}
                    selectedRoleLabel={selectedRole.label}
                    fallbackRole={selectedRole.baseRole}
                    isBuiltIn={selectedRole.isBuiltIn}
                    isLocked={selectedRole.isLocked}
                    rows={rows}
                    savingKey={savingKey}
                    onToggle={(roleKey, permission, next) => void handleToggle(roleKey, permission, next)}
                  />
                  <CapabilitySection
                    title="Actions"
                    keys={visibleActionKeys}
                    selectedRoleKey={selectedRole.key}
                    selectedRoleLabel={selectedRole.label}
                    fallbackRole={selectedRole.baseRole}
                    isBuiltIn={selectedRole.isBuiltIn}
                    isLocked={selectedRole.isLocked}
                    rows={rows}
                    savingKey={savingKey}
                    onToggle={(roleKey, permission, next) => void handleToggle(roleKey, permission, next)}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      <CustomRoleModal
        open={modalMode !== null}
        mode={modalMode || "create"}
        initialRole={editingRole}
        existingRoles={roleCatalog}
        roleRows={rows}
        saving={modalSaving}
        error={modalError}
        onClose={() => {
          if (!modalSaving) setModalMode(null);
        }}
        onSubmit={handleModalSubmit}
      />

      {confirmationDialog}
    </div>
  );
}
