import { useReviewedMutation } from "../../../shared/useReviewedMutation";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  Plus,
  ShieldCheck,
  ShieldX,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Employee } from "../../members";
import type { Task } from "../../tasks";
import { useToast } from "../../../components/ui/Toast";
import {
  deleteSubtaskTemplate,
  fetchSubtaskTemplates,
  reviewSubtaskTemplate,
  saveSubtaskTemplate,
} from "../services/subtaskTemplateService";
import type { SubtaskTemplate, SubtaskTemplateDraft } from "../types";
import { SubtaskTemplateApplyDialog } from "./SubtaskTemplateApplyDialog";
import { SubtaskTemplateEditor } from "./SubtaskTemplateEditor";

export function SubtaskTemplateLibrary({
  orgId,
  currentUserId,
  canManageDepartment,
  leadingTasks,
  employees,
}: {
  orgId: string;
  currentUserId: string;
  canManageDepartment: boolean;
  leadingTasks: Task[];
  employees: Employee[];
}) {
  const { toast } = useToast();
  const safety = useReviewedMutation(`${orgId}:${currentUserId}`);
  const [templates, setTemplates] = useState<SubtaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SubtaskTemplate | "new" | null>(null);
  const [applying, setApplying] = useState<SubtaskTemplate | null>(null);
  const [filter, setFilter] = useState<
    "all" | "personal" | "department" | "pending"
  >("all");

  const load = useCallback(async (throwOnError = false) => {
    setLoading(true);
    setError("");
    try {
      setTemplates(await fetchSubtaskTemplates());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Templates could not be loaded.",
      );
      if (throwOnError) throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      templates.filter((template) => {
        if (filter === "personal") return template.visibility === "personal";
        if (filter === "department")
          return (
            template.visibility === "department" &&
            template.approvalStatus === "approved"
          );
        if (filter === "pending") return template.approvalStatus === "pending";
        return true;
      }),
    [filter, templates],
  );
  const filterOptions: Array<"all" | "personal" | "department" | "pending"> = [
    "all",
    "personal",
    "department",
    ...(canManageDepartment ? (["pending"] as const) : []),
  ];

  const editableDraft =
    editing && editing !== "new"
      ? ({
          id: editing.id,
          title: editing.title,
          description: editing.description,
          visibility: editing.visibility,
          items: editing.items,
        } satisfies SubtaskTemplateDraft)
      : undefined;

  const save = async (draft: SubtaskTemplateDraft) => {
    await saveSubtaskTemplate(orgId, draft);
    setEditing(null);
    await load();
    toast(
      draft.visibility === "department" && !canManageDepartment
        ? "Template submitted for Head approval."
        : "Subtask template saved.",
      "success",
    );
  };

  return (
    <div>
      {safety.dialog}
      {safety.message && (
        <FeedbackState tone={safety.tone} title="Template result">
          <p>{safety.message}</p>
          <button type="button" onClick={() => void load()}>
            Refresh templates
          </button>
        </FeedbackState>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
          {filterOptions.map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-[10.5px] capitalize ${filter === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={!orgId}
          className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-[11.5px] font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          <Plus size={13} /> New subtask template
        </button>
      </div>

      {leadingTasks.length === 0 && !canManageDepartment && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] text-amber-800">
          Templates become available for application when you are assigned as
          Team Lead on an open task.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <div className="p-10 text-center text-[12px] text-neutral-400">
          Loading checklist templates…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          <ClipboardList size={30} className="mx-auto mb-2 opacity-40" />
          <div className="text-[12px]">No templates in this view.</div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const canEdit =
              canManageDepartment || template.ownerId === currentUserId;
            const canApply =
              template.approvalStatus === "approved" && leadingTasks.length > 0;
            return (
              <article
                key={template.id}
                className="flex min-h-[240px] flex-col rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] ${template.visibility === "department" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}
                    >
                      {template.visibility === "department" ? (
                        <Users size={9} />
                      ) : (
                        <ClipboardList size={9} />
                      )}
                      {template.visibility}
                    </span>
                    {template.isStarter && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] text-violet-700">
                        Starter
                      </span>
                    )}
                    {template.approvalStatus === "pending" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] text-amber-700">
                        Pending approval
                      </span>
                    )}
                    {template.approvalStatus === "rejected" && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] text-rose-700">
                        Not approved
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {template.items.length} items
                  </span>
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-neutral-900">
                  {template.title}
                </h3>
                {template.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-500">
                    {template.description}
                  </p>
                )}
                <ol className="mt-3 flex-1 space-y-1.5">
                  {template.items.slice(0, 5).map((item, index) => (
                    <li
                      key={item.id || index}
                      className="flex items-start gap-2 text-[10.5px] text-neutral-600"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[8px] text-neutral-500">
                        {index + 1}
                      </span>
                      <span className="line-clamp-1">{item.title}</span>
                    </li>
                  ))}
                  {template.items.length > 5 && (
                    <li className="pl-6 text-[10px] text-neutral-400">
                      +{template.items.length - 5} more items
                    </li>
                  )}
                </ol>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() => setApplying(template)}
                    disabled={!canApply}
                    className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[10.5px] text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <CheckCircle2 size={11} /> Apply
                  </button>
                  <button
                    disabled={safety.pending}
                    onClick={() =>
                      void safety.run({
                        key: `${template.id}:copy`,
                        allowRepeatAfterRefresh: true,
                        operation: () =>
                          saveSubtaskTemplate(orgId, {
                            title: `${template.title} copy`,
                            description: template.description,
                            visibility: "personal",
                            items: template.items.map((item) => ({
                              ...item,
                              id: undefined,
                            })),
                          }),
                        success: "Personal copy created.",
                        refresh: () => load(true),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] text-neutral-600 hover:bg-neutral-50"
                  >
                    <Copy size={11} /> Copy
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setEditing(template)}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] text-neutral-600 hover:bg-neutral-50"
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                  )}
                  {canManageDepartment &&
                    template.approvalStatus === "pending" && (
                      <>
                        <button
                          disabled={safety.pending}
                          onClick={() =>
                            void safety.run({
                              key: `${template.id}:review`,
                              confirmation: {
                                title: "Confirm template review?",
                                description: `“${template.title}” will be approved.`,
                                actionLabel: "Confirm review",
                              },
                              operation: () =>
                                reviewSubtaskTemplate(template.id, true),
                              success: "Office template approved.",
                              refresh: () => load(true),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[10.5px] text-emerald-700 hover:bg-emerald-50"
                        >
                          <ShieldCheck size={11} /> Approve
                        </button>
                        <button
                          disabled={safety.pending}
                          onClick={() =>
                            void safety.run({
                              key: `${template.id}:review`,
                              confirmation: {
                                title: "Confirm template review?",
                                description: `“${template.title}” will be rejected.`,
                                actionLabel: "Confirm review",
                              },
                              operation: () =>
                                reviewSubtaskTemplate(template.id, false),
                              success: "Office template rejected.",
                              refresh: () => load(true),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10.5px] text-rose-600 hover:bg-rose-50"
                        >
                          <ShieldX size={11} /> Reject
                        </button>
                      </>
                    )}
                  {canEdit && (
                    <button
                      aria-label={`Delete ${template.title}`}
                      disabled={safety.pending}
                      onClick={() =>
                        void safety.run({
                          key: `${template.id}:delete`,
                          confirmation: {
                            title: "Delete subtask template?",
                            description: `Permanently remove “${template.title}” from the library. Previously created subtasks remain.`,
                            danger: true,
                            actionLabel: "Delete template",
                            confirmationText: template.title,
                          },
                          operation: () => deleteSubtaskTemplate(template.id),
                          success: "Subtask template deleted.",
                          refresh: () => load(true),
                        })
                      }
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10.5px] text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <SubtaskTemplateEditor
          initial={editableDraft}
          canPublishDirectly={canManageDepartment}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {applying && (
        <SubtaskTemplateApplyDialog
          template={applying}
          tasks={leadingTasks}
          employees={employees}
          onClose={() => setApplying(null)}
        />
      )}
    </div>
  );
}
