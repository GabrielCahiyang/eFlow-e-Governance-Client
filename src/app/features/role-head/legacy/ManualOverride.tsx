import { useState } from "react";
import { CheckCircle2, Dna, Info, MapPin, RefreshCw } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Employee } from "../../../services/employeeService";
import { Btn, PageHeader, Stat } from "./primitives";
import { FIELD, fatigueIcon, type FieldWorker } from "./OptimalDistributionMatrix";

type ColumnTask = {
  id: string;
  title: string;
  site: string;
  workers: FieldWorker[];
};

const INITIAL_COLS: ColumnTask[] = [
  {
    id: "c1",
    title: "Coastal Road Paving",
    site: "KM 4.2",
    workers: [FIELD[0], FIELD[9]],
  },
  {
    id: "c2",
    title: "Eco-Park Concrete",
    site: "Eco-Park Site",
    workers: [FIELD[1], FIELD[2], FIELD[10]],
  },
  {
    id: "c3",
    title: "Plaza QA Inspection",
    site: "Plaza Cancion",
    workers: [FIELD[3]],
  },
  {
    id: "c4",
    title: "Fire Station Labor",
    site: "Annex Footing",
    workers: [FIELD[8]],
  },
];

export function ManualOverride({}: {
  tasks?: Task[];
  employees?: Employee[];
  departmentId?: string;
}) {
  const [cols, setCols] = useState<ColumnTask[]>(INITIAL_COLS);
  const [drag, setDrag] = useState<{
    colId: string;
    worker: FieldWorker;
  } | null>(null);
  const [recalc, setRecalc] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const onDragStart = (colId: string, worker: FieldWorker) =>
    setDrag({ colId, worker });
  const onDrop = (targetColId: string) => {
    if (!drag) return;
    if (drag.colId === targetColId) {
      setDrag(null);
      return;
    }
    const next = cols.map((c) => {
      if (c.id === drag.colId)
        return {
          ...c,
          workers: c.workers.filter((w) => w.id !== drag.worker.id),
        };
      if (c.id === targetColId)
        return { ...c, workers: [...c.workers, drag.worker] };
      return c;
    });
    setCols(next);
    setFlash(targetColId);
    setRecalc(true);
    setDrag(null);
    setTimeout(() => setRecalc(false), 1000);
    setTimeout(() => setFlash(null), 1400);
  };

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Manual Override · Safety Valve"
        subtitle="Drag-and-drop corrections · GA auto-rebalances remaining matrix"
        actions={
          <>
            <Btn icon={<RefreshCw size={13} />} label="Revert to GA Original" />
            <Btn
              icon={<CheckCircle2 size={13} />}
              label="Commit Overrides"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Active Columns"
          value={cols.length.toString()}
          trend="Parallel deployments"
          tone="neutral"
        />
        <Stat
          label="Workers Deployed"
          value={cols.reduce((s, c) => s + c.workers.length, 0).toString()}
          trend="Total head-count"
          tone="neutral"
        />
        <Stat
          label="Manual Overrides"
          value="—"
          trend="This session"
          tone="neutral"
        />
        <Stat
          label="GA Harmony Score"
          value={recalc ? "…" : "0.91"}
          trend="Post-override fitness"
          tone={recalc ? "warn" : "good"}
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-2">
        <Info size={13} className="text-amber-700 mt-0.5" />
        <div className="text-[11.5px] font-normal text-amber-900 leading-relaxed">
          <span className="font-medium">
            Human-in-the-loop.
          </span>{" "}
          Drag any avatar to another task column to resolve conflicts the
          algorithm cannot see (personal disputes, family emergencies, political
          sensitivities). The GA will instantly recalculate the remaining matrix
          so no project drops below its minimum crew.
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 relative">
        {recalc && (
          <div className="absolute -top-2 right-0 z-10 text-[10px] font-medium uppercase text-indigo-700 bg-white border border-indigo-200 rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <Dna size={11} className="animate-spin" /> GA recalculating…
          </div>
        )}
        {cols.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.id)}
            className={`bg-white border-2 rounded-xl p-4 min-h-[320px] transition ${drag && drag.colId !== col.id ? "border-dashed border-indigo-400 bg-indigo-50/30" : "border-neutral-200"} ${flash === col.id ? "ring-2 ring-emerald-400" : ""}`}
          >
            <div className="mb-3 pb-3 border-b border-neutral-100">
              <div className="text-[12.5px] font-semibold text-neutral-900">
                {col.title}
              </div>
              <div className="text-[10.5px] font-normal text-neutral-500 flex items-center gap-1">
                <MapPin size={10} /> {col.site}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[9px] font-medium uppercase bg-neutral-100 text-neutral-700 rounded px-1.5 py-0.5">
                  {col.workers.length} deployed
                </span>
                {col.workers.length < 2 && (
                  <span className="text-[9px] font-medium uppercase bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                    Under-staffed
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {col.workers.map((w) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => onDragStart(col.id, w)}
                  onDragEnd={() => setDrag(null)}
                  className={`bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition ${drag?.worker.id === w.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-[9px] font-semibold text-neutral-700 shrink-0">
                      {w.name
                        .split(" ")
                        .slice(-2)
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-neutral-900 truncate">
                        {w.name}
                      </div>
                      <div className="text-[9.5px] font-normal text-neutral-500 truncate">
                        {w.role}
                      </div>
                    </div>
                    {fatigueIcon(w.fatigue)}
                  </div>
                </div>
              ))}
              {col.workers.length === 0 && (
                <div className="text-center text-[10.5px] text-neutral-400 py-8 border-2 border-dashed border-neutral-200 rounded-lg">
                  Drop worker here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 17.1.C — IDLE TIME MINIMIZATION ====================
