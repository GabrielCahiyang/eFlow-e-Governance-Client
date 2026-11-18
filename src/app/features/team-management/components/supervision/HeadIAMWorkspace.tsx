import { readableUiError } from '../../../../shared/userFacingError';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import {
  AttentionBox,
  Button,
  Search as VibeSearch,
} from "@vibe/core";
import {
  BadgeCheck,
  ChevronRight,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useOrgs } from "../../../../hooks/useSupabaseData";
import { getRoleLabel } from "../../../../shared/roles";
import { motionTransition } from "../../../../shared/motion/motionTokens";
import { useDeptDirectoryEmployees } from "../../../members";
import { setDepartmentAccountingStaff } from "../../services/departmentIdentityService";
import type { Employee } from "../../../../services/employeeService";
import { PeopleWorkspaceShell } from "../PeopleWorkspaceShell";

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

  const roleFor = (id: string) => optimisticRoles[id] || roles.get(id) || "member";
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
        [employee.id]: assign ? "accounting_staff" : "member",
      }));
    } catch (err) {
      setError(
        readableUiError(err, "Accounting access could not be updated.", 'write'),
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
                people in your office. No assignment is required; more than
                one person can be assigned when workload or continuity requires
                it.
              </p>
            </div>
          </div>
          <span
            className={`inline-flex w-fit shrink-0 items-center rounded-[6px] border px-2.5 py-1 text-[12px] font-medium ${
              accountingCount
                ? "border-[var(--eflow-positive-text)]/25 bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]"
                : "border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-text-secondary)]"
            }`}
          >
            {accountingCount} accounting{" "}
            {accountingCount === 1 ? "staff member" : "staff members"}
          </span>
        </header>

        <div className="space-y-4 p-5">
          {error && (
            <AttentionBox type="negative" title="Access update failed" text={error} />
          )}
          {!accountingCount && (
            <AttentionBox
              type="neutral"
              title="No Accounting Staff assigned"
              text="The Head and Member retain financial authority. Assign a staff member here when dedicated accounting support is available."
            />
          )}

          <VibeSearch
            className="eflow-people-search w-full max-w-md"
            clearIconLabel="Clear people search"
            inputAriaLabel="Search office people"
            onChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search name, email or job title…"
            showClearIcon
            size="small"
            value={query}
          />

          <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {filtered.map((employee, index) => {
              const role = roleFor(employee.id);
              const assigned = role === "accounting_staff";
              const eligible = role === "member" || assigned;
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
                    <span className="inline-flex w-fit items-center rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
                      Leadership role protected
                    </span>
                  )}
                </m.div>
              );
            })}
            {!filtered.length && (
              <EmptyState illustration="search" size="compact" title="No office people match this search."/>
            )}
          </div>
        </div>
      </div>
    </m.div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────

export function HeadIAMWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const directory = useDeptDirectoryEmployees({
    scope: "exact",
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
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
          String((profile as any).role || "member"),
        ]),
      ),
    [directory.profilesById],
  );

  // Supabase org that the dept head leads
  const headOrg = useMemo(
    () => orgs.find((o) => o.head_user_id === userProfile?.id || o.head_user_id === userProfile?.uid),
    [orgs, userProfile],
  );

  if (directory.directoryLoading) {
    const loadingBody = (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading office access…"
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <span className="sr-only">Loading office access…</span>
        <header
          className="flex flex-col gap-4 border-b border-neutral-100 p-5 lg:flex-row lg:items-center lg:justify-between"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50" />
            <div className="space-y-2">
              <div className="h-4 w-36 rounded-[6px] bg-neutral-200/80" />
              <div className="h-3 w-80 max-w-full rounded-[6px] bg-neutral-100" />
            </div>
          </div>
          <div className="h-6 w-40 rounded-[6px] bg-neutral-200/70" />
        </header>
        <div className="space-y-4 p-5" aria-hidden="true">
          <div className="h-9 w-full max-w-md rounded-xl bg-neutral-100" />
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200/80" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3.5 w-40 rounded-[6px] bg-neutral-200/80" />
                  <div className="h-3 w-56 rounded-[6px] bg-neutral-100" />
                </div>
                <div className="h-8 w-44 rounded-lg bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    if (embedded) {
      return <div className="space-y-4 pt-3">{loadingBody}</div>;
    }

    return (
      <PeopleWorkspaceShell
        title="Identity & Access"
        subtitle="Assign or remove the Accounting Staff workspace for active people in your office."
        actions={
          <div className="flex items-center gap-2 text-[12px] text-neutral-500">
            <ChevronRight size={13} />
            <span className="font-medium text-neutral-700">
              {headOrg?.name ?? "Your Office"}
            </span>
          </div>
        }
      >
        {loadingBody}
      </PeopleWorkspaceShell>
    );
  }

  if (!departmentId) {
    return (
      <div className="p-8">
        <AttentionBox
          type="warning"
          title="Office unavailable"
          text="Your account must be attached to an Office before access assignments can be managed."
        />
      </div>
    );
  }

  const contentBody = <PeopleTab employees={employees} roles={roles} />;

  if (embedded) {
    return <div className="space-y-4 pt-3">{contentBody}</div>;
  }

  return (
    <PeopleWorkspaceShell
      title="Identity & Access"
      subtitle="Assign or remove the Accounting Staff workspace for active people in your office."
      actions={
        <div className="flex items-center gap-2 text-[12px] text-neutral-500">
          <ChevronRight size={13} />
          <span className="font-medium text-neutral-700">
            {headOrg?.name ?? "Your Office"}
          </span>
        </div>
      }
    >
      {contentBody}
    </PeopleWorkspaceShell>
  );
}
