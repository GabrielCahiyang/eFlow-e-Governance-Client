import { ArrowRight, Gauge, ShieldAlert } from "lucide-react";
import type { ProposalAssignmentException } from "../types";

export function AssignmentExceptionNote({
  exception,
}: {
  exception: ProposalAssignmentException;
}) {
  const high = exception.severity === "high";

  return (
    <div
      className={`mt-2.5 max-w-2xl rounded-xl border px-3.5 py-3 ${
        high
          ? "border-red-200 bg-red-50/70"
          : "border-amber-200 bg-amber-50/70"
      }`}
      role="note"
      aria-label="Capacity-aware assignment exception"
    >
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
          high ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
        }`}>
          <ShieldAlert size={14} />
        </span>
        <div>
          <div className="text-[11px] font-medium text-neutral-900">
            Capacity-aware assignment
          </div>
          <div className="text-[9.5px] text-neutral-500">
            Strong skill fit retained while avoiding member overload.
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px]">
        <span className="rounded-lg border border-white/80 bg-white px-2.5 py-1.5 text-neutral-700 shadow-sm">
          <strong>{exception.bypassedEmployeeName}</strong> · strongest match {exception.bypassedSkillMatch}%
          <span className={`ml-1.5 ${high ? "text-red-700" : "text-amber-700"}`}>
            <Gauge size={10} className="mr-0.5 inline" />
            {exception.bypassedWorkloadSignal}/100
          </span>
        </span>
        <ArrowRight size={12} className="text-neutral-400" />
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800 shadow-sm">
          <strong>{exception.selectedEmployeeName}</strong> · assigned {exception.selectedSkillMatch}%
          <span className="ml-1.5">
            <Gauge size={10} className="mr-0.5 inline" />
            {exception.selectedWorkloadSignal}/100
          </span>
        </span>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">
        {exception.message}
      </p>
    </div>
  );
}
