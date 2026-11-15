import { CheckCircle2, Clock, Link2 } from 'lucide-react';
import { usePlanningEditor } from '../../../shared/usePlanningEditor';
import { Button } from '../button';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

interface Prerequisite {
  id: string;
  title: string;
  status: string;
}

export function PrerequisiteCell({
  title, itemName, selectedIds, records, getChoices, disabled, description, completedLabel,
  pendingCount, restrictedCount = 0, emptyLabel = 'No prerequisites', legacySequential = false, onSave,
}: {
  title: string;
  itemName: string;
  selectedIds: string[];
  records: Prerequisite[];
  getChoices: () => Prerequisite[];
  disabled: boolean;
  description: string;
  completedLabel: string;
  pendingCount?: number | null;
  restrictedCount?: number;
  emptyLabel?: string;
  legacySequential?: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const editor = usePlanningEditor<string[] | null>(() => legacySequential ? null : [...selectedIds].sort(), `Dependencies for ${title}`);
  const draftIds = editor.draft || [];
  // A visible cancelled selection remains unresolved, but an authorized planner
  // can remove/replace it. Never offer cancelled work as a new prerequisite.
  const choices = editor.open ? [...new Map([
    ...getChoices().filter(item => item.status !== 'cancelled'),
    ...records.filter(item => item.status === 'cancelled' && selectedIds.includes(item.id)),
  ].map(item => [item.id, item])).values()] : [];
  const byId = new Map((editor.open || selectedIds.length ? records : []).map(record => [record.id, record]));
  const choiceIds = new Set(choices.map(choice => choice.id));
  const waiting = pendingCount ?? selectedIds.filter(id => byId.get(id)?.status !== 'completed').length;
  const canEdit = !disabled && restrictedCount === 0 && selectedIds.every(id => byId.has(id));
  const label = selectedIds.length || restrictedCount
    ? waiting ? `Waiting for ${waiting} ${itemName}${waiting === 1 ? '' : 's'}` : 'Ready to start'
    : emptyLabel;
  return (
    <Popover open={editor.open} onOpenChange={editor.onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="pt-dependencies" disabled={!canEdit}
          title={[...selectedIds.map(id => byId.get(id)?.title || `Restricted ${itemName}`),
            ...(restrictedCount ? [`${restrictedCount} restricted prerequisite(s)`] : [])].join(', ')}
          aria-label={`Edit dependencies for ${title}`}>
          <Link2 size={14} aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      {editor.open && (
        <PopoverContent className="eflow-workspace-popover pt-planning-editor"
          aria-label={`Dependencies for ${title}`} align="start"
          onInteractOutside={event => { if (editor.pending) event.preventDefault(); }}
          onEscapeKeyDown={event => { if (editor.pending) event.preventDefault(); }}>
          <form className="pt-planning-form" onSubmit={event => {
            event.preventDefault();
            if (canEdit) void editor.submit(ids => onSave(ids || []), 'Dependencies saved.');
          }}>
            <strong>Depends on</strong>
            <p>{description}</p>
            {legacySequential && <Button type="button" disabled={!canEdit || editor.pending} onClick={() => editor.setDraft([])}>Use no prerequisites</Button>}
            <div className="pt-dependency-options">
              {choices.map(item => (
                <label key={item.id}>
                  <input type="checkbox" checked={draftIds.includes(item.id)} disabled={!canEdit || editor.pending}
                    onChange={event => editor.setDraft((event.target.checked
                      ? [...draftIds, item.id] : draftIds.filter(id => id !== item.id)).sort())} />
                  <span>{item.title}<small className="block text-xs text-muted-foreground">
                    {item.status === 'completed'
                      ? <><CheckCircle2 size={12} />{completedLabel}</>
                      : <><Clock size={12} />{item.status === 'cancelled' ? 'Cancelled · remove or replace before starting' : `Waiting · ${item.status.replace(/_/g, ' ')}`}</>}
                  </small></span>
                </label>
              ))}
              {draftIds.filter(id => !choiceIds.has(id)).map(id => (
                <label key={id}><input type="checkbox" checked disabled />
                  {byId.get(id)?.title || `Restricted ${itemName}`} retained
                </label>
              ))}
            </div>
            {!choices.length && <p>Add another {itemName} first.</p>}
            {editor.error && <div role="alert" className="pf-error">Could not save dependencies: {editor.error} Correct the selection and retry.</div>}
            {editor.notice && <p role="status">{editor.notice}</p>}
            <Button type="submit" pending={editor.pending} disabled={!canEdit || !editor.dirty}>Save dependencies</Button>
          </form>
        </PopoverContent>
      )}
    </Popover>
  );
}
