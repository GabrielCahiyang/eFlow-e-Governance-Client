import { readableUiError } from "../../../shared/userFacingError";
import { EmptyState } from "../../../components/ui/EmptyState";
import "../permissionPresentation.css";
import { isAdminRole } from "../../../shared/roles";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Info,
  Link2,
  LockKeyhole,
  Search,
  Shield,
  UserRoundCog,
} from "lucide-react";
import { useProfiles } from "../../../hooks/useSupabaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/button";
import {
  ACTION_PERMISSION_KEYS,
  PERMISSIONS_CHANGED_EVENT,
  VISIBLE_PAGE_PERMISSION_KEYS as PAGE_PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "../constants";
import {
  getModuleAllKeys,
  getPermissionDependents,
  getPermissionPrerequisites,
  getPermissionRestriction,
  PERMISSION_MODULES,
  planUserOverrideChange,
  type PermissionModuleDefinition,
} from "../dependencies";
import { resolveAccountRoleDisplay, useRoleCatalog } from "../hooks/useRoleCatalog";
import { resolvePermissions, rolePermissionAllowed } from "../selectors";
import {
  fetchIndividualAccess,
  setUserOverridesBatch,
} from "../services/permissionService";
import type { RolePermissionRow, UserOverrideRow } from "../types";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { FeedbackState } from "../../../components/ui/FeedbackState";

const ACTION_KEY_SET = new Set<string>(ACTION_PERMISSION_KEYS);
const ALL_VISIBLE_KEYS: readonly PermissionKey[] = [
  ...PAGE_PERMISSION_KEYS,
  ...ACTION_PERMISSION_KEYS,
];

function UserAccessModuleCard({
  module,
  role,
  fallbackRole,
  roleRows,
  overrides,
  effective,
  exceptionsOnly,
  onSelectOverride,
}: {
  module: PermissionModuleDefinition;
  role: string;
  fallbackRole: string;
  roleRows: RolePermissionRow[];
  overrides: UserOverrideRow[];
  effective: Set<string>;
  exceptionsOnly: boolean;
  onSelectOverride: (permission: PermissionKey, next: boolean | null) => void;
}) {
  const allKeys = getModuleAllKeys(module);
  const visible = exceptionsOnly
    ? allKeys.filter((permission) =>
        overrides.some((row) => row.permission === permission),
      )
    : allKeys;

  if (visible.length === 0) return null;

  const allowedCount = allKeys.filter((permission) => effective.has(permission)).length;

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-neutral-900">
              {module.title}
            </span>
            <span className="eflow-tabular rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200">
              {allowedCount}/{allKeys.length} allowed
            </span>
            {module.adminOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                Admin only
              </span>
            ) : null}
          </div>
          <span className="eflow-tabular text-[12px] text-neutral-400">
            {visible.length} {visible.length === 1 ? "rule" : "rules"}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-neutral-500">{module.description}</p>
        {module.id === "accounting" && fallbackRole !== "accounting_staff" ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-1.5 text-[11.5px] text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              Treasury and journal actions require an <strong>Accounting Staff</strong> account type.
            </span>
          </div>
        ) : null}
      </div>

      <div className="divide-y divide-neutral-100">
        {visible.map((permission) => {
          const restriction = getPermissionRestriction(permission, fallbackRole);
          const inherited = rolePermissionAllowed(role, permission, roleRows, fallbackRole);
          const override = overrides.find((row) => row.permission === permission);
          const allowed = effective.has(permission);
          const currentMode = !override
            ? "default"
            : override.allowed
              ? "allow"
              : "deny";
          const prereqs = getPermissionPrerequisites(permission);
          const activeDependents = getPermissionDependents(permission).filter((dep) =>
            effective.has(dep),
          );

          return (
            <div key={permission} className="eflow-access-row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    id={`access-${module.id}-${permission}`}
                    className="text-[13px] font-medium text-neutral-900"
                  >
                    {PERMISSION_LABELS[permission] || permission}
                  </div>
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

                <div className="mt-0.5 text-[12px] text-neutral-400">
                  Default: {inherited ? "Allowed" : "Denied"}
                  {override
                    ? ` · Overridden to ${override.allowed ? "Allowed" : "Denied"}`
                    : ""}
                </div>

                {restriction.restricted ? (
                  <div className="mt-1 flex items-center gap-1 text-[11.5px] text-neutral-500">
                    <LockKeyhole className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
                    {restriction.reason}
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-500">
                    {prereqs.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
                        <Link2 className="h-3 w-3 shrink-0 text-[#0d544f]" aria-hidden="true" />
                        Requires: {prereqs.map((req) => PERMISSION_LABELS[req] || req).join(", ")}
                      </span>
                    ) : null}
                    {activeDependents.length > 0 ? (
                      <span className="text-[#0d544f]">
                        Required by: {activeDependents.map((dep) => PERMISSION_LABELS[dep] || dep).join(", ")}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <span
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
              >
                {allowed ? "Allowed" : "Denied"}
              </span>

              {restriction.restricted ? (
                <span className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 px-3 text-[12px] font-medium text-neutral-500">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  Locked
                </span>
              ) : (
                <div
                  role="group"
                  aria-label={`Override for ${PERMISSION_LABELS[permission] || permission}`}
                  aria-describedby={`access-${module.id}-${permission}`}
                  className="inline-flex overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
                >
                  {(
                    [
                      ["default", "Default", null],
                      ["allow", "Allow", true],
                      ["deny", "Deny", false],
                    ] as const
                  ).map(([mode, label, target]) => {
                    const active = currentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          if (!active) onSelectOverride(permission, target);
                        }}
                        className={`min-h-[32px] rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                          active
                            ? mode === "allow"
                              ? "bg-emerald-50 text-emerald-700"
                              : mode === "deny"
                                ? "bg-white text-[var(--eflow-negative-text)]"
                                : "bg-white text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function UserAccessTab({
  selectedUserId,
  onSelectedUserIdChange,
}: {
  selectedUserId?: string;
  onSelectedUserIdChange?: (userId: string) => void;
}) {
  const { profiles } = useProfiles();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { roleCatalog, customRoles } = useRoleCatalog();
  const [internalUserId, setInternalUserId] = useState(selectedUserId || "");
  const [search, setSearch] = useState("");
  const [roleRows, setRoleRows] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<UserOverrideRow[]>([]);
  const [accessRevision, setAccessRevision] = useState(0);
  const [loadedAccessKey, setLoadedAccessKey] = useState("");
  const [accessReadError, setAccessReadError] = useState<{ key: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const pending = useRef(false);
  const [result, setResult] = useState("");
  const [failure, setFailure] = useState("");
  const confirmation = useConfirmation();
  const draft = useExplicitDraft(
    "Individual access change",
    false,
    busy,
    () => {},
  );
  const activeUserId = selectedUserId ?? internalUserId;
  const selected = profiles.find(
    (profile) => profile.id === activeUserId && !isAdminRole(profile.role),
  );
  const selectedId = selected?.id;
  const accessKey = `${selectedId}:${accessRevision}`;
  const accessReady = loadedAccessKey === accessKey;
  const accessError = accessReadError?.key === accessKey ? accessReadError.message : "";
  const refreshingAccess = !accessReady && !accessError;
  const refreshAccess = () => {
    setFailure("");
    setAccessRevision((revision) => revision + 1);
  };
  const manageable = profiles.filter(
    (profile) => !isAdminRole(profile.role) && profile.is_active,
  );
  const filteredUsers = manageable.filter(
    (profile) =>
      `${profile.full_name} ${profile.email} ${profile.role} ${resolveAccountRoleDisplay(profile.role, profile.custom_role_key, roleCatalog).label}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const chooseUser = (userId: string) => {
    void requestNavigation(() => {
      setInternalUserId(userId);
      onSelectedUserIdChange?.(userId);
      setResult("");
      setFailure("");
    });
  };

  useEffect(() => {
    const onPermissionsChanged = () => setAccessRevision((revision) => revision + 1);
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, onPermissionsChanged);
    return () => window.removeEventListener(PERMISSIONS_CHANGED_EVENT, onPermissionsChanged);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    setLoadedAccessKey("");
    setAccessReadError(undefined);
    setRoleRows([]);
    setOverrides([]);
    void fetchIndividualAccess(selectedId)
      .then(({ roleRows, overrides }) => {
        if (!live) return;
        setRoleRows(roleRows);
        setOverrides(overrides);
        setLoadedAccessKey(accessKey);
      })
      .catch((error) => {
        if (!live) return;
        setAccessReadError({ key: accessKey, message: readableUiError(error, "Access could not be read.", "read") });
      });
    return () => {
      live = false;
    };
  }, [selectedId, accessKey]);

  const selectedCustomRole = useMemo(
    () =>
      selected?.custom_role_key
        ? customRoles.find((item) => item.key === selected.custom_role_key) || null
        : null,
    [customRoles, selected?.custom_role_key],
  );

  const effective = useMemo(
    () =>
      selected
        ? resolvePermissions(selected.role, roleRows, overrides, selectedCustomRole)
        : new Set<string>(),
    [selected, roleRows, overrides, selectedCustomRole],
  );

  const roleBaselineMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (!selected) return map;
    const roleKey = selectedCustomRole?.key || selected.role;
    const baseRole = selectedCustomRole?.baseRole || selected.role;
    for (const permission of ALL_VISIBLE_KEYS) {
      map[permission] = rolePermissionAllowed(roleKey, permission, roleRows, baseRole);
    }
    return map;
  }, [selected, selectedCustomRole, roleRows]);

  const currentOverridesMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const row of overrides) {
      map[row.permission] = row.allowed;
    }
    return map;
  }, [overrides]);

  const pageCount = PAGE_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;
  const actionCount = ACTION_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;

  const updateOverride = async (permission: PermissionKey, next: boolean | null) => {
    if (!selected || !userProfile || !accessReady || pending.current) return;
    const current = overrides.find((row) => row.permission === permission);
    const currentLabel = !current
      ? "Default"
      : current.allowed
        ? "Allow"
        : "Deny";
    const nextLabel =
      next === null ? "Default" : next ? "Allow" : "Deny";
    if (currentLabel === nextLabel) return;

    const baseRole = selectedCustomRole?.baseRole || selected.role;
    const plan = planUserOverrideChange(
      roleBaselineMap,
      currentOverridesMap,
      permission,
      next,
      baseRole,
    );
    if (!plan.allowed) {
      setFailure(plan.error || "This override cannot be applied to this account.");
      toast(plan.error || "This override cannot be applied to this account.", "error");
      return;
    }

    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setFailure("");
    try {
      const dependencyNote = plan.summary ? ` ${plan.summary}` : "";
      if (
        !(await confirmation.confirm({
          title: "Change individual access?",
          description: `${selected.full_name}: ${PERMISSION_LABELS[permission] || permission} will change from ${currentLabel} to ${nextLabel}.${dependencyNote} The change applies only to this account. Project access still depends on project membership.`,
          actionLabel: plan.cascadeDisabled.length > 0 ? "Apply changes together" : "Change access",
        }))
      )
        return;

      await setUserOverridesBatch(selected.id, plan.changes, userProfile.id);
      setResult(
        `${selected.full_name} · ${PERMISSION_LABELS[permission] || permission}: ${next === null ? "Default" : next ? "Allowed" : "Denied"}.${dependencyNote} Saved.`,
      );
      toast(
        plan.summary ||
          (next === null
            ? "Restored the role default."
            : next
              ? "Individual access allowed."
              : "Individual access denied."),
        "success",
      );
    } catch (error: any) {
      setFailure(error?.message || "Failed to update user access.");
      toast(error?.message || "Failed to update user access.", "error");
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  const hasVisibleExceptions = !exceptionsOnly || overrides.length > 0;

  return (
    <div className="eflow-permissions-surface eflow-access-workspace grid min-h-[650px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      {confirmation.dialog}
      <aside className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="space-y-2 border-b border-neutral-100 p-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search account access"
              maxLength={120}
              placeholder="Search name, email, or role…"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[12px] outline-none focus:border-neutral-400"
            />
          </div>
        </div>
        <div className="max-h-[590px] overflow-y-auto p-2">
          {filteredUsers.map((profile) => (
            <button
              key={profile.id}
              type="button"
              aria-pressed={profile.id === activeUserId}
              onClick={() => chooseUser(profile.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors ${profile.id === activeUserId ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${profile.id === activeUserId ? "bg-white/15" : "bg-neutral-100 text-neutral-600"}`}
              >
                {profile.full_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">
                  {profile.full_name}
                </span>
                <span
                  className={`block truncate text-[12px] ${profile.id === activeUserId ? "text-neutral-300" : "text-neutral-400"}`}
                >
                  {resolveAccountRoleDisplay(profile.role, profile.custom_role_key, roleCatalog).label}
                </span>
              </span>
            </button>
          ))}
          {filteredUsers.length === 0 ? (
            <EmptyState
              illustration="search"
              size="compact"
              title="No active users match this search."
            />
          ) : null}
        </div>
      </aside>

      {!selected ? (
        <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white">
          <div className="max-w-sm px-6 text-center">
            <UserRoundCog size={34} className="mx-auto text-neutral-300" />
            <p className="mt-3 text-[14px] font-semibold text-neutral-800">
              Select a person to review access
            </p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Choose an account on the left to inspect or override permissions without affecting anyone else in that role.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {accessError && (
            <FeedbackState tone="error" title="Access could not be read">
              {accessError} Refresh access before making a change.
            </FeedbackState>
          )}
          {result && (
            <FeedbackState tone="success" title="Saved access change">
              {result}
            </FeedbackState>
          )}
          {failure && (
            <FeedbackState tone="error" title="Access change needs review">
              {failure} Refresh current access before retrying.
            </FeedbackState>
          )}
          <header className="rounded-xl border border-neutral-200 bg-white p-5 text-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--eflow-selected)] text-[13px] font-semibold text-[var(--eflow-on-selected)]">
                  {selected.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold">
                    {selected.full_name}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {resolveAccountRoleDisplay(selected.role, selected.custom_role_key, roleCatalog).label} ·{" "}
                    {selected.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy || refreshingAccess} onClick={refreshAccess}>
                  {refreshingAccess ? "Refreshing access…" : "Refresh access"}
                </Button>
                <div className="eflow-tabular rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-center">
                  <div className="text-[15px] font-semibold">{pageCount}</div>
                  <div className="text-[11px] font-medium text-neutral-500">
                    Pages
                  </div>
                </div>
                <div className="eflow-tabular rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-center">
                  <div className="text-[15px] font-semibold">{actionCount}</div>
                  <div className="text-[11px] font-medium text-neutral-500">
                    Actions
                  </div>
                </div>
                <div className="eflow-tabular rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-center">
                  <div className="text-[15px] font-semibold">
                    {overrides.length}
                  </div>
                  <div className="text-[11px] font-medium text-neutral-500">
                    Custom
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
              <span className="inline-flex items-center gap-2 text-[12.5px] text-neutral-500">
                <Shield
                  size={14}
                  aria-hidden="true"
                  className="text-[var(--eflow-primary)]"
                />
                Individual overrides stay linked to required pages. Project access still depends on project membership.
              </span>
              <div
                role="group"
                aria-label="Filter permissions"
                className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={!exceptionsOnly}
                  onClick={() => setExceptionsOnly(false)}
                  className={`min-h-[30px] rounded-md px-3 text-[12px] font-medium transition-colors ${
                    !exceptionsOnly
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  All permissions
                </button>
                <button
                  type="button"
                  aria-pressed={exceptionsOnly}
                  onClick={() => setExceptionsOnly(true)}
                  className={`min-h-[30px] rounded-md px-3 text-[12px] font-medium transition-colors ${
                    exceptionsOnly
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Custom only{overrides.length > 0 ? ` (${overrides.length})` : ""}
                </button>
              </div>
            </div>
          </header>

          {!hasVisibleExceptions ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <EmptyState
                illustration="complete"
                size="compact"
                title="No custom overrides for this account"
                description="This account currently inherits all permissions from its assigned role."
              />
            </div>
          ) : (
            <fieldset disabled={busy || !accessReady} className="min-w-0 space-y-3">
              {PERMISSION_MODULES.map((module) => (
                <UserAccessModuleCard
                  key={module.id}
                  module={module}
                  role={selectedCustomRole?.key || selected.role}
                  fallbackRole={selectedCustomRole?.baseRole || selected.role}
                  roleRows={roleRows}
                  overrides={overrides}
                  effective={effective}
                  exceptionsOnly={exceptionsOnly}
                  onSelectOverride={(permission, next) => void updateOverride(permission, next)}
                />
              ))}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
