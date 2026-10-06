import { isAdminRole } from "../../../shared/roles";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleMinus,
  RotateCcw,
  Search,
  Shield,
  UserRoundCog,
} from "lucide-react";
import { useProfiles, useOrgs } from "../../../hooks/useSupabaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "../constants";
import { resolvePermissions, rolePermissionAllowed } from "../selectors";
import {
  fetchRolePermissions,
  fetchUserOverrides,
  setUserOverride,
} from "../services/permissionService";
import type { RolePermissionRow, UserOverrideRow } from "../types";
import { OrganizationScopePanel } from "./OrganizationScopePanel";
import { Tooltip } from "@vibe/core";
import { WSelect } from "../../../components/workflow/primitives";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { FeedbackState } from "../../../components/ui/FeedbackState";
function AccessRows({
  title,
  permissions,
  role,
  roleRows,
  overrides,
  effective,
  onCycle,
}: {
  title: string;
  permissions: readonly string[];
  role: string;
  roleRows: RolePermissionRow[];
  overrides: UserOverrideRow[];
  effective: Set<string>;
  onCycle: (permission: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </div>
      <div className="divide-y divide-neutral-100">
        {permissions.map((permission) => {
          const inherited = rolePermissionAllowed(role, permission, roleRows);
          const override = overrides.find(
            (row) => row.permission === permission,
          );
          const allowed = effective.has(permission);
          return (
            <div
              key={permission}
              className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60"
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}
              >
                {allowed ? <Check size={14} /> : <CircleMinus size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-medium text-neutral-900">
                  {
                    PERMISSION_LABELS[
                      permission as keyof typeof PERMISSION_LABELS
                    ]
                  }
                </div>
                <div className="mt-0.5 text-[9.5px] text-neutral-400">
                  Role default: {inherited ? "Allowed" : "Denied"}
                  {override
                    ? ` · Individual ${override.allowed ? "allow" : "deny"}`
                    : ""}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
              >
                {allowed ? "Allowed" : "Denied"}
              </span>
              <Tooltip content="Cycle through role default, individual allow, and individual deny">
                <button
                  type="button"
                  onClick={() => onCycle(permission)}
                  className={`inline-flex min-w-[88px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9.5px] font-medium transition-colors ${override ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100" : "border-neutral-200 text-neutral-600 hover:border-teal-200 hover:bg-teal-50"}`}
                >
                  {override ? <RotateCcw size={11} /> : null}
                  {!override
                    ? "Set exception"
                    : override.allowed
                      ? "Allow"
                      : "Deny"}
                </button>
              </Tooltip>
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
  const { orgs } = useOrgs();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [internalUserId, setInternalUserId] = useState(selectedUserId || "");
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [roleRows, setRoleRows] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<UserOverrideRow[]>([]);
  const [busy, setBusy] = useState(false);
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
    void fetchRolePermissions().then(setRoleRows);
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
            error instanceof Error
              ? error.message
              : "Access could not be read.",
          );
      });
    return () => {
      live = false;
    };
  }, [activeUserId]);

  const effective = useMemo(
    () =>
      selected
        ? resolvePermissions(selected.role, roleRows, overrides)
        : new Set<string>(),
    [selected, roleRows, overrides],
  );
  const pageCount = PAGE_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;
  const actionCount = ACTION_PERMISSION_KEYS.filter((permission) =>
    effective.has(permission),
  ).length;

  const cycle = async (permission: string) => {
    if (!selected || !userProfile || pending.current) return;
    const current = overrides.find((row) => row.permission === permission);
    const next = !current ? true : current.allowed ? false : null;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setFailure("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Change individual access?",
          description: `${selected.full_name}: ${PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] || permission}. ${current ? (current.allowed ? "Individual allow" : "Individual deny") : "Role default"} → ${next === null ? "Role default" : next ? "Individual allow" : "Individual deny"}. Other accounts are unchanged. Office scope and server authorization still apply.`,
          actionLabel: "Change access",
        }))
      )
        return;
      await setUserOverride(selected.id, permission, next, userProfile.id);
      setResult(
        `${selected.full_name} · ${permission}: ${next === null ? "Role default" : next ? "Allowed" : "Denied"}. Saved.`,
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
    <div className="grid min-h-[650px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      {confirmation.dialog}
      <aside className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="space-y-2 border-b border-neutral-100 p-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users…"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[11px] outline-none focus:border-neutral-400"
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
              onClick={() => chooseUser(profile.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors ${profile.id === activeUserId ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${profile.id === activeUserId ? "bg-white/15" : "bg-neutral-100 text-neutral-600"}`}
              >
                {profile.full_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">
                  {profile.full_name}
                </span>
                <span
                  className={`block truncate text-[9.5px] ${profile.id === activeUserId ? "text-neutral-300" : "text-neutral-400"}`}
                >
                  {orgMap[profile.org_id || ""] || "No organization"} ·{" "}
                  {profile.role.replace(/_/g, " ")}
                </span>
              </span>
            </button>
          ))}
          {filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-[11px] text-neutral-400">
              No active users match this search.
            </p>
          ) : null}
        </div>
      </aside>

      {!selected ? (
        <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white">
          <div className="text-center">
            <UserRoundCog size={34} className="mx-auto text-neutral-300" />
            <p className="mt-3 text-[12px] font-medium text-neutral-600">
              Choose a user to inspect final access
            </p>
            <p className="mt-1 text-[10.5px] text-neutral-400">
              Role defaults, individual exceptions, and organization scope are
              shown together.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Displayed access uses role fallbacks when the reader returns no
            rows, including an unavailable read. Saved changes are shown by
            their receipt; scope and server authorization still apply.
          </p>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => {
              void Promise.all([
                fetchRolePermissions(),
                fetchUserOverrides(activeUserId),
              ]).then(([roles, individual]) => {
                setRoleRows(roles);
                setOverrides(individual);
              });
            }}
          >
            Refresh individual access
          </button>
          {result && (
            <FeedbackState tone="success" title="Saved access change">
              {result}
            </FeedbackState>
          )}
          {failure && (
            <FeedbackState tone="error" title="Access change needs review">
              {failure} Read current access before retrying.
            </FeedbackState>
          )}
          <header className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 text-neutral-900 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-[13px] font-semibold text-teal-800">
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
                  <p className="mt-0.5 text-[10.5px] text-neutral-500">
                    {selected.role.replace(/_/g, " ")} ·{" "}
                    {orgMap[selected.org_id || ""] || "No organization"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl border border-teal-100 bg-white px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">{pageCount}</div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-400">
                    Pages
                  </div>
                </div>
                <div className="rounded-xl border border-teal-100 bg-white px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">{actionCount}</div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-400">
                    Actions
                  </div>
                </div>
                <div className="rounded-xl border border-teal-100 bg-white px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">
                    {overrides.length}
                  </div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-400">
                    Exceptions
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-teal-100 pt-3 text-[9.5px] text-neutral-500">
              <Shield size={12} /> Effective access = individual exception →
              role default → safe fallback. Data remains protected by
              organization scope.
            </div>
          </header>
          <fieldset disabled={busy} className="min-w-0">
            <AccessRows
              title="Page access"
              permissions={PAGE_PERMISSION_KEYS}
              role={selected.role}
              roleRows={roleRows}
              overrides={overrides}
              effective={effective}
              onCycle={cycle}
            />
          </fieldset>
          <fieldset disabled={busy} className="min-w-0">
            <AccessRows
              title="Actions"
              permissions={ACTION_PERMISSION_KEYS}
              role={selected.role}
              roleRows={roleRows}
              overrides={overrides}
              effective={effective}
              onCycle={cycle}
            />
          </fieldset>
          {userProfile ? (
            <OrganizationScopePanel
              key={selected.id}
              userId={selected.id}
              homeOrgId={selected.org_id}
              actorId={userProfile.id}
              organizations={orgs}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
