import { Plus } from "lucide-react";
import { formatManilaDate } from "../../../shared/calendarDisplay";
import { Btn, PageHeader, Stat } from "./primitives";

type DebriefEvent = {
  id: number;
  event: string;
  date: string;
  dept: string;
  frontline: number;
  debriefed: number;
  deadline: string;
  status: "pending" | "in-progress" | "complete";
};

const DEBRIEFS: DebriefEvent[] = [
  { id: 1, event: "Typhoon Kristine Response", date: "2026-03-28", dept: "CDRRMO", frontline: 86, debriefed: 42, deadline: "2026-04-28", status: "in-progress" },
  { id: 2, event: "Brgy. Cogon Fire Incident", date: "2026-04-11", dept: "Bureau of Fire", frontline: 24, debriefed: 24, deadline: "2026-05-11", status: "complete" },
  { id: 3, event: "Dengue Outbreak · Dist. 2", date: "2026-04-14", dept: "City Health", frontline: 38, debriefed: 12, deadline: "2026-05-14", status: "in-progress" },
  { id: 4, event: "Flash Flood · Isla Verde", date: "2026-04-18", dept: "CDRRMO", frontline: 52, debriefed: 0, deadline: "2026-05-18", status: "pending" },
  { id: 5, event: "Road Accident Mass Casualty", date: "2026-04-20", dept: "EMS / Traffic", frontline: 18, debriefed: 4, deadline: "2026-05-20", status: "pending" },
];

export function StressDebriefing() {
  return (
    <div>
      <PageHeader
        title="Post-Incident Debriefing Tracker"
        subtitle="Mandatory psychological debriefings for frontline responders · no one slips through"
        actions={<Btn icon={<Plus size={14} />} label="Log New Event" variant="primary" />}
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Open Events" value={String(DEBRIEFS.filter((d) => d.status !== "complete").length)} trend="across frontline depts" />
        <Stat label="Frontline Responders" value="218" trend="awaiting debrief" tone="warn" />
        <Stat label="Coverage Rate" value={`${Math.round((DEBRIEFS.reduce((s, d) => s + d.debriefed, 0) / DEBRIEFS.reduce((s, d) => s + d.frontline, 0)) * 100)}%`} trend="of frontline staff" />
        <Stat label="Overdue" value="0" trend="SLA maintained" tone="good" />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-neutral-200 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
          <div className="col-span-4">Critical Event</div>
          <div className="col-span-2">Date · Dept</div>
          <div className="col-span-3">Debriefing Coverage</div>
          <div className="col-span-2">SLA Deadline</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {DEBRIEFS.map((d) => {
          const pct = Math.round((d.debriefed / d.frontline) * 100);
          const statusStyle = d.status === "complete" ? "bg-emerald-100 text-emerald-700" : d.status === "in-progress" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
          return (
            <div key={d.id} className="grid grid-cols-12 px-5 py-4 border-b border-neutral-100 last:border-0 items-center hover:bg-neutral-50 transition-colors">
              <div className="col-span-4">
                <div className="text-[13px] font-medium text-neutral-900">{d.event}</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle}`}>
                  {d.status}
                </span>
              </div>
              <div className="col-span-2 text-[12px] font-normal text-neutral-600">
                {d.date}
                <div className="text-[10px] text-neutral-400">{d.dept}</div>
              </div>
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-medium text-neutral-700 w-20 text-right">
                    {d.debriefed}/{d.frontline}
                  </span>
                </div>
              </div>
              <div className="col-span-2 text-[12px] font-normal text-neutral-600">{formatManilaDate(d.deadline, d.deadline)}</div>
              <div className="col-span-1 text-right">
                <button className="text-[11px] font-medium text-neutral-900 hover:underline cursor-pointer">Schedule</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 10.2.A — TERMINAL LEAVE CREDITS ====================
