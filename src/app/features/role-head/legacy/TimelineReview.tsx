import { useMemo } from "react";
import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

type GanttBar = {
  id: string;
  project: string;
  resource: string;
  start: number;
  end: number;
  color: string;
};

const GANTT_BARS: GanttBar[] = [
  {
    id: "g1",
    project: "Eco-Park · Concrete Pouring",
    resource: "Heavy Equipment Pool",
    start: 10,
    end: 18,
    color: "bg-orange-400",
  },
  {
    id: "g2",
    project: "Heavy Equipment Maintenance",
    resource: "Heavy Equipment Pool",
    start: 14,
    end: 22,
    color: "bg-red-400",
  },
  {
    id: "g3",
    project: "Coastal Road · Base Course",
    resource: "Laborer Pool A",
    start: 5,
    end: 28,
    color: "bg-blue-400",
  },
  {
    id: "g4",
    project: "Drainage · Survey Dist. 4",
    resource: "Surveyor Team",
    start: 8,
    end: 16,
    color: "bg-emerald-400",
  },
  {
    id: "g5",
    project: "Fire Station · Foundation",
    resource: "Laborer Pool B",
    start: 16,
    end: 32,
    color: "bg-purple-400",
  },
  {
    id: "g6",
    project: "Public Market · Roof Trusses",
    resource: "Welding Crew",
    start: 20,
    end: 30,
    color: "bg-rose-400",
  },
  {
    id: "g7",
    project: "Business Expo · Venue Prep",
    resource: "Events Team",
    start: 18,
    end: 24,
    color: "bg-cyan-400",
  },
  {
    id: "g8",
    project: "ICT Upgrade · Server Install",
    resource: "ICT Crew",
    start: 12,
    end: 20,
    color: "bg-amber-400",
  },
];

export function TimelineReview() {
  const max = 35;
  // Detect resource conflicts: same resource overlapping
  const conflicts = useMemo(() => {
    const map = new Map<string, GanttBar[]>();
    GANTT_BARS.forEach((b) => {
      const arr = map.get(b.resource) || [];
      arr.push(b);
      map.set(b.resource, arr);
    });
    const overlaps: { a: GanttBar; b: GanttBar; start: number; end: number }[] =
      [];
    map.forEach((bars) => {
      for (let i = 0; i < bars.length; i++) {
        for (let j = i + 1; j < bars.length; j++) {
          const s = Math.max(bars[i].start, bars[j].start);
          const e = Math.min(bars[i].end, bars[j].end);
          if (s < e)
            overlaps.push({ a: bars[i], b: bars[j], start: s, end: e });
        }
      }
    });
    return overlaps;
  }, []);

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Project Timeline · Dynamic Gantt"
        subtitle="Resource conflict detection · April 1 → May 5, 2026"
        actions={
          <>
            <Btn icon={<Calendar size={13} />} label="Week View" />
            <Btn
              icon={<AlertTriangle size={13} />}
              label={`${conflicts.length} Conflicts`}
              variant="danger"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Active Timelines"
          value={GANTT_BARS.length.toString()}
          trend="Across 6 resource pools"
          tone="neutral"
        />
        <Stat
          label="Resource Conflicts"
          value={conflicts.length.toString()}
          trend="Overlapping commitments"
          tone="bad"
        />
        <Stat
          label="Peak Week"
          value="Apr 20–26"
          trend="5 parallel deployments"
          tone="warn"
        />
        <Stat
          label="Buffer Days"
          value="3"
          trend="Slack in master schedule"
          tone="neutral"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[240px_1fr] gap-3 mb-3 pb-2 border-b border-neutral-100">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Activity · Resource
            </div>
            <div className="relative h-5">
              {[0, 7, 14, 21, 28, 35].map((d) => (
                <div
                  key={d}
                  className="absolute top-0 text-[10px] font-normal text-neutral-400"
                  style={{ left: `${(d / max) * 100}%` }}
                >
                  Apr {d + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {GANTT_BARS.map((b) => {
              const left = (b.start / max) * 100;
              const width = ((b.end - b.start) / max) * 100;
              const inConflict = conflicts.some(
                (c) => c.a.id === b.id || c.b.id === b.id,
              );
              return (
                <div
                  key={b.id}
                  className="grid grid-cols-[240px_1fr] gap-3 items-center"
                >
                  <div>
                    <div className="text-[12px] font-medium text-neutral-900 truncate">
                      {b.project}
                    </div>
                    <div className="text-[10.5px] font-normal text-neutral-500 truncate">
                      {b.resource}
                    </div>
                  </div>
                  <div className="relative h-7 bg-neutral-50 border border-neutral-100 rounded">
                    {[7, 14, 21, 28].map((d) => (
                      <div
                        key={d}
                        className="absolute top-0 bottom-0 w-px bg-neutral-100"
                        style={{ left: `${(d / max) * 100}%` }}
                      />
                    ))}
                    <div
                      className={`absolute top-1 bottom-1 ${b.color} rounded flex items-center px-2 ${inConflict ? "ring-2 ring-orange-500" : ""}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="text-[9.5px] font-medium text-white truncate">
                        {b.end - b.start}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conflict overlay band */}
          <div className="mt-5 pt-4 border-t border-neutral-100">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
              Detected Resource Conflicts
            </div>
            <div className="space-y-2">
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2"
                >
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5" />
                  <div className="text-[11.5px] font-normal text-orange-900 leading-relaxed">
                    <span className="font-medium">
                      "{c.a.project}"
                    </span>{" "}
                    and{" "}
                    <span className="font-medium">
                      "{c.b.project}"
                    </span>{" "}
                    both require the{" "}
                    <span className="font-medium">
                      {c.a.resource}
                    </span>{" "}
                    during{" "}
                    <span className="tabular-nums">
                      Apr {c.start + 1} – Apr {c.end + 1}
                    </span>
                    . Physical resource cannot be in two places at once.
                  </div>
                </div>
              ))}
              {conflicts.length === 0 && (
                <div className="text-[12px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 size={13} /> No resource conflicts detected.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 15.2.A — TEAM ASSIGNMENTS ====================
