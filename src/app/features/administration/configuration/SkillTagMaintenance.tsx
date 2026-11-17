import "./statusMaintenance.css";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Tag } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { StatusPill, WorkspaceHeader } from "../../../components/ui/workspace";
import {
  saveSkillTagDefinition,
  useSkillTags,
  type SkillTagDefinition,
} from "../../../shared/skillTags";

export function SkillTagMaintenance({ embedded = false }: { embedded?: boolean }) {
  const { definitions, loading, error: loadError, refresh } = useSkillTags(true);
  const [draft, setDraft] = useState<SkillTagDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function edit(item: SkillTagDefinition) {
    setDraft({ ...item });
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const cleanLabel = draft.label.replace(/\s+/g, " ").trim();
    if (!cleanLabel || cleanLabel.length > 100) {
      setError("Enter a skill name between 1 and 100 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveSkillTagDefinition({
        ...draft,
        position: Math.max(0, Math.min(999, Math.round(draft.position || 100))),
        label: cleanLabel,
      });
      setDraft(null);
      setNotice(`Saved "${cleanLabel}".`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save skill tag.");
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button
      type="button"
      disabled={loading || busy}
      onClick={() =>
        edit({
          id: crypto.randomUUID(),
          label: "",
          position: Math.min(999, (definitions.length + 1) * 10),
          retired: false,
        })
      }
    >
      <Plus size={15} aria-hidden="true" /> Add skill tag
    </Button>
  );

  const activeTags = definitions.filter((item) => !item.retired);
  const hiddenTags = definitions.filter((item) => item.retired);

  const renderTable = (items: SkillTagDefinition[]) => (
    <div className="status-maintenance-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Skill name</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Edit ${item.label}`}
                  disabled={busy}
                  onClick={() => edit(item)}
                >
                  <Pencil size={13} aria-hidden="true" /> Edit
                </Button>
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
              Add or update skill tags that invited users and staff can select with a tap instead of typing.
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
      {notice && <FeedbackState tone="success" title="Saved">{notice}</FeedbackState>}

      {!loading && !loadError && (
        <>
          {draft && (
            <form className="status-maintenance-editor" onSubmit={save}>
              <div className="eflow-admin-subsection-header">
                <h3>{draft.label ? `Edit “${draft.label}”` : "Add skill tag"}</h3>
              </div>
              <div className="status-maintenance-fields">
                <label>
                  Skill name
                  <input
                    required
                    maxLength={100}
                    value={draft.label}
                    disabled={busy}
                    placeholder="e.g. Budget Forecasting"
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  />
                </label>
              </div>
              <label className="status-maintenance-retire">
                <input
                  type="checkbox"
                  checked={draft.retired}
                  disabled={busy}
                  onChange={(event) => setDraft({ ...draft, retired: event.target.checked })}
                />
                <span>Hide from new invitations (keeps existing user profiles intact)</span>
              </label>
              {error && <FeedbackState tone="error" title="Check skill details">{error}</FeedbackState>}
              <div className="status-maintenance-actions">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save skill tag"}
                </Button>
              </div>
            </form>
          )}

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
                  Hidden from new invitations while preserving skills already saved on accounts.
                </p>
              </div>
              {renderTable(hiddenTags)}
            </section>
          )}
        </>
      )}
    </section>
  );
}
