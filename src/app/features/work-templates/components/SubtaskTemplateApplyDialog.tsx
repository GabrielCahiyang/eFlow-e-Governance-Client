import { AlertTriangle, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { Employee } from "../../members";
import { fetchTaskSubtasks, type Subtask } from "../../subtasks";
import { startTaskIfTodo, type Task } from "../../tasks";
import { useToast } from "../../../components/ui/Toast";
import { getSubtaskReplacementBlocker } from "../selectors";
import { applySubtaskTemplate } from "../services/subtaskTemplateService";
import type {
  AppliedSubtaskTemplateItem,
  SubtaskTemplate,
  SubtaskTemplateApplyMode,
} from "../types";

export function SubtaskTemplateApplyDialog({
  template,
  tasks,
  employees,
  onClose,
}: {
  template: SubtaskTemplate;
  tasks: Task[];
  employees: Employee[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [taskId, setTaskId] = useState(tasks[0]?.id || "");
  const [mode, setMode] = useState<SubtaskTemplateApplyMode>("merge");
  const [items, setItems] = useState<AppliedSubtaskTemplateItem[]>(
    template.items.map((item) => ({ title: item.title, assignedToIds: [] })),
  );
  const [existing, setExisting] = useState<Subtask[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!taskId) { setExisting([]); return; }
    setLoadingExisting(true);
    fetchTaskSubtasks(taskId)
      .then((rows) => { if (!cancelled) setExisting(rows); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not inspect existing subtasks."); })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const replacementBlocker = useMemo(
    () => getSubtaskReplacementBlocker(existing),
    [existing],
  );
  const selectedTask = tasks.find((task) => task.id === taskId);

  const apply = async () => {
    const normalizedItems = items
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title);
    if (!taskId) { setError("Select a task you lead."); return; }
    if (normalizedItems.length === 0) { setError("Keep at least one checklist item."); return; }
    if (mode === "replace" && replacementBlocker) { setError(replacementBlocker); return; }
    setSaving(true);
    setError("");
    try {
      const result = await applySubtaskTemplate({
        templateId: template.id,
        taskId,
        mode,
        items: normalizedItems,
      });
      await startTaskIfTodo(taskId);
      toast(
        `Applied ${result.created} subtask${result.created === 1 ? "" : "s"}${result.skipped ? ` · ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped` : ""}.`,
        "success",
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The template could not be applied.");
      setSaving(false);
    }
  };

  return (
    <FeatureDialog onClose={onClose} title={`Apply ${template.title}`} description="Preview the checklist, assign contributors, and choose how it should interact with existing subtasks." contentClassName="!h-[92vh] !max-w-4xl max-sm:!h-[100dvh]" showCloseButton={false}>
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-violet-500">Apply subtask template</div>
            <h3 className="mt-0.5 text-[17px] font-semibold text-neutral-900">{template.title}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">Preview the checklist, assign contributors, and choose how it should interact with existing subtasks.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
        </div>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 border-b border-neutral-100 bg-neutral-50 p-4 lg:border-b-0 lg:border-r">
            <label className="block text-[10.5px] font-medium text-neutral-500">Task you lead
              <select value={taskId} onChange={(event) => { setTaskId(event.target.value); setError(""); }} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-2.5 text-[11.5px] outline-none">
                {tasks.length === 0 && <option value="">No eligible leading tasks</option>}
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>

            <div>
              <div className="text-[10.5px] font-medium text-neutral-500">Apply mode</div>
              <label className={`mt-2 block cursor-pointer rounded-xl border p-3 ${mode === "merge" ? "border-violet-300 bg-violet-50" : "border-neutral-200 bg-white"}`}>
                <input type="radio" name="apply-mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} className="mr-2 accent-violet-600" />
                <span className="text-[12px] font-medium text-neutral-800">Merge</span>
                <p className="ml-5 mt-1 text-[10.5px] text-neutral-500">Keep existing subtasks. Exact duplicate titles are skipped.</p>
              </label>
              <label className={`mt-2 block cursor-pointer rounded-xl border p-3 ${mode === "replace" ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
                <input type="radio" name="apply-mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} className="mr-2 accent-amber-600" />
                <span className="text-[12px] font-medium text-neutral-800">Replace existing</span>
                <p className="ml-5 mt-1 text-[10.5px] text-neutral-500">Remove untouched subtasks and replace them with this checklist.</p>
              </label>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="text-[10.5px] font-medium text-neutral-700">Current task checklist</div>
              {loadingExisting ? (
                <div className="mt-2 text-[10.5px] text-neutral-400">Checking existing subtasks…</div>
              ) : existing.length === 0 ? (
                <div className="mt-2 text-[10.5px] text-neutral-400">No existing subtasks.</div>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {existing.slice(0, 6).map((subtask) => (
                    <div key={subtask.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="truncate text-neutral-600">{subtask.title}</span>
                      <span className="shrink-0 text-neutral-400">{subtask.percentComplete}%</span>
                    </div>
                  ))}
                  {existing.length > 6 && <div className="text-[10px] text-neutral-400">+{existing.length - 6} more</div>}
                </div>
              )}
            </div>

            {mode === "replace" && replacementBlocker && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
                <div className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{replacementBlocker}</span></div>
              </div>
            )}
          </aside>

          <main className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Checklist preview</div>
                <div className="mt-0.5 text-[10.5px] text-neutral-400">Edit titles and assign one or more office members before applying.</div>
              </div>
              <button onClick={() => setItems((current) => [...current, { title: "", assignedToIds: [] }])} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] text-neutral-600 hover:bg-neutral-50"><Plus size={11} /> Add</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] text-neutral-500">{index + 1}</span>
                  <input value={item.title} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry))} className="h-9 flex-1 rounded-lg border border-neutral-200 px-2.5 text-[12px] outline-none focus:border-neutral-400" />
                  <button disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
                  {item.assignedToIds.map((id) => {
                    const employee = employees.find((candidate) => candidate.id === id);
                    return employee ? (
                      <button key={id} onClick={() => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, assignedToIds: entry.assignedToIds.filter((assignedId) => assignedId !== id) } : entry))} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] text-violet-700" title="Remove assignment">{employee.name}<X size={9} /></button>
                    ) : null;
                  })}
                  <label className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2 py-1 text-[10px] text-neutral-500">
                    <UserPlus size={10} /> Assign
                    <select value="" onChange={(event) => {
                      const id = event.target.value;
                      if (!id) return;
                      setItems((current) => current.map((entry, itemIndex) => itemIndex === index && !entry.assignedToIds.includes(id) ? { ...entry, assignedToIds: [...entry.assignedToIds, id] } : entry));
                    }} className="max-w-[120px] bg-transparent outline-none">
                      <option value="">Choose…</option>
                      {employees.filter((employee) => !item.assignedToIds.includes(employee.id)).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</div>}
          </main>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
          <div className="min-w-0 text-[10.5px] text-neutral-400">{selectedTask ? `Applying to “${selectedTask.title}”` : "Select an eligible task"}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2 text-[12px] text-neutral-600 hover:bg-neutral-50">Cancel</button>
            <button onClick={apply} disabled={saving || !taskId || loadingExisting || (mode === "replace" && Boolean(replacementBlocker))} className="rounded-xl bg-neutral-900 px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">{saving ? "Applying…" : `Apply ${items.filter((item) => item.title.trim()).length} subtasks`}</button>
          </div>
        </div>
      </div>
    </FeatureDialog>
  );
}
