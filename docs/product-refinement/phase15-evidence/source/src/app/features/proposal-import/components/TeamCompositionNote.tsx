import { Crown, UserRound, UsersRound } from "lucide-react";
import type { ProposalTeamComposition } from "../types";

export function TeamCompositionNote({
  composition,
}: {
  composition: ProposalTeamComposition;
}) {
  const solo = composition.mode === "solo";

  return (
    <div
      className={`mt-2.5 max-w-2xl rounded-xl border px-3.5 py-3 ${
        solo
          ? "border-blue-200 bg-blue-50/60"
          : "border-violet-200 bg-violet-50/60"
      }`}
      role="note"
      aria-label="AI team composition"
    >
      <div className="flex items-start gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
          solo ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
        }`}>
          {solo ? <UserRound size={14} /> : <UsersRound size={14} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-neutral-900">
              {solo ? "Solo assignment" : `${composition.selectedCount}-person delivery team`}
            </span>
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] text-neutral-500">
              {composition.selectedCount} of {composition.eligibleCount} eligible selected
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">
            {composition.rationale}
          </p>
        </div>
      </div>

      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {composition.memberReasons.map((member) => (
          <div
            key={member.employeeId}
            className="flex items-start gap-2 rounded-lg border border-white bg-white/80 px-2.5 py-2"
          >
            <span className={`mt-0.5 ${member.role === "lead" ? "text-amber-600" : "text-neutral-400"}`}>
              {member.role === "lead" ? <Crown size={11} /> : <UserRound size={11} />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-neutral-800">
                {member.employeeName} · {member.role === "lead" ? "Lead" : "Support"}
              </div>
              <div className="text-[9px] leading-relaxed text-neutral-500">
                {member.contribution}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
