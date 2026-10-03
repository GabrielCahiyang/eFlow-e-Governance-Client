import { useState } from "react";
import type { Employee } from "../../../services/employeeService";
import { createTaskTemplate } from "../services/taskTemplateService";
import { useToast } from "../../../components/ui/Toast";

export function RecurringTemplateForm({
  employees,
  orgId,
  onCreated,
}: {
  employees: Employee[];
  orgId?: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [interval, setInterval] = useState(1);
  const [nextRun, setNextRun] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!orgId) {
      toast("Your account must be assigned to a office before creating recurring work.", "error");
      return;
    }
    if (!title.trim() || !nextRun) {
      toast("Template title and first run are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await createTaskTemplate({
        title: title.trim(),
        description: description.trim(),
        priority: "medium",
        tags: [],
        acceptanceCriteria: criteria.split("\n").map((item) => item.trim()).filter(Boolean),
        orgId,
        assigneeId: assigneeId || undefined,
        reviewerId: reviewerId || undefined,
        recurrenceRule: { frequency, interval },
        nextRunAt: new Date(nextRun).getTime(),
        isActive: true,
      });
      setTitle("");
      setDescription("");
      setCriteria("");
      setNextRun("");
      setAssigneeId("");
      setReviewerId("");
      toast("Recurring template created.", "success");
      onCreated();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to create template.", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] outline-none focus:border-neutral-400";

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">New recurring template</div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Template title" className={`${inputClass} w-full`} />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Description" className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] outline-none focus:border-neutral-400" />
      <textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} rows={2} placeholder="Acceptance criteria, one per line" className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] outline-none focus:border-neutral-400" />
      <div className="grid grid-cols-3 gap-2">
        <select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)} className={inputClass}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
        </select>
        <input type="number" min={1} value={interval} onChange={(event) => setInterval(Math.max(1, Number(event.target.value)))} className={inputClass} title="Repeat interval" />
        <input type="datetime-local" value={nextRun} onChange={(event) => setNextRun(event.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}>
          <option value="">Assign when created</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
        <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className={inputClass}>
          <option value="">Office reviewer</option>
          {employees.filter((employee) => employee.id !== assigneeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
      </div>
      <button onClick={save} disabled={saving} className="w-full rounded-lg bg-neutral-900 py-2 text-[12px] font-medium text-white disabled:opacity-50">
        {saving ? "Saving…" : "Create template"}
      </button>
    </div>
  );
}
