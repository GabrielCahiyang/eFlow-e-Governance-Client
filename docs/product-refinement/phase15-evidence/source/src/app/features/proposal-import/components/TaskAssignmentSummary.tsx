import { Crown, Users } from "lucide-react";
import type { Employee } from "../../../services/employeeService";
import { getInitials } from "./draftModel";

export function TaskAssignmentSummary({
  employees,
  leadMemberId,
}: {
  employees: Employee[];
  leadMemberId: string | null;
}) {
  if (employees.length === 0) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Users size={14} className="shrink-0 text-neutral-400" />
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-neutral-600">
            Assign team &amp; leader
          </div>
          <div className="text-[9px] text-neutral-400">
            Choose contributors and designate one leader
          </div>
        </div>
      </div>
    );
  }

  const leader =
    employees.find((employee) => employee.id === leadMemberId) || employees[0];

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex shrink-0 -space-x-1.5">
        {employees.slice(0, 4).map((employee) => (
          <span
            key={employee.id}
            title={employee.name}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white ${
              employee.id === leader.id ? "bg-violet-600" : "bg-neutral-700"
            }`}
          >
            {getInitials(employee.name)}
          </span>
        ))}
        {employees.length > 4 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[9px] font-medium text-neutral-600">
            +{employees.length - 4}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-700">
          <Crown size={11} className="shrink-0" /> Team leader
        </div>
        <div className="truncate text-[12px] font-medium text-neutral-800">
          {leader.name}
        </div>
        <div className="text-[9px] text-neutral-400">
          {employees.length} team member{employees.length === 1 ? "" : "s"} · click to edit
        </div>
      </div>
    </div>
  );
}
