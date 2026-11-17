import { readableUiError } from '../../../shared/userFacingError';
import { EmptyState } from '../../../components/ui/EmptyState';
import '../permissionPresentation.css';
import { isAdminRole } from "../../../shared/roles";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Shield,
  UserRoundCog,
} from "lucide-react";
import { useProfiles, useOrgs } from "../../../hooks/useSupabaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import {
  ACTION_PERMISSION_KEYS,
  PERMISSIONS_CHANGED_EVENT,
  VISIBLE_PAGE_PERMISSION_KEYS as PAGE_PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "../constants";
import { resolveAccountRoleDisplay, useRoleCatalog } from "../hooks/useRoleCatalog";
import { resolvePermissions, rolePermissionAllowed } from "../selectors";
import {
  fetchRolePermissions,
  fetchUserOverrides,
  setUserOverride,
} from "../services/permissionService";
import type { RolePermissionRow, UserOverrideRow } from "../types";
import { WSelect } from "../../../components/workflow/primitives";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { FeedbackState } from "../../../components/ui/FeedbackState";
function AccessRows({
  title,
  permissions,
  role,
  fallbackRole,
  roleRows,
  overrides,
  effective,
  exceptionsOnly,
  onSelectOverride,
}: {
  title: string;
  permissions: readonly string[];
  role: string;
  fallbackRole?: string;
  roleRows: RolePermissionRow[];
  overrides: UserOverrideRow[];
  effective: Set<string>;
  exceptionsOnly: boolean;
  onSelectOverride: (permission: string, next: boolean | null) => void;
}) {
  const visible = exceptionsOnly
    ? permissions.filter((permission) =>
        overrides.some((row) => row.permission === permission),
      )
    : permissions;
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/70 px-4 py-3">
        <span className="text-[13px] font-semibold text-neutral-900">{title}</span>
        <span className="eflow-tabular text-[12px] text-neutral-400">
          {visible.length} {visible.length === 1 ? "rule" : "rules"}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-neutral-400">
          No custom permissions in {title.toLowerCase()}.
        </p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {visible.map((permission) => {
            const inherited = rolePermissionAllowed(role, permission, roleRows, fallbackRole);
            const override = overrides.find(
              (row) => row.permission === permission,
            );
            const allowed = effective.has(permission);
            const currentMode = !override
              ? "default"
              : override.allowed
                ? "allow"
                : "deny";
            return (
              <div key={permission} className="eflow-access-row">
                <div className="min-w-0 flex-1">
                  <div
                    id={`access-${title.replace(/ /g, "-")}-${permission}`}
                    className="text-[13px] font-medium text-neutral-900"
                  >
                    {
                      PERMISSION_LABELS[
                        permission as keyof typeof PERMISSION_LABELS
                      ]
                    }
                  </div>
                  <div className="mt-0.5 text-[12px] text-neutral-400">
                    Default: {inherited ? "Allowed" : "Denied"}
                    {override
                      ? ` · Overridden to ${override.allowed ? "Allowed" : "Denied"}`
                      : ""}
                  </div>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                >
                  {allowed ? "Allowed" : "Denied"}
                </span>
                <div
                  role="group"
                  aria-label={`Override for ${PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] || permission}`}
                  aria-describedby={`access-${title.replace(/ /g, "-")}-${permission}`}
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
              </div>
            );
          })}
        </div>
      )}
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
  const { orgs } = useOrgs();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { roleCatalog, customRoles } = useRoleCatalog();
  const [internalUserId, setInternalUserId] = useState(selectedUserId || "");
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [roleRows, setRoleRows] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<UserOverrideRow[]>([]);
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
  const orgMap = useMemo(
    () => Object.fromEntries(orgs.map((org) => [org.id, org.name])),
    [orgs],
  );
  const manageable = profiles.filter(
    (profile) => !isAdminRole(profile.role) && profile.is_active,
  );
  const filteredUsers = manageable.filter(
    (profile) =>
      (orgFilter === "all" || profile.org_id === orgFilter) &&
      `${profile.full_name} ${profile.email} ${profile.role} ${orgMap[profile.org_id || ""] || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const orgOptions = useMemo(
    () => [
      { value: "all", label: "All offices" },
      ...orgs
        .filter((org) => org.is_active)
        .map((org) => ({ value: org.id, label: org.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [orgs],
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
    const loadRoles = () => void fetchRolePermissions().then(setRoleRows);
    loadRoles();
    if (typeof window === "undefined") return;
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, loadRoles);
    return () => window.removeEventListener(PERMISSIONS_CHANGED_EVENT, loadRoles);
  }, []);
  useEffect(() => {
    if (!activeUserId) {
      setOverrides([]);
      return;
    }
    let live = true;
    setOverrides([]);
    void fetchUserOverrides(activeUserId)
      .then((rows) => {
        if (live) setOverrides(rows);
      })
      .catch((error) => {
        if (live)
          setFailure(
            readableUiError(error, "Access could not be read.", 'read'),
          );
      });
    return () => {
      live = false;
    };
  }, [activeUserId]);

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
  const pageCount = PAGE_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;
  const actionCount = ACTION_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;

  const updateOverride = async (permission: string, next: boolean | null) => {
    if (!selected || !userProfile || pending.current) return;
    const current = overrides.find((row) => row.permission === permission);
    const currentLabel = !current
      ? "Default"
      : current.allowed
        ? "Allow"
        : "Deny";
    const nextLabel =
      next === null ? "Default" : next ? "Allow" : "Deny";
    if (currentLabel === nextLabel) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setFailure("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Change individual access?",
          description: `${selected.full_name}: ${PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] || permission} will change from ${currentLabel} to ${nextLabel}. Other accounts stay unchanged.`,
          actionLabel: "Change access",
        }))
      )
        return;
      await setUserOverride(selected.id, permission, next, userProfile.id);
      setResult(
        `${selected.full_name} · ${PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] || permission}: ${next === null ? "Default" : next ? "Allowed" : "Denied"}. Saved.`,
      );
      setOverrides(await fetchUserOverrides(selected.id));
      toast(
        next === null
          ? "Restored the role default."
          : next
            ? "Individual access allowed."
            : "Individual access denied.",
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
              placeholder="Search name, email, role or Office…"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[12px] outline-none focus:border-neutral-400"
            />
          </div>
          <WSelect
            ariaLabel="Filter users by office"
            className="!w-full"
            value={orgFilter}
            onChange={setOrgFilter}
            options={orgOptions}
          />
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
                  {orgMap[profile.org_id || ""] || "No Office"} ·{" "}
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
                    {orgMap[selected.org_id || ""] || "No Office assigned"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                Custom permissions override this user’s role defaults. Project
                access still depends on project membership.
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
          <fieldset disabled={busy} className="min-w-0">
            <AccessRows
              title="Page access"
              permissions={PAGE_PERMISSION_KEYS}
              role={selectedCustomRole?.key || selected.role}
              fallbackRole={selected.role}
              roleRows={roleRows}
              overrides={overrides}
              effective={effective}
              exceptionsOnly={exceptionsOnly}
              onSelectOverride={updateOverride}
            />
          </fieldset>
          <fieldset disabled={busy} className="min-w-0">
            <AccessRows
              title="Actions"
              permissions={ACTION_PERMISSION_KEYS}
              role={selectedCustomRole?.key || selected.role}
              fallbackRole={selected.role}
              roleRows={roleRows}
              overrides={overrides}
              effective={effective}
              exceptionsOnly={exceptionsOnly}
              onSelectOverride={updateOverride}
            />
          </fieldset>
        </div>
      )}
    </div>
  );
}
