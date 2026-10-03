import { useState } from "react";
import { ArrowRight, CheckCircle2, Navigation, Radio, Route, Timer, Zap } from "lucide-react";
import type { Task } from "../../../services/taskService";
import type { Employee } from "../../../services/employeeService";
import { Btn, PageHeader, Stat } from "./primitives";
import { INITIAL_UNITS, NEARBY_TICKETS, type DispatchUnit, type Ticket } from './idle-time/data';

export function IdleTimeMinimization({}: {
  tasks?: Task[];
  employees?: Employee[];
  departmentId?: string;
}) {
  const [units, setUnits] = useState<DispatchUnit[]>(INITIAL_UNITS);
  const [log, setLog] = useState<{ at: string; message: string }[]>([
    {
      at: "14:02",
      message: "Plumbing Crew 4 marked idle — Public Market repair closed.",
    },
    {
      at: "13:50",
      message: "Survey Team B marked idle — drainage profile completed.",
    },
  ]);
  const [pinging, setPinging] = useState<string | null>(null);

  const dispatch = (unitId: string, ticket: Ticket) => {
    setPinging(unitId);
    setTimeout(() => {
      setUnits(
        units.map((u) =>
          u.id === unitId
            ? { ...u, status: "enroute", newTask: `→ ${ticket.title}` }
            : u,
        ),
      );
      const now = new Date();
      const stamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setLog([
        {
          at: stamp,
          message: `GA dispatched ${units.find((u) => u.id === unitId)?.name} → "${ticket.title}" (proximity 0.${Math.floor(Math.random() * 9) + 1}km).`,
        },
        ...log,
      ]);
      setPinging(null);
    }, 900);
  };

  const autoDispatchAll = () => {
    const idle = units.filter((u) => u.status === "idle");
    idle.forEach((u, i) =>
      setTimeout(
        () => dispatch(u.id, NEARBY_TICKETS[i % NEARBY_TICKETS.length]),
        i * 600,
      ),
    );
  };

  const idleCount = units.filter((u) => u.status === "idle").length;
  const statusStyle: Record<
    string,
    { color: string; pulse: string; label: string }
  > = {
    idle: { color: "#f59e0b", pulse: "animate-pulse", label: "IDLE" },
    active: { color: "#10b981", pulse: "", label: "ACTIVE" },
    enroute: { color: "#6366f1", pulse: "animate-pulse", label: "EN ROUTE" },
  };

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Dynamic Dispatch · Idle Time Minimization"
        subtitle="Uber-style GA routing · 1km proximity radius · live GPS feed"
        actions={
          <>
            <Btn icon={<Radio size={13} />} label="Broadcast to All Crews" />
            <Btn
              icon={<Zap size={13} />}
              label="Auto-Dispatch Idle"
              variant="primary"
              onClick={autoDispatchAll}
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Live Units"
          value={units.length.toString()}
          trend="Tracked via mobile GPS"
          tone="neutral"
        />
        <Stat
          label="Idle Now"
          value={idleCount.toString()}
          trend="Awaiting proximity task"
          tone={idleCount ? "warn" : "good"}
        />
        <Stat
          label="En Route"
          value={units.filter((u) => u.status === "enroute").length.toString()}
          trend="GA-dispatched today"
          tone="good"
        />
        <Stat
          label="Idle Time Saved"
          value="4.2h"
          trend="Recovered this afternoon"
          tone="good"
        />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Navigation size={14} className="text-neutral-900" />
            <div className="text-[12.5px] font-medium text-neutral-900">
              Ormoc City · Live Dispatch Map
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-normal text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{" "}
                Idle
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> En Route
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />{" "}
                Ticket
              </span>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-emerald-50 via-blue-50 to-amber-50 border border-neutral-200 rounded-lg h-[420px] overflow-hidden">
            {/* Map grid */}
            <svg
              className="absolute inset-0 w-full h-full opacity-30"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <line
                  key={"h" + i}
                  x1="0"
                  y1={i * 10}
                  x2="100"
                  y2={i * 10}
                  stroke="#94a3b8"
                  strokeWidth="0.1"
                />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <line
                  key={"v" + i}
                  x1={i * 10}
                  y1="0"
                  x2={i * 10}
                  y2="100"
                  stroke="#94a3b8"
                  strokeWidth="0.1"
                />
              ))}
              {/* Faux roads */}
              <path
                d="M0,45 Q30,40 55,48 T100,42"
                stroke="#64748b"
                strokeWidth="0.6"
                fill="none"
                opacity="0.5"
              />
              <path
                d="M50,0 L48,100"
                stroke="#64748b"
                strokeWidth="0.6"
                fill="none"
                opacity="0.5"
              />
              <path
                d="M0,70 L100,68"
                stroke="#64748b"
                strokeWidth="0.6"
                fill="none"
                opacity="0.5"
              />
            </svg>

            {/* Tickets */}
            {NEARBY_TICKETS.map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
              >
                <div
                  className="w-2 h-2 rounded-full bg-neutral-500 border border-white shadow"
                  title={t.title}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-normal text-neutral-700 bg-white/80 border border-neutral-200 rounded px-1 py-0.5 whitespace-nowrap">
                  {t.title}
                </div>
              </div>
            ))}

            {/* Units */}
            {units.map((u) => {
              const s = statusStyle[u.status];
              return (
                <div
                  key={u.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${u.x}%`, top: `${u.y}%` }}
                >
                  {u.status === "idle" && u.radiusKm && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-amber-400 animate-pulse"
                      style={{
                        width: `${u.radiusKm * 60}px`,
                        height: `${u.radiusKm * 60}px`,
                        left: "50%",
                        top: "50%",
                      }}
                    />
                  )}
                  {pinging === u.id && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-500 animate-ping"
                      style={{
                        width: "40px",
                        height: "40px",
                        left: "50%",
                        top: "50%",
                      }}
                    />
                  )}
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md ${s.pulse}`}
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[9.5px] font-medium text-neutral-900 bg-white/95 border border-neutral-200 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm">
                    {u.name}
                    <span
                      className="ml-1 text-[8px] font-normal"
                      style={{ color: s.color }}
                    >
                      · {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-3">
              Idle Crews · Instant Dispatch
            </div>
            {units.filter((u) => u.status === "idle").length === 0 ? (
              <div className="text-center text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <CheckCircle2 size={18} className="mx-auto mb-1.5" />
                All crews deployed. Zero idle time.
              </div>
            ) : (
              <div className="space-y-2">
                {units
                  .filter((u) => u.status === "idle")
                  .map((u) => (
                    <div
                      key={u.id}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Timer size={12} className="text-amber-700" />
                        <div className="text-[12px] font-medium text-neutral-900">
                          {u.name}
                        </div>
                        <span className="ml-auto text-[9px] font-medium uppercase bg-amber-500 text-white rounded px-1.5 py-0.5 animate-pulse">
                          Idle
                        </span>
                      </div>
                      <div className="text-[10px] font-normal text-neutral-600 mb-2">
                        {u.lastTask}
                      </div>
                      <div className="space-y-1">
                        {NEARBY_TICKETS.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => dispatch(u.id, t)}
                            className="w-full flex items-center gap-2 p-1.5 bg-white border border-neutral-200 rounded hover:border-indigo-400 text-left"
                          >
                            <Route size={10} className="text-indigo-600" />
                            <div className="text-[10.5px] font-normal text-neutral-700 truncate flex-1">
                              {t.title}
                            </div>
                            <ArrowRight
                              size={10}
                              className="text-neutral-400"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-950 rounded-xl p-4 text-neutral-100">
            <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-400 uppercase tracking-wider mb-3">
              <Radio size={12} /> Dispatch Feed
            </div>
            <div className="space-y-2 font-mono text-[10.5px] max-h-[180px] overflow-y-auto">
              {log.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-neutral-500 tabular-nums shrink-0">
                    {l.at}
                  </span>
                  <span className="text-neutral-200">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 18.1.A — REAL-TIME SPEND TRACKING ====================
