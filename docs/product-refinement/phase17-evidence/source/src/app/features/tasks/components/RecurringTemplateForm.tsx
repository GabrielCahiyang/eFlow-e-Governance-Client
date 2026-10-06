import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { useReviewedMutation } from "../../../shared/useReviewedMutation";
import { FeedbackState } from "../../../components/ui/FeedbackState";
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
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [interval, setInterval] = useState(1);
  const [nextRun, setNextRun] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const safety = useReviewedMutation(`${orgId || ""}:new-recurring-template`);
  const saving = safety.pending;
  const [baseline, setBaseline] = useState({
    frequency: "weekly",
    interval: 1,
  });
  const reset = () => {
    setTitle("");
    setDescription("");
    setCriteria("");
    setNextRun("");
    setAssigneeId("");
    setReviewerId("");
    setFrequency(baseline.frequency as typeof frequency);
    setInterval(baseline.interval);
  };
  const guard = useExplicitDraft(
    "Recurring task template",
    Boolean(
      title ||
        description ||
        criteria ||
        nextRun ||
        assigneeId ||
        reviewerId ||
        frequency !== baseline.frequency ||
        interval !== baseline.interval,
    ),
    saving,
    reset,
    orgId,
  );

  const save = async () => {
    if (!orgId) {
      toast(
        "Your account must be assigned to a office before creating recurring work.",
        "error",
      );
      return;
    }
    if (!title.trim() || !nextRun) {
      toast("Template title and first run are required.", "error");
      return;
    }
    const nextRunAt = new Date(nextRun).getTime();
    if (
      !Number.isFinite(nextRunAt) ||
      !Number.isFinite(interval) ||
      interval < 1 ||
      !Number.isInteger(interval)
    ) {
      toast(
        "Enter a valid first run and a whole-number repeat interval.",
        "error",
      );
      return;
    }
    if (assigneeId && reviewerId === assigneeId) {
      toast("The task owner cannot also review the recurring task.", "error");
      return;
    }
    await safety.run({
      key: "create",
      allowRepeatAfterRefresh: true,
      operation: () =>
        createTaskTemplate({
          title: title.trim(),
          description: description.trim(),
          priority: "medium",
          tags: [],
          acceptanceCriteria: criteria
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          orgId,
          assigneeId: assigneeId || undefined,
          reviewerId: reviewerId || undefined,
          recurrenceRule: { frequency, interval },
          nextRunAt,
          isActive: true,
        }),
      success: "Recurring template created.",
      onSaved: () => {
        setBaseline({ frequency, interval });
        reset();
        setFrequency(frequency);
        setInterval(interval);
        guard.markClean();
      },
      refresh: async () => {
        await onCreated();
      },
    });
  };

  const inputClass =
    "h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] outline-none focus:border-neutral-400";

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      {safety.dialog}
      {safety.message && (
        <FeedbackState tone={safety.tone} title="Template result">
          <p>{safety.message}</p>
        </FeedbackState>
      )}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        New recurring template
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Template title"
        placeholder="Template title"
        className={`${inputClass} w-full`}
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
        placeholder="Description"
        className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] outline-none focus:border-neutral-400"
      />
      <textarea
        value={criteria}
        onChange={(event) => setCriteria(event.target.value)}
        rows={2}
        placeholder="Acceptance criteria, one per line"
        className="w-full resize-none rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] outline-none focus:border-neutral-400"
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as typeof frequency)
          }
          className={inputClass}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <input
          type="number"
          min={1}
          value={interval}
          onChange={(event) =>
            setInterval(Math.max(1, Number(event.target.value)))
          }
          className={inputClass}
          title="Repeat interval"
        />
        <input
          aria-label="First scheduled run"
          type="datetime-local"
          value={nextRun}
          onChange={(event) => setNextRun(event.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          className={inputClass}
        >
          <option value="">Assign when created</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <select
          value={reviewerId}
          onChange={(event) => setReviewerId(event.target.value)}
          className={inputClass}
        >
          <option value="">Office reviewer</option>
          {employees
            .filter((employee) => employee.id !== assigneeId)
            .map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
        </select>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-neutral-900 py-2 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Create template"}
      </button>
    </div>
  );
}
