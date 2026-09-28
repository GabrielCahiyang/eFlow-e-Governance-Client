import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { Employee, EmployeeNote } from "../../../employees";
import { updateEmployeeNotes } from "../../../employees";

interface NoteDraft {
  strengths: string;
  developmentAreas: string;
  notes: string;
  tags: string;
}

const noteToDraft = (note: EmployeeNote | undefined, storedSkills: string[]): NoteDraft => ({
  strengths: note?.strengths || storedSkills.join(", "),
  developmentAreas: note?.weaknesses || "",
  notes: note?.notes || "",
  tags: note?.tags?.join(", ") || storedSkills.join(", "),
});

export function EmployeeCoachingEditor({
  employee,
  note,
  storedSkills,
  updatedBy,
}: {
  employee: Employee;
  note?: EmployeeNote;
  storedSkills: string[];
  updatedBy?: string;
}) {
  const [draft, setDraft] = useState<NoteDraft>(() => noteToDraft(note, storedSkills));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const previousEmployee = useRef(employee.id);

  useEffect(() => {
    const employeeChanged = previousEmployee.current !== employee.id;
    if (employeeChanged || !dirty) setDraft(noteToDraft(note, storedSkills));
    if (employeeChanged) {
      previousEmployee.current = employee.id;
      setDirty(false);
      setSaved(false);
      setError("");
    }
  }, [dirty, employee.id, note, storedSkills]);

  const change = (field: keyof NoteDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setSaved(false);
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateEmployeeNotes(employee.id, {
        strengths: draft.strengths.trim(),
        weaknesses: draft.developmentAreas.trim(),
        notes: draft.notes.trim(),
        tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      }, updatedBy);
      setDirty(false);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex items-start gap-2.5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><Sparkles size={15} /></div><div><h3 className="text-[12.5px] font-semibold text-neutral-900">Assignment and coaching profile</h3><p className="mt-0.5 text-[10px] leading-4 text-neutral-400">Strengths, development context, and tags remain inputs to AI team recommendations.</p></div></div>
        <span className="shrink-0 rounded-full border border-violet-100 bg-violet-50 px-2 py-1 text-[9px] font-medium text-violet-700">AI input</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Confirmed strengths" hint="Capabilities the employee can reliably apply to assigned work."><textarea rows={4} value={draft.strengths} onChange={(event) => change("strengths", event.target.value)} placeholder="e.g., stakeholder facilitation, technical writing" className="field-textarea" /></Field>
        <Field label="Development areas" hint="Stored in the existing compatibility field used by the assignment engine."><textarea rows={4} value={draft.developmentAreas} onChange={(event) => change("developmentAreas", event.target.value)} placeholder="e.g., needs support with field documentation" className="field-textarea" /></Field>
        <div className="md:col-span-2"><Field label="Supervisor context" hint="Use factual, work-related context. Avoid unsupported personal judgments."><textarea rows={4} value={draft.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Context for future assignments and coaching conversations…" className="field-textarea" /></Field></div>
        <div className="md:col-span-2"><Field label="Assignment skill tags" hint="Comma-separated keywords used directly by AI matching."><input value={draft.tags} onChange={(event) => change("tags", event.target.value)} placeholder="permits, facilitation, data analysis" className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-[11.5px] outline-none transition focus:border-neutral-400 focus:bg-white" /></Field></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-3">
        <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[10.5px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">{saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : "Save profile"}</button>
        {saved && <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-600"><CheckCircle2 size={12} /> Saved and available to AI recommendations</span>}
        {dirty && !saving && <span className="text-[10.5px] text-amber-600">Unsaved changes</span>}
        {error && <span className="text-[10.5px] text-red-600">{error}</span>}
      </div>
      <style>{`.field-textarea{width:100%;resize:none;border-radius:.5rem;border:1px solid #e5e7eb;background:#fafafa;padding:.65rem .75rem;font-size:11.5px;line-height:1.25rem;outline:none;transition:.15s}.field-textarea:focus{border-color:#a3a3a3;background:white}`}</style>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[9.5px] font-medium uppercase tracking-wider text-neutral-500">{label}</span><span className="mb-1.5 mt-0.5 block text-[9.5px] leading-4 text-neutral-400">{hint}</span>{children}</label>;
}
