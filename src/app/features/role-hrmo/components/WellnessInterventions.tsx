import { useState } from "react";
import { Brain, Calendar, Heart, Pause, Plus, Search } from "lucide-react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { Btn, PageHeader } from "./primitives";

type KColumn = "flagged" | "active" | "monitoring" | "resolved";
type KCard = {
  id: string;
  name: string;
  role: string;
  dept: string;
  reason: string;
  col: KColumn;
  daysIn: number;
};

const INITIAL_CARDS: KCard[] = [
  { id: "k1", name: "Engr. J. Dela Cruz", role: "Civil Engineer", dept: "Engineering", reason: "Latency ↓ 40%", col: "flagged", daysIn: 0 },
  { id: "k2", name: "Arch. P. Odal", role: "City Planner", dept: "Planning", reason: "20w no low-load", col: "flagged", daysIn: 0 },
  { id: "k3", name: "Dr. M. Sabando", role: "Health Officer", dept: "Health", reason: "Post-incident burnout", col: "active", daysIn: 2 },
  { id: "k4", name: "L. Bascon", role: "LEDIPO Coord.", dept: "LEDIPO", reason: "Negative sentiment 6d", col: "active", daysIn: 1 },
  { id: "k5", name: "C. Villamor", role: "Treasury Analyst", dept: "Treasury", reason: "No breaks 9d", col: "monitoring", daysIn: 5 },
  { id: "k6", name: "F. Lariosa", role: "Legal Counsel", dept: "Legal", reason: "Overtime spike", col: "monitoring", daysIn: 7 },
  { id: "k7", name: "J. Pomentil", role: "Social Worker", dept: "Social Welfare", reason: "Field fatigue", col: "resolved", daysIn: 14 },
  { id: "k8", name: "R. Alcantara", role: "CENRO Inspector", dept: "Environment", reason: "11 visits / day", col: "resolved", daysIn: 21 },
];

const COLS: { id: KColumn; label: string; tint: string; chip: string }[] = [
  { id: "flagged", label: "Flagged (Review)", tint: "bg-red-50", chip: "bg-red-100 text-red-700" },
  { id: "active", label: "Intervention Active", tint: "bg-amber-50", chip: "bg-amber-100 text-amber-700" },
  { id: "monitoring", label: "Monitoring", tint: "bg-blue-50", chip: "bg-blue-100 text-blue-700" },
  { id: "resolved", label: "Resolved", tint: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700" },
];

export function WellnessInterventions() {
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ card: KCard; target: KColumn } | null>(null);

  function onDrop(target: KColumn) {
    if (!draggedId) return;
    const card = cards.find((c) => c.id === draggedId);
    if (!card || card.col === target) {
      setDraggedId(null);
      return;
    }
    if (target === "active") {
      setModal({ card, target });
    } else {
      setCards((cs) => cs.map((c) => (c.id === draggedId ? { ...c, col: target, daysIn: 0 } : c)));
    }
    setDraggedId(null);
  }

  function commitIntervention(type: string) {
    if (!modal) return;
    setCards((cs) => cs.map((c) => (c.id === modal.card.id ? { ...c, col: modal.target, daysIn: 0, reason: `${c.reason} · ${type}` } : c)));
    setModal(null);
  }

  return (
    <div>
      <PageHeader
        title="Active Intervention Workflows"
        subtitle="Drag cards between stages · the GA Load Balancer reacts in real-time"
        actions={
          <>
            <Btn icon={<Search size={14} />} label="Filter: All Departments" />
            <Btn icon={<Plus size={14} />} label="New Flag" variant="primary" />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        {COLS.map((col) => {
          const items = cards.filter((c) => c.col === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.id)}
              className={`${col.tint} rounded-xl p-3 min-h-[520px]`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${col.chip}`}>
                    {items.length}
                  </span>
                  <span className="text-[12px] font-medium text-neutral-700">{col.label}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggedId(c.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`bg-white rounded-lg border border-neutral-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                      draggedId === c.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="text-[12px] font-medium text-neutral-900">{c.name}</div>
                    <div className="text-[10px] font-normal text-neutral-500 mt-0.5">
                      {c.role} · {c.dept}
                    </div>
                    <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-[10px] font-normal text-neutral-600">{c.reason}</span>
                      <span className="text-[10px] font-normal text-neutral-400">{c.daysIn}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <FeatureDialog onClose={() => setModal(null)} title="Activate Intervention" description={`Select a response for ${modal.card.name}.`} contentClassName="!max-w-lg">
          <div className="w-full p-6 pr-12">
            <div className="flex items-center gap-2 mb-2">
              <Heart size={16} className="text-red-600" />
              <h3 className="text-[16px] font-semibold">Activate Intervention</h3>
            </div>
            <p className="text-[13px] font-normal text-neutral-600 mb-4">
              Select a response for <span className="font-medium text-neutral-900">{modal.card.name}</span>. The BPA engine will dispatch automatically.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => commitIntervention("30% reassign")}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Pause size={13} className="text-neutral-700" />
                  <span className="text-[13px] font-medium">Auto-Reassign 30% Workload</span>
                </div>
                <div className="text-[11px] font-normal text-neutral-500">
                  Signals the GA Load Balancer · redistributes complex tasks to matched peers.
                </div>
              </button>
              <button
                onClick={() => commitIntervention("2d paid leave")}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={13} className="text-neutral-700" />
                  <span className="text-[13px] font-medium">Mandate 2-Day Paid Wellness Leave</span>
                </div>
                <div className="text-[11px] font-normal text-neutral-500">
                  Overrides schedule · pauses all pending deadlines · notifies team lead.
                </div>
              </button>
              <button
                onClick={() => commitIntervention("1:1 debriefing")}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={13} className="text-neutral-700" />
                  <span className="text-[13px] font-medium">Schedule 1:1 Counselor Debriefing</span>
                </div>
                <div className="text-[11px] font-normal text-neutral-500">
                  Books next available slot with LGU-accredited psychologist.
                </div>
              </button>
            </div>
          </div>
        </FeatureDialog>
      )}
    </div>
  );
}

// ==================== 10.1.C — STRESS DEBRIEFING ====================
