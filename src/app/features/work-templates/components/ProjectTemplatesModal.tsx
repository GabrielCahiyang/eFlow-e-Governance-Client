import { CalendarClock, ClipboardList, X } from "lucide-react";
import { useState } from "react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { Employee } from "../../members";
import { RecurringTaskTemplatesPanel, type Task } from "../../tasks";
import { SubtaskTemplateLibrary } from "./SubtaskTemplateLibrary";

type TemplateTab = "subtasks" | "recurring";

export function ProjectTemplatesModal({
  open,
  onClose,
  orgId,
  currentUserId,
  canManageDepartment,
  leadingTasks,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  currentUserId: string;
  canManageDepartment: boolean;
  leadingTasks: Task[];
  employees: Employee[];
}) {
  const [tab, setTab] = useState<TemplateTab>("subtasks");
  if (!open) return null;

  return (
    <FeatureDialog open={open} onClose={onClose} title="Reusable work library" description="Standardize recurring tasks and repeatable Team Leader checklists." contentClassName="!h-[88vh] !max-w-6xl max-sm:!h-[100dvh]" showCloseButton={false}>
      <div className="flex h-full w-full flex-col bg-neutral-50">
        <div className="flex items-start justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">Projects · Templates</div>
            <h2 className="mt-0.5 text-[18px] font-semibold text-neutral-900">Reusable work library</h2>
            <p className="mt-1 text-[11.5px] text-neutral-500">Standardize recurring tasks and repeatable Team Leader checklists without hiding the human review flow.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X size={17} /></button>
        </div>
        <div className="border-b border-neutral-200 bg-white px-5">
          <div className="flex gap-5">
            <button onClick={() => setTab("subtasks")} className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-[11.5px] font-medium ${tab === "subtasks" ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}><ClipboardList size={13} /> Subtask Templates</button>
            <button onClick={() => setTab("recurring")} className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-[11.5px] font-medium ${tab === "recurring" ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}><CalendarClock size={13} /> Recurring Tasks</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === "subtasks" ? (
            <SubtaskTemplateLibrary orgId={orgId} currentUserId={currentUserId} canManageDepartment={canManageDepartment} leadingTasks={leadingTasks} employees={employees} />
          ) : (
            <RecurringTaskTemplatesPanel employees={employees} orgId={orgId} />
          )}
        </div>
      </div>
    </FeatureDialog>
  );
}
