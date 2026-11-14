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
  pendingCount, restrictedCount = 0, emptyLabel = 'No prerequisites', onSave,
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
  onSave: (ids: string[]) => Promise<void>;
}) {
  const editor = usePlanningEditor(() => [...selectedIds].sort(), `Dependencies for ${title}`);
  const choices = editor.open ? getChoices() : [];
  const byId = new Map((editor.open || selectedIds.length ? records : []).map(record => [record.id, record]));
  const choiceIds = new Set(choices.map(choice => choice.id));
  const waiting = pendingCount ?? selectedIds.filter(id => byId.get(id)?.status !== 'completed').length;
  const canEdit = !disabled && restrictedCount === 0;
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
            if (canEdit) void editor.submit(onSave, 'Dependencies saved.');
          }}>
            <strong>Depends on</strong>
            <p>{description}</p>
            <div className="pt-dependency-options">
              {choices.map(item => (
                <label key={item.id}>
                  <input type="checkbox" checked={editor.draft.includes(item.id)} disabled={!canEdit || editor.pending}
                    onChange={event => editor.setDraft((event.target.checked
                      ? [...editor.draft, item.id] : editor.draft.filter(id => id !== item.id)).sort())} />
                  <span>{item.title}<small className="block text-xs text-muted-foreground">
                    {item.status === 'completed'
                      ? <><CheckCircle2 size={12} />{completedLabel}</>
                      : <><Clock size={12} />Waiting · {item.status.replace(/_/g, ' ')}</>}
                  </small></span>
                </label>
              ))}
              {editor.draft.filter(id => !choiceIds.has(id)).map(id => (
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
