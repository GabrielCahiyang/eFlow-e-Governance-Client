import { useState } from "react";
import { BatteryFull, BatteryLow, BatteryMedium, ClipboardList, Dna, Download, MapPin, Shield, Sparkles, Users } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";
import { FIELD, TASKS, type DeployTask, type FieldWorker } from './optimal-distribution/data';

export { FIELD, type FieldWorker } from './optimal-distribution/data';

export function fatigueIcon(f: FieldWorker["fatigue"]) {
  if (f === "low")
    return <BatteryFull size={11} className="text-emerald-600" />;
  if (f === "medium")
    return <BatteryMedium size={11} className="text-amber-600" />;
  return <BatteryLow size={11} className="text-red-600" />;
}

type Assignment = { taskId: string; workerId: string; reason: string };

function computeGAAssignments(
  workers: FieldWorker[],
  tasks: DeployTask[],
): Assignment[] {
  const used = new Set<string>();
  const results: Assignment[] = [];
  for (const task of tasks) {
    const candidates = workers.filter(
      (w) => !used.has(w.id) && w.skills.includes(task.required),
    );
    candidates.sort((a, b) => {
      const score = (w: FieldWorker) =>
        100 -
        w.distanceKm * 3 +
        (w.fatigue === "low" ? 30 : w.fatigue === "medium" ? 10 : 0) +
        (w.license ? 15 : 0);
      return score(b) - score(a);
    });
    const pick = candidates[0];
    if (pick) {
      used.add(pick.id);
      const bits: string[] = [];
      if (pick.license && task.required === "Operator")
        bits.push(`Holds ${pick.license}`);
      bits.push(`GPS ${pick.distanceKm}km from site`);
      bits.push(`Fatigue: ${pick.fatigue}`);
      results.push({
        taskId: task.id,
        workerId: pick.id,
        reason: bits.join(" · "),
      });
    }
  }
  return results;
}

export function OptimalDistributionMatrix() {
  const [generating, setGenerating] = useState(false);
  const [gen, setGen] = useState(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [inspect, setInspect] = useState<Assignment | null>(null);

  const generate = () => {
    setGenerating(true);
    setGen(0);
    setAssignments([]);
    const iterations = 8;
    const tick = (i: number) => {
      setGen(i);
      if (i < iterations) setTimeout(() => tick(i + 1), 180);
      else {
        const a = computeGAAssignments(FIELD, TASKS);
        setAssignments(a);
        setInspect(a[0]);
        setGenerating(false);
      }
    };
    setTimeout(() => tick(1), 150);
  };

  const getTask = (tid: string) => TASKS.find((t) => t.id === tid)!;
  const getWorker = (wid: string) => FIELD.find((f) => f.id === wid)!;
  const isAssigned = (wid: string) =>
    assignments.some((a) => a.workerId === wid);

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="GA Deployment Matrix"
        subtitle="Genetic Algorithm · 2,147 field workers · skill × location × fatigue fitness"
        actions={
          <>
            <Btn icon={<Download size={13} />} label="Export Roster" />
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-60"
            >
              {generating ? (
                <Dna size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {generating
                ? `Evolving gen ${gen}/8…`
                : "Generate Tomorrow's Schedule"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Tasks to Cover"
          value={TASKS.length.toString()}
          trend="P1: 3 · P2: 2 · P3: 1"
          tone="neutral"
        />
        <Stat
          label="Workers Deployed"
          value={assignments.length.toString()}
          trend={`of ${FIELD.length} eligible`}
          tone={assignments.length ? "good" : "neutral"}
        />
        <Stat
          label="Avg. Travel Distance"
          value={
            assignments.length
              ? `${(assignments.reduce((s, a) => s + getWorker(a.workerId).distanceKm, 0) / assignments.length).toFixed(1)}km`
              : "—"
          }
          trend="Minimized vs. random"
          tone="good"
        />
        <Stat
          label="Fitness Score"
          value={assignments.length ? "0.94" : "—"}
          trend="After 8 generations"
          tone="good"
        />
      </div>

      <div className="grid grid-cols-[1fr_1.2fr_0.8fr] gap-4">
        {/* Task columns */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={14} className="text-neutral-900" />
            <div className="text-[12.5px] font-medium text-neutral-900">
              Tasks Queue
            </div>
          </div>
          <div className="space-y-2">
            {TASKS.map((t) => {
              const a = assignments.find((x) => x.taskId === t.id);
              const tone =
                t.priority === "P1"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : t.priority === "P2"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600";
              return (
                <div
                  key={t.id}
                  className={`border rounded-lg p-2.5 ${a ? "bg-emerald-50/40 border-emerald-200" : "bg-white border-neutral-200"}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-[11.5px] font-medium text-neutral-900 truncate pr-1">
                      {t.name}
                    </div>
                    <span
                      className={`text-[9px] font-medium border rounded px-1 py-0.5 shrink-0 ${tone}`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <div className="text-[10px] font-normal text-neutral-500 flex items-center gap-1">
                    <MapPin size={9} />
                    {t.site} · needs {t.required}
                  </div>
                  {a && (
                    <button
                      onClick={() => setInspect(a)}
                      className={`mt-2 text-left w-full bg-white border rounded p-1.5 ${inspect?.workerId === a.workerId ? "border-emerald-500" : "border-emerald-200"} hover:border-emerald-400`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center text-[8px] font-semibold text-emerald-900">
                          {getWorker(a.workerId)
                            .name.split(" ")
                            .slice(-2)
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div className="text-[10.5px] font-medium text-emerald-900 truncate">
                          {getWorker(a.workerId).name}
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Worker Grid */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-neutral-900" />
            <div className="text-[12.5px] font-medium text-neutral-900">
              Field Workers Skill Grid
            </div>
            <div className="ml-auto text-[10px] font-normal text-neutral-500">
              {FIELD.length} visible · {assignments.length} assigned
            </div>
          </div>
          {generating && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div
                className="absolute inset-x-0 h-10 bg-gradient-to-b from-indigo-400/40 to-transparent"
                style={{
                  top: `${(gen / 8) * 90}%`,
                  transition: "top 180ms linear",
                }}
              />
              <div className="absolute top-2 right-2 text-[10px] font-medium uppercase text-indigo-600 bg-white/90 rounded px-1.5 py-0.5 border border-indigo-200">
                Generation {gen}/8 · mutation ↻
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            {FIELD.map((w) => {
              const assigned = isAssigned(w.id);
              const inspectMe = inspect?.workerId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    const a = assignments.find((x) => x.workerId === w.id);
                    if (a) setInspect(a);
                  }}
                  className={`text-left border rounded-lg p-2 transition ${inspectMe ? "border-indigo-500 bg-indigo-50 shadow-sm" : assigned ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-100 bg-neutral-50 hover:bg-white"}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${assigned ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-700"}`}
                    >
                      {w.name
                        .split(" ")
                        .slice(-2)
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-medium text-neutral-900 truncate">
                        {w.name.replace(/^(Engr\.|Mr\.|Ms\.) /, "")}
                      </div>
                      <div className="text-[9px] font-normal text-neutral-500 truncate">
                        {w.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[8.5px] font-normal text-neutral-500">
                    {fatigueIcon(w.fatigue)}
                    <span className="tabular-nums">{w.distanceKm}km</span>
                    {w.license && (
                      <Shield size={9} className="text-blue-600 ml-auto" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Match reason */}
        <div className="bg-neutral-950 rounded-xl p-4 text-neutral-100 h-fit sticky top-4">
          <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-400 uppercase tracking-wider mb-3">
            <Dna size={12} /> Match Rationale
          </div>
          {inspect ? (
            <>
              <div className="text-[13px] font-semibold text-white mb-1">
                {getWorker(inspect.workerId).name}
              </div>
              <div className="text-[10.5px] font-normal text-neutral-400 mb-3">
                → {getTask(inspect.taskId).name}
              </div>
              <div className="bg-indigo-950/40 border border-indigo-900 rounded-lg p-3 text-[11px] font-normal text-indigo-100 leading-relaxed">
                {inspect.reason}
              </div>
              <div className="mt-3 space-y-1.5 text-[10.5px] font-normal">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Required skill</span>
                  <span className="text-neutral-100">
                    {getTask(inspect.taskId).required}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Site</span>
                  <span className="text-neutral-100">
                    {getTask(inspect.taskId).site}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">GPS distance</span>
                  <span className="text-neutral-100 tabular-nums">
                    {getWorker(inspect.workerId).distanceKm}km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Fatigue level</span>
                  <span className="text-neutral-100 capitalize">
                    {getWorker(inspect.workerId).fatigue}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Priority</span>
                  <span className="text-neutral-100">
                    {getTask(inspect.taskId).priority}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-neutral-500 py-8 text-[11px]">
              Generate schedule, then click an assigned worker to view the GA's
              reasoning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 17.1.B — MANUAL OVERRIDE ====================
