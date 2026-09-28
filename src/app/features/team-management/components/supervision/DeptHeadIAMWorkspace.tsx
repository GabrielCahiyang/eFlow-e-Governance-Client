import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  AttentionBox,
  Button,
  Label,
  Loader,
  Search as VibeSearch,
} from "@vibe/core";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleMinus,
  KeyRound,
  RotateCcw,
  Shield,
  ShieldCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useOrgs, useProfiles } from "../../../../hooks/useSupabaseData";
import { getRoleLabel } from "../../../../shared/roles";
import { motionTransition } from "../../../../shared/motion/motionTokens";
import { useDeptDirectoryEmployees } from "../../../employees";
import { setDepartmentAccountingStaff } from "../../services/departmentIdentityService";
import {
  fetchRolePermissions,
  fetchUserOverrides,
  setUserOverride,
} from "../../../permissions/services/permissionService";
import { resolvePermissions, rolePermissionAllowed } from "../../../permissions/selectors";
import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "../../../permissions/constants";
import type { RolePermissionRow, UserOverrideRow } from "../../../permissions/types";
import { OrganizationScopePanel } from "../../../permissions/components/OrganizationScopePanel";
import { assignOrganizationLeadership } from "../../../organization/services/leadershipService";
import { useToast } from "../../../../components/ui/Toast";
import type { Employee } from "../../../../services/employeeService";
import { PeopleWorkspaceShell } from "../PeopleWorkspaceShell";

// ─── Types ────────────────────────────────────────────────────────

type IAMTab = "people" | "user-access" | "leadership";

const TAB_META: Record<IAMTab, { label: string; icon: React.ReactNode }> = {
  people: {
    label: "Available staff",
    icon: <Users size={14} />,
  },
  "user-access": {
    label: "Current access",
    icon: <KeyRound size={14} />,
  },
  leadership: {
    label: "Protected leadership",
    icon: <ShieldCheck size={14} />,
  },
};

const TAB_ORDER: IAMTab[] = ["people", "user-access", "leadership"];

// ─── Tab Bar ──────────────────────────────────────────────────────

function IAMTabBar({
  active,
  onSelect,
}: {
  active: IAMTab;
  onSelect: (tab: IAMTab) => void;
}) {
  return (
    <div className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1">
      {TAB_ORDER.map((tab) => {
        const meta = TAB_META[tab];
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
              isActive
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {meta.icon}
            {meta.label}
            {isActive && (
              <m.span
                layoutId="dept-iam-tab-indicator"
                className="absolute inset-0 rounded-lg ring-1 ring-neutral-200"
                transition={motionTransition.navigation}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── People Tab ───────────────────────────────────────────────────

function PeopleTab({
  employees,
  roles,
}: {
  employees: Employee[];
  roles: ReadonlyMap<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [optimisticRoles, setOptimisticRoles] = useState<Record<string, string>>({});

  const roleFor = (id: string) => optimisticRoles[id] || roles.get(id) || "employee";
  const accountingCount = employees.filter(
    (e) => roleFor(e.id) === "accounting_staff",
  ).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        !needle ||
        `${e.name} ${e.email ?? ""} ${e.jobTitle}`.toLowerCase().includes(needle),
    );
  }, [employees, query]);

  const update = async (employee: Employee, assign: boolean) => {
    setBusyId(employee.id);
    setError("");
    try {
      await setDepartmentAccountingStaff(employee.id, assign);
      setOptimisticRoles((cur) => ({
        ...cur,
        [employee.id]: assign ? "accounting_staff" : "employee",
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Accounting access could not be updated.",
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <m.div
      key="people"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={motionTransition.productive}
      className="space-y-4"
    >
      {/* Accounting Access Card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-neutral-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <UserRoundCog size={19} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-neutral-950">Available staff</h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
                Assign or remove the Accounting Staff workspace for active
                people in your department. No assignment is required; more than
                one person can be assigned when workload or continuity requires
                it.
              </p>
            </div>
          </div>
          <Label
            color={accountingCount ? "positive" : "dark"}
            text={`${accountingCount} accounting ${accountingCount === 1 ? "staff member" : "staff members"}`}
          />
        </header>

        <div className="space-y-4 p-5">
          {error && (
            <AttentionBox type="negative" title="Access update failed" text={error} />
          )}
          {!accountingCount && (
            <AttentionBox
              type="neutral"
              title="No Accounting Staff assigned"
              text="The Department Head and Assistant Head retain financial authority. Assign a staff member here when dedicated accounting support is available."
            />
          )}

          <VibeSearch
            className="w-full max-w-md"
            clearIconLabel="Clear people search"
            inputAriaLabel="Search department people"
            onChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search department people…"
            showClearIcon
            size="small"
            value={query}
          />

          <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {filtered.map((employee, index) => {
              const role = roleFor(employee.id);
              const assigned = role === "accounting_staff";
              const eligible = role === "employee" || assigned;
              return (
                <m.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...motionTransition.productive,
                    delay: Math.min(index * 0.025, 0.2),
                  }}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      assigned
                        ? "bg-blue-100 text-blue-800"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {employee.initials || employee.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[11.5px] font-medium text-neutral-900">
                        {employee.name}
                      </span>
                      {assigned && (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-blue-700">
                          <BadgeCheck size={12} /> Accounting access
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] text-neutral-500">
                      {employee.email || "No email listed"} · {getRoleLabel(role)}
                    </p>
                  </div>
                  {eligible ? (
                    <Button
                      kind={assigned ? "secondary" : "primary"}
                      size="small"
                      loading={busyId === employee.id}
                      disabled={Boolean(busyId)}
                      onClick={() => void update(employee, !assigned)}
                    >
                      {assigned ? (
                        "Remove accounting access"
                      ) : (
                        <>
                          <ShieldCheck size={13} /> Assign accounting access
                        </>
                      )}
                    </Button>
                  ) : (
                    <Label color="dark" text="Leadership role protected" />
                  )}
                </m.div>
              );
            })}
            {!filtered.length && (
              <div className="p-8 text-center text-[10.5px] text-neutral-500">
                No department people match this search.
              </div>
            )}
          </div>
        </div>
      </div>
    </m.div>
  );
}

// ─── User Access Tab ──────────────────────────────────────────────

function AccessRow({
  permission,
  role,
  roleRows,
  overrides,
  effective,
  onCycle,
}: {
  permission: string;
  role: string;
  roleRows: RolePermissionRow[];
  overrides: UserOverrideRow[];
  effective: Set<string>;
  onCycle: (p: string) => void;
}) {
  const inherited = rolePermissionAllowed(role, permission, roleRows);
  const override = overrides.find((r) => r.permission === permission);
  const allowed = effective.has(permission);
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {allowed ? <Check size={14} /> : <CircleMinus size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium text-neutral-900">
          {PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS]}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          Role default: {inherited ? "Allowed" : "Denied"}
          {override ? ` · Individual ${override.allowed ? "allow" : "deny"}` : ""}
        </div>
        {override && <div className="mt-0.5 text-[11px] text-neutral-400">Exception owner: {override.setBy || "Recorded manager"}{override.updatedAt ? ` · Updated ${new Date(override.updatedAt).toLocaleDateString()}` : ""}</div>}
      </div>
      <span
        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
          allowed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {allowed ? "Allowed" : "Denied"}
      </span>
      <button
        type="button"
        onClick={() => onCycle(permission)}
        className={`inline-flex min-w-[98px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
          override
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
        }`}
        title="Cycle default → allow → deny → default"
      >
        {override ? <RotateCcw size={11} /> : null}
        {!override ? "Set exception" : override.allowed ? "Allow" : "Deny"}
      </button>
    </div>
  );
}

function UserAccessTab({
  deptMemberIds,
}: {
  deptMemberIds: Set<string>;
}) {
  const { profiles } = useProfiles();
  const { orgs } = useOrgs();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [roleRows, setRoleRows] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<UserOverrideRow[]>([]);

  const orgMap = useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, o.name])),
    [orgs],
  );

  // Only show dept members, not super admins
  const deptProfiles = profiles.filter(
    (p) => deptMemberIds.has(p.id) && p.role !== "super_admin" && p.is_active,
  );
  const filteredUsers = deptProfiles.filter((p) =>
    `${p.full_name} ${p.email} ${p.role} ${orgMap[p.org_id ?? ""] ?? ""}`.toLowerCase()
      .includes(search.toLowerCase()),
  );

  const selected = profiles.find((p) => p.id === selectedUserId);

  useEffect(() => {
    void fetchRolePermissions().then(setRoleRows);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setOverrides([]);
      return;
    }
    void fetchUserOverrides(selectedUserId).then(setOverrides);
  }, [selectedUserId]);

  const effective = useMemo(
    () =>
      selected
        ? resolvePermissions(selected.role, roleRows, overrides)
        : new Set<string>(),
    [selected, roleRows, overrides],
  );

  const pageCount = PAGE_PERMISSION_KEYS.filter((p) => effective.has(p)).length;
  const actionCount = ACTION_PERMISSION_KEYS.filter((p) => effective.has(p)).length;

  const cycle = async (permission: string) => {
    if (!selected || !userProfile) return;
    const current = overrides.find((r) => r.permission === permission);
    const next = !current ? true : current.allowed ? false : null;
    try {
      await setUserOverride(selected.id, permission, next, userProfile.id);
      setOverrides(await fetchUserOverrides(selected.id));
      toast(
        next === null
          ? "Restored the role default."
          : next
          ? "Individual access allowed."
          : "Individual access denied.",
        "success",
      );
    } catch (err: any) {
      toast(err?.message || "Failed to update user access.", "error");
    }
  };

  return (
    <m.div
      key="user-access"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={motionTransition.productive}
      className="grid min-h-[650px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]"
    >
      <AttentionBox className="xl:col-span-2" type="neutral" title="Access changes have an audit consequence" text="Individual exceptions retain the responsible manager and last-updated time. Restore the role default when an exception is no longer justified; organization scope restrictions remain in effect." />
      {/* Sidebar user list */}
      <aside className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 p-3">
          <div className="relative">
            <KeyRound
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dept members…"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[11px] outline-none focus:border-neutral-400"
            />
          </div>
        </div>
        <div className="max-h-[590px] overflow-y-auto p-2">
          {filteredUsers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedUserId(p.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors ${
                p.id === selectedUserId
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "hover:bg-neutral-100"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  p.id === selectedUserId
                  ? "bg-primary text-primary-foreground"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {p.full_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">
                  {p.full_name}
                </span>
                <span
                  className={`block truncate text-[9.5px] ${
                    p.id === selectedUserId ? "text-primary/70" : "text-neutral-400"
                  }`}
                >
                  {orgMap[p.org_id ?? ""] || "No organization"} ·{" "}
                  {p.role.replace(/_/g, " ")}
                </span>
              </span>
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <p className="py-10 text-center text-[11px] text-neutral-400">
              No active dept members match this search.
            </p>
          )}
        </div>
      </aside>

      {/* Access panel */}
      {!selected ? (
        <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white">
          <div className="text-center">
            <UserRoundCog size={34} className="mx-auto text-neutral-300" />
            <p className="mt-3 text-[12px] font-medium text-neutral-600">
              Choose a member to inspect their access
            </p>
            <p className="mt-1 text-[10.5px] text-neutral-400">
              Role defaults, individual exceptions, and org scope are shown
              together.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <header className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-white p-5 text-foreground shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-[13px] font-semibold text-primary">
                  {selected.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold">{selected.full_name}</h2>
                  <p className="mt-0.5 text-[10.5px] text-neutral-500">
                    {selected.role.replace(/_/g, " ")} ·{" "}
                    {orgMap[selected.org_id ?? ""] || "No organization"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl border border-primary/15 bg-white/70 px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">{pageCount}</div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-500">
                    Pages
                  </div>
                </div>
                <div className="rounded-xl border border-primary/15 bg-white/70 px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">{actionCount}</div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-500">
                    Actions
                  </div>
                </div>
                <div className="rounded-xl border border-primary/15 bg-white/70 px-3 py-2 text-center">
                  <div className="text-[15px] font-semibold">{overrides.length}</div>
                  <div className="text-[8.5px] uppercase tracking-widest text-neutral-500">
                    Exceptions
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-primary/15 pt-3 text-[9.5px] text-neutral-500">
              <Shield size={12} /> Effective access = individual exception → role
              default → safe fallback. Data remains protected by organization scope.
            </div>
          </header>

          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Page access
            </div>
            <div className="divide-y divide-neutral-100">
              {PAGE_PERMISSION_KEYS.map((p) => (
                <AccessRow
                  key={p}
                  permission={p}
                  role={selected.role}
                  roleRows={roleRows}
                  overrides={overrides}
                  effective={effective}
                  onCycle={cycle}
                />
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Actions
            </div>
            <div className="divide-y divide-neutral-100">
              {ACTION_PERMISSION_KEYS.map((p) => (
                <AccessRow
                  key={p}
                  permission={p}
                  role={selected.role}
                  roleRows={roleRows}
                  overrides={overrides}
                  effective={effective}
                  onCycle={cycle}
                />
              ))}
            </div>
          </section>

          {userProfile ? (
            <OrganizationScopePanel
              userId={selected.id}
              homeOrgId={selected.org_id}
              actorId={userProfile.id}
              organizations={orgs}
            />
          ) : null}
        </div>
      )}
    </m.div>
  );
}

// ─── Leadership Tab ───────────────────────────────────────────────

function LeadershipTab({
  orgId,
  headUserId,
  assistantHeadUserId,
  orgName,
}: {
  orgId: string;
  headUserId: string | null;
  assistantHeadUserId: string | null;
  orgName: string;
}) {
  const { profiles } = useProfiles();
  const { toast } = useToast();
  const [newAssistant, setNewAssistant] = useState(assistantHeadUserId ?? "");
  const [saving, setSaving] = useState(false);

  // Keep state in sync if the org changes
  useEffect(() => {
    setNewAssistant(assistantHeadUserId ?? "");
  }, [assistantHeadUserId, orgId]);

  const head = profiles.find((p) => p.id === headUserId);
  const currentAssistant = profiles.find((p) => p.id === assistantHeadUserId);

  // Candidate list: active, in this org, not the head themselves
  const candidates = profiles.filter(
    (p) =>
      p.is_active &&
      p.org_id === orgId &&
      p.id !== headUserId &&
      p.role !== "super_admin",
  );

  const handleSave = async () => {
    if (newAssistant && newAssistant === headUserId) {
      toast("Head and Assistant Head must be different people.", "error");
      return;
    }
    setSaving(true);
    try {
      await assignOrganizationLeadership(orgId, {
        headUserId: headUserId,
        assistantHeadUserId: newAssistant || null,
      });
      toast("Assistant Head updated successfully.", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update leadership.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const isDirty = newAssistant !== (assistantHeadUserId ?? "");

  return (
    <m.div
      key="leadership"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={motionTransition.productive}
      className="space-y-4"
    >
      {/* Current leadership card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-white p-5 text-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold">Department Leadership</h2>
              <p className="mt-0.5 text-[10.5px] text-neutral-500">
                {orgName} · leadership team
              </p>
            </div>
          </div>
        </header>

        <div className="divide-y divide-neutral-100">
          {/* Department Head (read-only for dept head) */}
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
              {head
                ? head.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-neutral-900">
                  {head?.full_name ?? "No Head assigned"}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/20">
                  Department Head
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-neutral-500">
                {head?.email ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <Shield size={12} /> Managed by Super Admin
            </div>
          </div>

          {/* Assistant Head — editable */}
          <div className="p-5">
            <div className="mb-4 flex items-center gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  currentAssistant
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {currentAssistant
                  ? currentAssistant.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-neutral-900">
                    {currentAssistant?.full_name ?? "No Assistant Head assigned"}
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-700">
                    Assistant Head
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  {currentAssistant?.email ?? "Reassign using the selector below."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
              <p className="text-[11px] font-medium text-neutral-700">
                Reassign Assistant Head
              </p>
              <p className="text-[10.5px] text-neutral-500">
                Select an active department member to serve as Assistant Head.
                They will gain elevated review and financial authority for this
                department. Only remove the assignment if continuity is
                otherwise covered.
              </p>
              <select
                value={newAssistant}
                onChange={(e) => setNewAssistant(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[12px] text-neutral-900 focus:border-neutral-400 focus:outline-none"
              >
                <option value="">— No Assistant Head —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.role.replace(/_/g, " ")})
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between">
                <p className="text-[9.5px] text-neutral-400">
                  {isDirty ? "Unsaved change" : "Up to date"}
                </p>
                <Button
                  kind="primary"
                  size="small"
                  disabled={!isDirty || saving}
                  loading={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? "Saving…" : "Save change"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <AttentionBox
        type="neutral"
        title="Head assignment is managed by the Super Admin"
        text="Only a Super Admin can change who holds the Department Head position. You can reassign the Assistant Head to any active member of your department."
      />
    </m.div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────

export function DeptHeadIAMWorkspace() {
  const [activeTab, setActiveTab] = useState<IAMTab>("people");

  const directory = useDeptDirectoryEmployees({
    scope: "exact",
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeSuperAdmins: true,
  });

  const { orgs } = useOrgs();
  const { userProfile } = useAuth();

  const departmentId = directory.userProfile?.departmentId;

  const employees = useMemo(
    () =>
      departmentId
        ? directory.deptEmployees.filter((e) => e.department === departmentId)
        : [],
    [directory.deptEmployees, departmentId],
  );

  const roles = useMemo(
    () =>
      new Map(
        Array.from(directory.profilesById.entries()).map(([id, profile]) => [
          id,
          String((profile as any).role || "employee"),
        ]),
      ),
    [directory.profilesById],
  );

  // Supabase org that the dept head leads
  const headOrg = useMemo(
    () => orgs.find((o) => o.head_user_id === userProfile?.id || o.head_user_id === userProfile?.uid),
    [orgs, userProfile],
  );

  // Set of employee IDs in this department (for User Access tab filtering)
  const deptMemberIds = useMemo(
    () => new Set(employees.map((e) => e.id)),
    [employees],
  );

  if (directory.directoryLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[12px] text-neutral-500">
        <Loader size="small" /> Loading department access…
      </div>
    );
  }

  if (!departmentId) {
    return (
      <div className="p-8">
        <AttentionBox
          type="warning"
          title="Department unavailable"
          text="Your account must be attached to a department before access assignments can be managed."
        />
      </div>
    );
  }

  return (
    <PeopleWorkspaceShell title="Identity & Access" subtitle="Inspect current access, make accountable individual exceptions, and protect leadership authority for active people in your department." actions={<div className="flex items-center gap-2 text-[12px] text-neutral-500"><ChevronRight size={13} /><span className="font-medium text-neutral-700">{headOrg?.name ?? "Your Department"}</span></div>}>

      {/* Tab bar */}
      <IAMTabBar active={activeTab} onSelect={setActiveTab} />

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "people" && (
          <PeopleTab key="people" employees={employees} roles={roles} />
        )}
        {activeTab === "user-access" && (
          <UserAccessTab key="user-access" deptMemberIds={deptMemberIds} />
        )}
        {activeTab === "leadership" && headOrg && (
          <LeadershipTab
            key="leadership"
            orgId={headOrg.id}
            headUserId={headOrg.head_user_id}
            assistantHeadUserId={headOrg.assistant_head_user_id}
            orgName={headOrg.name}
          />
        )}
        {activeTab === "leadership" && !headOrg && (
          <m.div
            key="leadership-noorg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTransition.productive}
          >
            <AttentionBox
              type="warning"
              title="Organization record not found"
              text="Your account is not listed as the Head of any active organization. Contact a Super Admin to link your account to the correct department organization."
            />
          </m.div>
        )}
      </AnimatePresence>
    </PeopleWorkspaceShell>
  );
}
