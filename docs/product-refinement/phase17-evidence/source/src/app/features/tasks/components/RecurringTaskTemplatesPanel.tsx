import { useReviewedMutation } from "../../../shared/useReviewedMutation";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import type { Employee } from "../../../services/employeeService";
import { useToast } from "../../../components/ui/Toast";
import {
  deleteTaskTemplate,
  fetchTaskTemplates,
  setTaskTemplateActive,
} from "../services/taskTemplateService";
import type { TaskTemplate } from "../types";
import { RecurringTemplateForm } from "./RecurringTemplateForm";

export function RecurringTaskTemplatesPanel({
  employees,
  orgId,
}: {
  employees: Employee[];
  orgId?: string;
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const safety = useReviewedMutation(orgId || "recurring-templates");

  const load = useCallback(
    async (throwOnError = false) => {
      setLoading(true);
      try {
        setTemplates(await fetchTaskTemplates());
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Failed to load recurring templates.",
          "error",
        );
        if (throwOnError) throw error;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <RecurringTemplateForm
        employees={employees}
        orgId={orgId}
        onCreated={load}
      />
      <div className="space-y-2">
        {safety.dialog}
        {safety.message && (
          <FeedbackState tone={safety.tone} title="Template result">
            <p>{safety.message}</p>
            <button type="button" onClick={() => void load()}>
              Refresh templates
            </button>
          </FeedbackState>
        )}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11.5px] text-blue-800">
          Scheduled templates create whole tasks automatically. Use the Subtask
          Templates tab for reusable checklists applied to existing work.
        </div>
        {loading && (
          <div className="p-6 text-center text-[12px] text-neutral-400">
            Loading scheduled work…
          </div>
        )}
        {!loading && templates.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-neutral-400">
            <CalendarClock size={28} className="mx-auto mb-2 opacity-40" />
            <div className="text-[12px]">No recurring task templates yet.</div>
          </div>
        )}
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-xl border border-neutral-200 bg-white p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-neutral-900">
                  {template.title}
                </div>
                {template.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">
                    {template.description}
                  </p>
                )}
                <div className="mt-2 text-[10.5px] text-neutral-400">
                  Every{" "}
                  {template.recurrenceRule.interval > 1
                    ? `${template.recurrenceRule.interval} `
                    : ""}
                  {template.recurrenceRule.frequency} · next{" "}
                  {new Date(template.nextRunAt).toLocaleString("en-PH")}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${template.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
              >
                {template.isActive ? "Active" : "Paused"}
              </span>
            </div>
            <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
              <button
                disabled={safety.pending}
                onClick={() =>
                  void safety.run({
                    key: `${template.id}:active:${template.isActive}`,
                    allowRepeatAfterRefresh: true,
                    operation: () =>
                      setTaskTemplateActive(template.id, !template.isActive),
                    success: `Template ${template.isActive ? "paused" : "resumed"}.`,
                    refresh: () => load(true),
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] text-neutral-600 hover:bg-neutral-50"
              >
                {template.isActive ? <Pause size={11} /> : <Play size={11} />}
                {template.isActive ? "Pause" : "Resume"}
              </button>
              <button
                disabled={safety.pending}
                onClick={() =>
                  void safety.run({
                    key: `${template.id}:delete`,
                    confirmation: {
                      title: "Delete recurring template?",
                      description: `“${template.title}” will stop creating future tasks. Existing tasks remain.`,
                      danger: true,
                      actionLabel: "Delete template",
                      confirmationText: template.title,
                    },
                    operation: () => deleteTaskTemplate(template.id),
                    success: "Recurring template deleted.",
                    refresh: () => load(true),
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10.5px] text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
