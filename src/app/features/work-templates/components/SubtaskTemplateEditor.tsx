import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { SubtaskTemplateDraft } from "../types";

const emptyItem = (position: number) => ({ title: "", position });

export function SubtaskTemplateEditor({
  initial,
  canPublishDirectly,
  onClose,
  onSave,
}: {
  initial?: SubtaskTemplateDraft;
  canPublishDirectly: boolean;
  onClose: () => void;
  onSave: (draft: SubtaskTemplateDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SubtaskTemplateDraft>(
    initial || {
      title: "",
      description: "",
      visibility: "personal",
      items: [emptyItem(0)],
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const items = draft.items
      .map((item, position) => ({ ...item, title: item.title.trim(), position }))
      .filter((item) => item.title);
    if (!draft.title.trim()) { setError("Template name is required."); return; }
    if (items.length === 0) { setError("Add at least one subtask."); return; }
    setSaving(true);
    setError("");
    try { await onSave({ ...draft, title: draft.title.trim(), items }); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Template could not be saved.");
      setSaving(false);
    }
  };

  return (
    <FeatureDialog onClose={onClose} title={initial?.id ? "Edit checklist" : "Create checklist"} contentClassName="!h-[88vh] !max-w-2xl max-sm:!h-[100dvh]" showCloseButton={false}>
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Subtask template</div>
            <h3 className="text-[16px] font-semibold text-neutral-900">{initial?.id ? "Edit checklist" : "Create checklist"}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block text-[10.5px] text-neutral-500">Template name
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Meeting Preparation" className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-[12.5px] outline-none focus:border-neutral-400" />
          </label>
          <label className="block text-[10.5px] text-neutral-500">Description
            <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={2} placeholder="When should this checklist be used?" className="mt-1 w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-[12px] outline-none focus:border-neutral-400" />
          </label>
          <label className="block text-[10.5px] text-neutral-500">Visibility
            <select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value as SubtaskTemplateDraft["visibility"] }))} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[12px] outline-none">
              <option value="personal">Personal · only you</option>
              <option value="department">Office shared</option>
            </select>
          </label>
          {draft.visibility === "department" && !canPublishDirectly && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Office templates created by Team Leaders are submitted to the Head or Member for approval.</div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Checklist items</span>
              <button onClick={() => setDraft((current) => ({ ...current, items: [...current.items, emptyItem(current.items.length)] }))} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] text-neutral-600 hover:bg-neutral-50"><Plus size={11} /> Add item</button>
            </div>
            <div className="space-y-2">
              {draft.items.map((item, index) => (
                <div key={`${item.id || "new"}-${index}`} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-neutral-400">{index + 1}</span>
                  <input value={item.title} onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry) }))} placeholder="Describe the subtask…" className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] outline-none focus:border-neutral-400" />
                  <button disabled={draft.items.length === 1} onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2 text-[12px] text-neutral-600 hover:bg-neutral-50">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-neutral-900 px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50">{saving ? "Saving…" : initial?.id ? "Save changes" : "Create template"}</button>
        </div>
      </div>
    </FeatureDialog>
  );
}
