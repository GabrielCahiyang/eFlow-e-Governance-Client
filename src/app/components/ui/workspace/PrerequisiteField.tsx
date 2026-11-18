type Choice = { id: string; title: string; status: string };

export function PrerequisiteField({ label, choices, selected, disabled, onChange }: {
  label: string;
  choices: readonly Choice[];
  selected: readonly string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const unavailable = selected.some(id => !choices.some(choice => choice.id === id));
  return <fieldset aria-label={label} disabled={disabled || unavailable}>
    <legend>{label}</legend>
    {unavailable && <p role="status">Some prerequisites are unavailable. The selection is read-only.</p>}
    {choices.length === 0 && !unavailable && <p>No eligible prerequisites yet.</p>}
    <div className="pt-dependency-options max-h-48 overflow-y-auto">
      {choices.map(choice => <label key={choice.id} className="!flex items-start gap-2">
        <input type="checkbox" checked={selected.includes(choice.id)}
          onChange={event => onChange(event.target.checked ? [...selected, choice.id] : selected.filter(id => id !== choice.id))} />
        <span>{choice.title}<small className="block text-xs text-muted-foreground">{choice.status === 'cancelled' ? 'Cancelled · remove or replace' : choice.status.replace(/_/g, ' ')}</small></span>
      </label>)}
    </div>
  </fieldset>;
}
