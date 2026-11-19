import "../permissionPresentation.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
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
import {
  getPermissionRestriction,
  PERMISSION_MODULES,
  planModulePresetChange,
  planRolePermissionToggle,
  type PermissionModuleDefinition,
} from "../dependencies";
import { useRoleCatalog } from "../hooks/useRoleCatalog";
import { rolePermissionAllowed } from "../selectors";
import {
  createCustomRole,
  deleteCustomRole,
  fetchRolePermissions,
  restoreRoleDefaults,
  setRolePermissionsBatch,
  updateCustomRole,
} from "../services/permissionService";
import type { CustomRoleDefinition, RolePermissionRow } from "../types";
import { CustomRoleModal, type CustomRoleModalProps } from "./CustomRoleModal";
import {
  ModuleRolePermissionCards,
  type PermissionCategoryFilter,
} from "./ModulePermissionCards";

const ALL_CAPABILITY_KEYS = [...VISIBLE_PAGE_PERMISSION_KEYS, ...ACTION_PERMISSION_KEYS];

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
  const [compactView, setCompactView] = useState(false);
  const [dependencyNotice, setDependencyNotice] = useState<string | null>(null);

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

  useEffect(() => {
    setDependencyNotice(null);
  }, [selectedRoleKey]);

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

  const selectedRoleAllowedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (!selectedRole) return map;
    for (const permission of ALL_CAPABILITY_KEYS) {
      map[permission] = rolePermissionAllowed(
        selectedRole.key,
        permission,
        rows,
        selectedRole.baseRole,
      );
    }
    return map;
  }, [selectedRole, rows]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasVisiblePermissions = useMemo(() => {
    const actionSet = new Set<string>(ACTION_PERMISSION_KEYS);
    return PERMISSION_MODULES.some((module) =>
      [...module.pageKeys, ...module.standardActionKeys, ...module.advancedActionKeys].some((key) => {
        const isAction = actionSet.has(key);
        if (categoryFilter === "pages" && isAction) return false;
        if (categoryFilter === "actions" && !isAction) return false;
        if (!normalizedQuery) return true;
        return (
          (PERMISSION_LABELS[key] || key).toLowerCase().includes(normalizedQuery) ||
          key.toLowerCase().includes(normalizedQuery) ||
          module.title.toLowerCase().includes(normalizedQuery)
        );
      }),
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
      if (getPermissionRestriction(permission, selectedRole.baseRole).restricted) return false;
      const current = Boolean(selectedRoleAllowedMap[permission]);
      const baseline = (FALLBACK_DEFAULTS[selectedRole.baseRole] || []).includes(permission);
      return current !== baseline;
    });
  }, [selectedRole, selectedRoleAllowedMap]);

  const handleToggle = async (permission: PermissionKey, nextAllowed: boolean) => {
    if (!selectedRole || isAdminRole(selectedRole.key)) return;
    const plan = planRolePermissionToggle(
      selectedRoleAllowedMap,
      permission,
      nextAllowed,
      selectedRole.baseRole,
    );
    if (!plan.allowed) {
      toast(plan.error || "This permission cannot be changed for this role.", "error");
      return;
    }

    if (plan.cascadeDisabled.length > 0) {
      const dependentLabels = plan.cascadeDisabled
        .map((key) => PERMISSION_LABELS[key] || key)
        .join(", ");
      const ok = await confirm({
        title: `Turn off ${PERMISSION_LABELS[permission] || permission}?`,
        description: `${selectedRole.label} currently has dependent permissions enabled: ${dependentLabels}. Turning off ${PERMISSION_LABELS[permission] || permission} will disable them together so access rules stay consistent.`,
        actionLabel: "Disable together",
        cancelLabel: "Keep enabled",
      });
      if (!ok) return;
    }

    const key = `${selectedRole.key}:${permission}`;
    setSavingKey(key);
    try {
      await setRolePermissionsBatch(selectedRole.key, plan.changes);
      setRows(await fetchRolePermissions());
      setDependencyNotice(plan.summary);
      toast(plan.summary || `${selectedRole.label} default updated.`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not update role default.",
        "error",
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSelectPreset = async (module: PermissionModuleDefinition, presetId: string) => {
    if (!selectedRole || isAdminRole(selectedRole.key)) return;
    const plan = planModulePresetChange(
      selectedRoleAllowedMap,
      module,
      presetId,
      selectedRole.baseRole,
    );
    if (!plan.allowed) {
      toast(plan.error || "Could not apply access level.", "error");
      return;
    }
    if (Object.keys(plan.changes).length === 0) return;

    if (plan.cascadeDisabled.length > 0 && presetId === "none") {
      const removedLabels = plan.cascadeDisabled
        .map((key) => PERMISSION_LABELS[key] || key)
        .join(", ");
      const ok = await confirm({
        title: `Remove ${module.title} access for ${selectedRole.label}?`,
        description: `This disables ${module.title} access and turns off active actions: ${removedLabels}.`,
        actionLabel: "Remove access",
        cancelLabel: "Keep current",
      });
      if (!ok) return;
    }

    const key = `${selectedRole.key}:module:${module.id}`;
    setSavingKey(key);
    try {
      await setRolePermissionsBatch(selectedRole.key, plan.changes);
      setRows(await fetchRolePermissions());
      setDependencyNotice(plan.summary);
      toast(plan.summary || `${selectedRole.label} ${module.title} updated.`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not update module access.",
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
      setDependencyNotice(null);
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
        setDependencyNotice(null);
        toast(`Created custom role "${created.label}".`, "success");
      } else if (modalMode === "edit" && editingRole) {
        const updated = await updateCustomRole(editingRole.key, {
          ...values,
          existingRoles: roleCatalog,
        });
        await Promise.all([reloadCatalog(), fetchRolePermissions().then(setRows)]);
        setModalMode(null);
        setDependencyNotice(null);
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
            Configure module access levels or individual permissions. Required pages are linked automatically.
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
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 tabular-nums">
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
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 tabular-nums">
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

                  <div className="flex flex-wrap items-center gap-2">
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

                    <button
                      type="button"
                      aria-pressed={compactView}
                      onClick={() => setCompactView((current) => !current)}
                      className={`min-h-[34px] rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
                        compactView
                          ? "border-[#0d544f]/30 bg-teal-50 text-[#0d544f]"
                          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {compactView ? "Show details" : "Compact view"}
                    </button>
                  </div>
                </div>

                {dependencyNotice ? (
                  <div
                    role="status"
                    className="mt-3 flex items-center gap-2 rounded-lg border border-[#0d544f]/20 bg-teal-50/80 px-3 py-2 text-[12px] text-[#0d544f]"
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{dependencyNotice}</span>
                  </div>
                ) : null}
              </div>

              {!hasVisiblePermissions ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                  <EmptyState
                    illustration="search"
                    size="compact"
                    title="No matching permissions"
                    description="Clear the search filter or switch to All."
                  />
                </div>
              ) : (
                <ModuleRolePermissionCards
                  mode="role-tab"
                  selectedRoleKey={selectedRole.key}
                  selectedRoleLabel={selectedRole.label}
                  baseRole={selectedRole.baseRole}
                  isBuiltIn={selectedRole.isBuiltIn}
                  isLocked={selectedRole.isLocked}
                  allowedMap={selectedRoleAllowedMap}
                  searchQuery={searchQuery}
                  categoryFilter={categoryFilter}
                  compact={compactView}
                  savingKey={savingKey}
                  disabled={restoring}
                  onTogglePermission={(permission, next) => void handleToggle(permission, next)}
                  onSelectPreset={(module, presetId) => void handleSelectPreset(module, presetId)}
                />
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
