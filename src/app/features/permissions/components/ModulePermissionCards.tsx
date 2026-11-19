import { ChevronDown, ChevronRight, Info, Link2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import {
  ACTION_PERMISSION_KEYS,
  FALLBACK_DEFAULTS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "../constants";
import {
  detectModulePreset,
  getModuleAllKeys,
  getPermissionDependents,
  getPermissionPrerequisites,
  getPermissionRestriction,
  PERMISSION_MODULES,
  type PermissionModuleDefinition,
} from "../dependencies";

const ACTION_KEY_SET = new Set<string>(ACTION_PERMISSION_KEYS);

export type PermissionCategoryFilter = "all" | "pages" | "actions";

function filterKeysForModule(
  module: PermissionModuleDefinition,
  searchQuery: string,
  categoryFilter: PermissionCategoryFilter,
): PermissionKey[] {
  const normalized = searchQuery.trim().toLowerCase();
  return getModuleAllKeys(module).filter((key) => {
    const isAction = ACTION_KEY_SET.has(key);
    if (categoryFilter === "pages" && isAction) return false;
    if (categoryFilter === "actions" && !isAction) return false;
    if (!normalized) return true;
    const label = (PERMISSION_LABELS[key] || key).toLowerCase();
    return (
      label.includes(normalized) ||
      key.toLowerCase().includes(normalized) ||
      module.title.toLowerCase().includes(normalized)
    );
  });
}

function DependencyMeta({
  permission,
  allowedMap,
  restrictionReason,
}: {
  permission: PermissionKey;
  allowedMap: Record<string, boolean>;
  restrictionReason: string | null;
}) {
  const prereqs = getPermissionPrerequisites(permission);
  const activeDependents = getPermissionDependents(permission).filter((dep) =>
    Boolean(allowedMap[dep]),
  );

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-neutral-500">
      {restrictionReason ? (
        <span className="inline-flex items-center gap-1 text-neutral-500">
          <LockKeyhole className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
          {restrictionReason}
        </span>
      ) : null}
      {!restrictionReason && prereqs.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
          <Link2 className="h-3 w-3 shrink-0 text-[#0d544f]" aria-hidden="true" />
          Requires: {prereqs.map((req) => PERMISSION_LABELS[req] || req).join(", ")}
        </span>
      ) : null}
      {!restrictionReason && activeDependents.length > 0 ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-[#0d544f]">
          Required by: {activeDependents.map((dep) => PERMISSION_LABELS[dep] || dep).join(", ")}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Module-grouped RBAC editor used by RoleDefaultsTab (with role toggle buttons)
 * and CustomRoleModal (with compact Allow / Deny pills).
 */
export function ModuleRolePermissionCards({
  mode,
  selectedRoleKey,
  selectedRoleLabel,
  baseRole,
  isBuiltIn,
  isLocked,
  allowedMap,
  searchQuery = "",
  categoryFilter = "all",
  compact = false,
  savingKey = null,
  disabled = false,
  onTogglePermission,
  onSelectPreset,
}: {
  mode: "role-tab" | "modal";
  selectedRoleKey: string;
  selectedRoleLabel: string;
  baseRole: string;
  isBuiltIn: boolean;
  isLocked: boolean;
  allowedMap: Record<string, boolean>;
  searchQuery?: string;
  categoryFilter?: PermissionCategoryFilter;
  compact?: boolean;
  savingKey?: string | null;
  disabled?: boolean;
  onTogglePermission: (permission: PermissionKey, nextAllowed: boolean) => void;
  onSelectPreset: (module: PermissionModuleDefinition, presetId: string) => void;
}) {
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const visibleModules = PERMISSION_MODULES.map((module) => ({
    module,
    keys: filterKeysForModule(module, searchQuery, categoryFilter),
  })).filter(({ keys }) => keys.length > 0);

  if (visibleModules.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleModules.map(({ module, keys }) => {
        const allModuleKeys = getModuleAllKeys(module);
        const allowedCount = allModuleKeys.filter((k) => Boolean(allowedMap[k])).length;
        const activePreset = detectModulePreset(module, allowedMap);
        const moduleAdminLocked = Boolean(module.adminOnly && !isLocked);
        const isDetailsOpen = compact ? Boolean(expandedModules[module.id]) : expandedModules[module.id] !== false;
        const standardKeys = keys.filter((k) => !module.advancedActionKeys.includes(k));
        const advancedKeys = keys.filter((k) => module.advancedActionKeys.includes(k));
        const moduleBusy = Boolean(savingKey && savingKey.startsWith(`${selectedRoleKey}:module:${module.id}`));

        const renderPermissionRow = (permission: PermissionKey) => {
          const allowed = Boolean(allowedMap[permission]);
          const restriction = getPermissionRestriction(permission, baseRole);
          const baselineAllowed = (FALLBACK_DEFAULTS[baseRole] || []).includes(permission);
          const isCustomized = isBuiltIn && !isLocked && !restriction.restricted && allowed !== baselineAllowed;
          const rowBusy = savingKey === `${selectedRoleKey}:${permission}` || moduleBusy;
          const rowDisabled = disabled || isLocked || restriction.restricted || rowBusy;

          if (mode === "modal") {
            return (
              <div
                key={permission}
                className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-neutral-50/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-neutral-800">
                      {PERMISSION_LABELS[permission] || permission}
                    </span>
                    {ACTION_KEY_SET.has(permission) ? (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                        Action
                      </span>
                    ) : (
                      <span className="rounded bg-[#0d544f]/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0d544f]">
                        Page
                      </span>
                    )}
                  </div>
                  <DependencyMeta
                    permission={permission}
                    allowedMap={allowedMap}
                    restrictionReason={restriction.reason}
                  />
                </div>

                {restriction.restricted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                    <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                    Locked
                  </span>
                ) : (
                  <div
                    role="group"
                    aria-label={PERMISSION_LABELS[permission] || permission}
                    className="inline-flex shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
                  >
                    <button
                      type="button"
                      aria-pressed={allowed}
                      disabled={rowDisabled}
                      onClick={() => {
                        if (!allowed) onTogglePermission(permission, true);
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        allowed
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      aria-pressed={!allowed}
                      disabled={rowDisabled}
                      onClick={() => {
                        if (allowed) onTogglePermission(permission, false);
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        !allowed
                          ? "bg-white text-neutral-900 shadow-xs"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={permission} className="eflow-role-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-neutral-900">
                    {PERMISSION_LABELS[permission] || permission}
                  </span>
                  {ACTION_KEY_SET.has(permission) ? (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                      Action
                    </span>
                  ) : (
                    <span className="rounded bg-[#0d544f]/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0d544f]">
                      Page
                    </span>
                  )}
                  {isCustomized ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      Modified
                    </span>
                  ) : null}
                </div>
                <DependencyMeta
                  permission={permission}
                  allowedMap={allowedMap}
                  restrictionReason={
                    isLocked ? "System admin permission (locked)." : restriction.reason
                  }
                />
                {!isLocked && !restriction.restricted && isBuiltIn ? (
                  <p className="mt-0.5 text-[11.5px] text-neutral-400">
                    Default: {baselineAllowed ? "Allowed" : "Denied"}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={`${selectedRoleLabel}: ${allowed ? "Allowed" : "Denied"}`}
                aria-pressed={isLocked || restriction.restricted ? undefined : allowed}
                disabled={rowDisabled}
                onClick={() => onTogglePermission(permission, !allowed)}
                className={`eflow-role-permission inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  isLocked || restriction.restricted
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500 opacity-85"
                    : allowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:brightness-95"
                      : "border-neutral-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                } disabled:opacity-60`}
              >
                {isLocked || restriction.restricted ? (
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {rowBusy ? "Saving…" : allowed ? "Allowed" : "Denied"}
              </button>
            </div>
          );
        };

        return (
          <section
            key={module.id}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedModules((prev) => ({
                          ...prev,
                          [module.id]: !isDetailsOpen,
                        }))
                      }
                      aria-expanded={isDetailsOpen}
                      className="inline-flex items-center gap-1.5 text-left text-[13.5px] font-semibold text-neutral-900 hover:text-[#0d544f]"
                    >
                      {isDetailsOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                      )}
                      {module.title}
                    </button>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200 tabular-nums">
                      {allowedCount}/{allModuleKeys.length} allowed
                    </span>
                    {moduleAdminLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                        Admin only
                      </span>
                    ) : null}
                    {module.presets.length > 0 && activePreset === "custom" ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-[#0d544f]">
                        Custom mix
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-neutral-500">{module.description}</p>
                </div>

                {!isLocked && !module.adminOnly && module.presets.length > 0 ? (
                  <div
                    role="group"
                    aria-label={`${module.title} access level`}
                    className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5"
                  >
                    {module.presets.map((preset) => {
                      const presetDisabled =
                        disabled ||
                        moduleBusy ||
                        Boolean(preset.requiresAccountingRole && baseRole !== "accounting_staff");
                      const selected = activePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={presetDisabled}
                          title={
                            preset.requiresAccountingRole && baseRole !== "accounting_staff"
                              ? "Requires an Accounting Staff account type"
                              : undefined
                          }
                          onClick={() => {
                            if (!selected) onSelectPreset(module, preset.id);
                          }}
                          className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                            selected
                              ? "bg-[#0d544f] text-white shadow-2xs"
                              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                          } disabled:cursor-not-allowed disabled:opacity-45`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {module.id === "accounting" && !isLocked && baseRole !== "accounting_staff" ? (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11.5px] text-amber-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                  <span>
                    Office Budget Ledgers can be enabled here. Treasury and journal actions require an{" "}
                    <strong>Accounting Staff</strong> account type for segregation of duties.
                  </span>
                </div>
              ) : null}
            </div>

            {isDetailsOpen ? (
              <div>
                <div className="divide-y divide-neutral-200">
                  {standardKeys.map(renderPermissionRow)}
                </div>
                {advancedKeys.length > 0 ? (
                  <div className="border-t border-neutral-200 bg-neutral-50/40">
                    <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Additional &amp; lifecycle permissions
                    </div>
                    <div className="divide-y divide-neutral-200/80 bg-white">
                      {advancedKeys.map(renderPermissionRow)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
