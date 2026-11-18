import "./statusMaintenance.css";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { FormField, TextInput } from "../../../components/ui/FormField";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { StatusPill, WorkspaceHeader } from "../../../components/ui/workspace";
import {
  saveSkillTagDefinition,
  updateSkillTagDefinition,
  useSkillTags,
  type SkillTagDefinition,
} from "../../../shared/skillTags";

export function SkillTagMaintenance({ embedded = false }: { embedded?: boolean }) {
  const { definitions, loading, error: loadError, refresh } = useSkillTags(true);
  const [editor, setEditor] = useState<{
    draft: SkillTagDefinition;
    originalLabel: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const removal = useConfirmation();

  function openEditor(draft: SkillTagDefinition, originalLabel: string | null) {
    setEditor({ draft, originalLabel });
    setError("");
    setNotice("");
  }

  function closeEditor() {
    setEditor(null);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || busy) return;
    const { draft } = editor;
    const cleanLabel = draft.label.replace(/\s+/g, " ").trim();
    if (!cleanLabel || cleanLabel.length > 100) {
      setError("Enter a skill name between 1 and 100 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editor.originalLabel === null) {
        await saveSkillTagDefinition({ ...draft, label: cleanLabel });
      } else {
        await updateSkillTagDefinition(draft.id, { label: cleanLabel });
      }
      closeEditor();
      setNotice(`Saved “${cleanLabel}”.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save skill tag.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(item: SkillTagDefinition) {
    if (busy) return;
    const retire = !item.retired;
    if (retire && !(await removal.confirm({
      title: "Remove skill tag?",
      description: `“${item.label}” will be removed from the skill picker. People who already have this skill will keep it. You can restore the tag from Hidden skill tags.`,
      actionLabel: "Remove skill tag",
      danger: true,
    }))) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateSkillTagDefinition(item.id, { retired: retire });
      setNotice(retire ? `Removed “${item.label}” from the skill picker.` : `Restored “${item.label}”.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update skill tag.");
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button
      type="button"
      disabled={loading || busy}
      onClick={() =>
        openEditor({
          id: crypto.randomUUID(),
          label: "",
          position: Math.min(999, (definitions.length + 1) * 10),
          retired: false,
        }, null)
      }
    >
      <Plus size={15} aria-hidden="true" /> Add skill tag
    </Button>
  );

  const activeTags = definitions.filter((item) => !item.retired);
  const hiddenTags = definitions.filter((item) => item.retired);
  const editorTitle = editor?.originalLabel ? `Edit “${editor.originalLabel}”` : "Add skill tag";

  const renderTable = (items: SkillTagDefinition[]) => (
    <div className="status-maintenance-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Skill name</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="inline-flex items-center gap-2 font-medium text-[var(--eflow-text)]">
                  <Tag size={14} aria-hidden="true" className="text-[var(--eflow-text-muted)]" />
                  {item.label}
                </span>
              </td>
              <td>
                <StatusPill
                  label={item.retired ? "Hidden" : "Active"}
                  tone={item.retired ? "neutral" : "positive"}
                />
              </td>
              <td>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${item.label}`}
                    disabled={busy}
                    onClick={() => openEditor(item, item.label)}
                  >
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${item.retired ? "Restore" : "Remove"} ${item.label}`}
                    disabled={busy}
                    onClick={() => void toggleVisibility(item)}
                  >
                    {item.retired ? (
                      <><RotateCcw size={13} aria-hidden="true" /> Restore</>
                    ) : (
                      <><Trash2 size={13} aria-hidden="true" /> Remove</>
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="status-maintenance">
      {!embedded ? (
        <WorkspaceHeader
          title="Skill Tags"
          description="Manage selectable skill buttons shown during email invitations and user profiles."
          actions={addButton}
        />
      ) : (
        <div className="eflow-admin-subsection-header">
          <div>
            <h2>Skill tags</h2>
            <p className="eflow-admin-copy">
              Manage the skill tags that invited users and staff can select.
            </p>
          </div>
          {addButton}
        </div>
      )}

      {loadError && (
        <FeedbackState tone="error" title="Could not load skill tags" onRetry={() => void refresh()}>
          {loadError}
        </FeedbackState>
      )}
      {loading && !loadError && (
        <div role="status" className="eflow-admin-card animate-pulse text-sm text-[var(--eflow-text-muted)]">
          Loading skill tags…
        </div>
      )}
      {notice && <FeedbackState tone="success" title="Skill tags updated">{notice}</FeedbackState>}
      {error && !editor && (
        <FeedbackState tone="error" title="Could not update skill tag">{error}</FeedbackState>
      )}

      {!loading && !loadError && (
        <>
          <section className="eflow-admin-card space-y-4">
            <div>
              <h3>Active skill tags ({activeTags.length})</h3>
              <p className="eflow-admin-copy">
                Shown as clickable chips during email invites, onboarding, and account editing.
              </p>
            </div>
            {activeTags.length ? (
              renderTable(activeTags)
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--eflow-border)] px-4 py-6 text-center text-sm text-[var(--eflow-text-muted)]">
                No active skill tags yet. Use Add skill tag above to create one.
              </div>
            )}
          </section>

          {hiddenTags.length > 0 && (
            <section className="eflow-admin-card space-y-4">
              <div>
                <h3>Hidden skill tags ({hiddenTags.length})</h3>
                <p className="eflow-admin-copy">
                  Hidden from the skill picker. Skills already saved on accounts are kept.
                </p>
              </div>
              {renderTable(hiddenTags)}
            </section>
          )}
        </>
      )}

      {editor && (
        <FeatureDialog
          title={editorTitle}
          onClose={closeEditor}
          preventClose={busy}
          contentClassName="max-w-md"
        >
          <form className="grid gap-4 overflow-y-auto p-6" onSubmit={save}>
            <h2 className="pr-8 text-lg font-semibold text-[var(--eflow-text)]">{editorTitle}</h2>
            <FormField label="Skill name" required error={error}>
              <TextInput
                required
                maxLength={100}
                value={editor.draft.label}
                disabled={busy}
                placeholder="e.g. Budget Forecasting"
                onChange={(event) => setEditor({
                  ...editor,
                  draft: { ...editor.draft, label: event.target.value },
                })}
              />
            </FormField>
            <div className="status-maintenance-actions">
              <Button type="button" variant="outline" disabled={busy} onClick={closeEditor}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save skill tag"}
              </Button>
            </div>
          </form>
        </FeatureDialog>
      )}
      {removal.dialog}
    </section>
  );
}
