import { useState } from "react";
import { HardHat, Plus, Sparkles, Star, UserPlus, Users, Zap } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";

export type RosterMember = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  workloadPct: number;
  rating: number;
};

export const ROSTER: RosterMember[] = [
  {
    id: "e1",
    name: "Engr. Mario Santos",
    role: "Civil Engineer III",
    skills: ["Structural", "Concrete"],
    workloadPct: 62,
    rating: 4.8,
  },
  {
    id: "e2",
    name: "Engr. Lea Villegas",
    role: "Civil Engineer II",
    skills: ["Drainage", "Survey"],
    workloadPct: 48,
    rating: 4.6,
  },
  {
    id: "e3",
    name: "Engr. Rafael Tambago",
    role: "Civil Engineer II",
    skills: ["Structural", "Welding"],
    workloadPct: 85,
    rating: 4.4,
  },
  {
    id: "e4",
    name: "Engr. Rolando Dacayo",
    role: "Dept. Head",
    skills: ["PM", "Contracts"],
    workloadPct: 92,
    rating: 4.9,
  },
  {
    id: "e5",
    name: "Mr. Arnel Padojinog",
    role: "Foreman",
    skills: ["Concrete", "Labor"],
    workloadPct: 55,
    rating: 4.5,
  },
  {
    id: "e6",
    name: "Mr. Danilo Escario",
    role: "Heavy Equip. Operator",
    skills: ["Operator", "Mechanical"],
    workloadPct: 38,
    rating: 4.7,
  },
  {
    id: "e7",
    name: "Ms. Cherry Lumapas",
    role: "Site Engineer",
    skills: ["QA/QC", "Survey"],
    workloadPct: 71,
    rating: 4.6,
  },
  {
    id: "e8",
    name: "Mr. Jonathan Pial",
    role: "Laborer Team Lead",
    skills: ["Labor", "Concrete"],
    workloadPct: 44,
    rating: 4.3,
  },
  {
    id: "e9",
    name: "Engr. Rosario Villamor",
    role: "Electrical Engineer",
    skills: ["Electrical", "ICT"],
    workloadPct: 58,
    rating: 4.8,
  },
  {
    id: "e10",
    name: "Mr. Jose Tumagsang",
    role: "Welder",
    skills: ["Welding", "Fabrication"],
    workloadPct: 35,
    rating: 4.5,
  },
];

export function TeamAssignments() {
  const [roster, setRoster] = useState<RosterMember[]>(ROSTER);
  const [team, setTeam] = useState<RosterMember[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  const moveToTeam = (emp: RosterMember) => {
    if (team.find((t) => t.id === emp.id)) return;
    setTeam([...team, emp]);
    setRoster(roster.filter((r) => r.id !== emp.id));
  };
  const moveToRoster = (emp: RosterMember) => {
    setRoster([...roster, emp]);
    setTeam(team.filter((t) => t.id !== emp.id));
  };

  const autoFill = () => {
    setAutoFilling(true);
    setTimeout(() => {
      // GA picks 5 best available: prioritize low workload + high rating + has "Concrete" skill
      const scored = [...roster].sort((a, b) => {
        const aScore =
          (a.skills.includes("Concrete") ? 20 : 0) +
          (100 - a.workloadPct) * 0.6 +
          a.rating * 10;
        const bScore =
          (b.skills.includes("Concrete") ? 20 : 0) +
          (100 - b.workloadPct) * 0.6 +
          b.rating * 10;
        return bScore - aScore;
      });
      const picks = scored.slice(0, 5);
      setTeam([...team, ...picks]);
      setRoster(roster.filter((r) => !picks.find((p) => p.id === r.id)));
      setAutoFilling(false);
    }, 1400);
  };

  const workloadTone = (w: number) =>
    w >= 85
      ? "text-red-600 bg-red-50"
      : w >= 70
        ? "text-amber-600 bg-amber-50"
        : "text-emerald-700 bg-emerald-50";

  const EmpCard = ({
    emp,
    onClick,
    inTeam,
  }: {
    emp: RosterMember;
    onClick: (e: RosterMember) => void;
    inTeam?: boolean;
  }) => (
    <div
      draggable
      onDragStart={() => setDragId(emp.id)}
      onDragEnd={() => setDragId(null)}
      className={`bg-white border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition ${dragId === emp.id ? "opacity-40" : ""} ${inTeam ? "border-emerald-300" : "border-neutral-200"}`}
      onClick={() => onClick(emp)}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-[10px] font-semibold text-neutral-700 shrink-0">
          {emp.name
            .split(" ")
            .slice(-2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-neutral-900 truncate">
            {emp.name}
          </div>
          <div className="text-[10.5px] font-normal text-neutral-500 truncate">
            {emp.role}
          </div>
        </div>
        <div className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 shrink-0">
          <Star size={10} className="fill-amber-500 stroke-amber-500" />{" "}
          {emp.rating}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {emp.skills.map((s) => (
          <span
            key={s}
            className="text-[9px] font-medium uppercase bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5"
          >
            {s}
          </span>
        ))}
        <span
          className={`ml-auto text-[9.5px] font-medium rounded px-1.5 py-0.5 tabular-nums ${workloadTone(emp.workloadPct)}`}
        >
          {emp.workloadPct}% load
        </span>
      </div>
    </div>
  );

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Resource Deployment · Eco-Park Task Force"
        subtitle="Drag-and-drop roster · Genetic Algorithm available"
        actions={
          <>
            <Btn icon={<Plus size={13} />} label="New Task Force" />
            <button
              onClick={autoFill}
              disabled={autoFilling}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90"
            >
              {autoFilling ? (
                <Zap size={13} className="animate-pulse" />
              ) : (
                <Sparkles size={13} />
              )}
              {autoFilling ? "Solving…" : "Auto-Fill Team (GA)"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Roster Pool"
          value={roster.length.toString()}
          trend="Available engineers & laborers"
          tone="neutral"
        />
        <Stat
          label="Team Size"
          value={team.length.toString()}
          trend="Target: 5–8"
          tone={team.length >= 5 && team.length <= 8 ? "good" : "warn"}
        />
        <Stat
          label="Avg. Team Load"
          value={
            team.length
              ? `${Math.round(team.reduce((s, t) => s + t.workloadPct, 0) / team.length)}%`
              : "—"
          }
          trend="After deployment"
          tone="neutral"
        />
        <Stat
          label="Skill Coverage"
          value={`${new Set(team.flatMap((t) => t.skills)).size}`}
          trend="Unique skills in team"
          tone="good"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          className="bg-neutral-50 border border-neutral-200 rounded-xl p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            const emp = team.find((t) => t.id === dragId);
            if (emp) moveToRoster(emp);
            setDragId(null);
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-neutral-900" />
            <div className="text-[13px] font-medium text-neutral-900">
              Office Roster
            </div>
            <div className="ml-auto text-[10.5px] font-normal text-neutral-500">
              {roster.length} available
            </div>
          </div>
          <div className="space-y-2 min-h-[300px]">
            {roster.map((e) => (
              <EmpCard key={e.id} emp={e} onClick={moveToTeam} />
            ))}
            {roster.length === 0 && (
              <div className="text-center text-[11.5px] text-neutral-400 py-8">
                Roster exhausted
              </div>
            )}
          </div>
        </div>

        <div
          className={`bg-emerald-50/40 border-2 border-dashed rounded-xl p-4 ${dragId ? "border-emerald-500 bg-emerald-50" : "border-emerald-200"}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            const emp = roster.find((r) => r.id === dragId);
            if (emp) moveToTeam(emp);
            setDragId(null);
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <HardHat size={14} className="text-emerald-700" />
            <div className="text-[13px] font-medium text-neutral-900">
              Eco-Park Task Force
            </div>
            <div className="ml-auto text-[10.5px] font-normal text-emerald-700">
              {team.length} deployed
            </div>
          </div>
          <div className="space-y-2 min-h-[300px]">
            {team.map((e) => (
              <EmpCard key={e.id} emp={e} onClick={moveToRoster} inTeam />
            ))}
            {team.length === 0 && (
              <div className="text-center text-[11.5px] text-neutral-400 py-16 border-2 border-dashed border-emerald-200 rounded-lg">
                <UserPlus size={24} className="mx-auto mb-2 opacity-40" />
                Drag members here or click Auto-Fill (GA)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <Sparkles size={14} className="text-indigo-600 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-indigo-900 leading-relaxed">
          <span className="font-medium">
            GA safeguard.
          </span>{" "}
          Auto-Fill optimizes for lowest current workload × matching skills ×
          performance rating. Prevents the classic Dept. Head habit of
          repeatedly drafting the same favorite staff into every task force
          until they burn out.
        </div>
      </div>
    </div>
  );
}

// ==================== 15.2.B — LEADER ASSIGNMENTS ====================
