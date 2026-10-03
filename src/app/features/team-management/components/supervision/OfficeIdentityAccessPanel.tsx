import { useMemo, useState } from "react";
import { AttentionBox, Button, Label, Search as VibeSearch } from "@vibe/core";
import * as m from "motion/react-m";
import { BadgeCheck, ShieldCheck, UserRoundCog } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import { getRoleLabel } from "../../../../shared/roles";
import { motionTransition } from "../../../../shared/motion/motionTokens";
import { setDepartmentAccountingStaff } from "../../services/departmentIdentityService";

export function OfficeIdentityAccessPanel({
  employees,
  roles,
}: {
  employees: Employee[];
  roles: ReadonlyMap<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [optimisticRoles, setOptimisticRoles] = useState<
    Record<string, string>
  >({});
  const roleFor = (id: string) =>
    optimisticRoles[id] || roles.get(id) || "member";
  const accountingCount = employees.filter(
    (employee) => roleFor(employee.id) === "accounting_staff",
  ).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        !needle ||
        `${employee.name} ${employee.email || ""} ${employee.jobTitle}`
          .toLowerCase()
          .includes(needle),
    );
  }, [employees, query]);

  const update = async (employee: Employee, assigned: boolean) => {
    setBusyId(employee.id);
    setError("");
    try {
      await setDepartmentAccountingStaff(employee.id, assigned);
      setOptimisticRoles((current) => ({
        ...current,
        [employee.id]: assigned ? "accounting_staff" : "member",
      }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Accounting access could not be updated.",
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <m.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTransition.productive}
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-neutral-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <UserRoundCog size={19} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-neutral-950">
              Identity &amp; Access
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
              Assign or remove the Accounting Staff workspace for active people
              in your office. No assignment is required; more than one
              person can be assigned when workload or continuity requires it.
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
          <AttentionBox
            type="negative"
            title="Access update failed"
            text={error}
          />
        )}
        {!accountingCount && (
          <AttentionBox
            type="neutral"
            title="No Accounting Staff assigned"
            text="The Head and Member retain financial authority. Assign a staff member here when dedicated accounting support is available."
          />
        )}
        <VibeSearch
          className="w-full max-w-md"
          clearIconLabel="Clear people search"
          inputAriaLabel="Search office people"
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search office people…"
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
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${assigned ? "bg-blue-100 text-blue-800" : "bg-neutral-100 text-neutral-600"}`}
                >
                  {employee.initials || employee.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-neutral-900">
                      {employee.name}
                    </span>
                    {assigned && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-700">
                        <BadgeCheck size={12} /> Accounting access
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-neutral-500">
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
            <div className="p-8 text-center text-[12px] text-neutral-500">
              No office people match this search.
            </div>
          )}
        </div>
      </div>
    </m.section>
  );
}
