import { readableUiError } from '../../../../shared/userFacingError';
import { useMemo, useState } from "react";
import { AttentionBox, Button, Search as VibeSearch } from "@vibe/core";
import { BadgeCheck, ShieldCheck, UserRoundCog } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import type { Employee } from "../../../../services/employeeService";
import { getRoleLabel } from "../../../../shared/roles";
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
        readableUiError(caught, "Accounting access could not be updated.", 'write'),
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="overflow-hidden rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)]">
      <header className="flex flex-col gap-3 border-b border-[var(--eflow-border)] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-primary)]">
            <UserRoundCog size={18} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--eflow-text)]">
              Identity &amp; Access
            </h2>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-[var(--eflow-text-muted)]">
              Assign or remove the Accounting Staff workspace for active people
              in your office. No assignment is required; more than one
              person can be assigned when workload or continuity requires it.
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
      <div className="space-y-3 p-4">
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
          className="eflow-people-search w-full max-w-md"
          clearIconLabel="Clear people search"
          inputAriaLabel="Search office people"
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search office people…"
          showClearIcon
          size="small"
          value={query}
        />
        <div className="divide-y divide-[var(--eflow-border)] overflow-hidden rounded-[8px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)]">
          {filtered.map((employee) => {
            const role = roleFor(employee.id);
            const assigned = role === "accounting_staff";
            const eligible = role === "member" || assigned;
            return (
              <div
                key={employee.id}
                className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-[var(--eflow-subtle)]/60 sm:flex-row sm:items-center"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    assigned
                      ? "border-[var(--eflow-primary)]/25 bg-[var(--eflow-selected)] text-[var(--eflow-on-selected)]"
                      : "border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-text-secondary)]"
                  }`}
                >
                  {employee.initials || employee.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--eflow-text)]">
                      {employee.name}
                    </span>
                    {assigned && (
                      <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--eflow-primary)]/25 bg-[var(--eflow-selected)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-on-selected)]">
                        <BadgeCheck size={12} /> Accounting access
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--eflow-text-muted)]">
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
              </div>
            );
          })}
          {!filtered.length && (
            <EmptyState
              illustration="search"
              size="compact"
              title="No office people match this search."
            />
          )}
        </div>
      </div>
    </section>
  );
}
