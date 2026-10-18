import { EmptyState } from '../../../../components/ui/EmptyState';
import { Search, ShieldAlert, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { SkillCoverageRow } from "../../types";

export function SkillCoveragePanel({ rows }: { rows: SkillCoverageRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | SkillCoverageRow["coverage"]>("all");
  const filtered = useMemo(() => rows.filter((row) => (filter === "all" || row.coverage === filter) && (!search.trim() || `${row.skill} ${row.employeeNames.join(" ")}`.toLowerCase().includes(search.toLowerCase()))), [filter, rows, search]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-[16px] font-semibold text-neutral-900">Skills and continuity coverage</h2><p className="mt-0.5 text-[12px] text-neutral-500">Profile skills and manager-confirmed tags currently available to AI assignment matching.</p></div><div className="flex gap-2"><div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills…" className="h-8 w-44 rounded-lg border border-neutral-200 pl-8 pr-2 text-[12px] outline-none" /></div><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[12px] outline-none"><option value="all">All coverage</option><option value="single_point">Single-person risk</option><option value="limited">Limited coverage</option><option value="covered">Covered</option></select></div></div>
      <div className="divide-y divide-neutral-100">
        {filtered.map((row) => {
          const tone = row.coverage === "single_point" ? "bg-red-50 text-red-700" : row.coverage === "limited" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
          return <div key={row.skill} className="flex items-center gap-3 px-4 py-3"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>{row.coverage === "single_point" ? <ShieldAlert size={14} /> : <UsersRound size={14} />}</div><div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-neutral-800">{row.skill}</div><div className="mt-0.5 truncate text-[12px] text-neutral-500">{row.employeeNames.join(", ")}</div></div><span className={`rounded-full px-2 py-1 text-[12px] font-medium ${tone}`}>{row.coverage === "single_point" ? "Single-person dependency" : row.coverage === "limited" ? "2 people" : `${row.employeeIds.length} people`}</span></div>;
        })}
        {filtered.length === 0 && <EmptyState illustration="search" size="compact" title="No skills match these filters."/>}
      </div>
    </section>
  );
}
