import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { useState } from 'react';
import { Building2, AlertTriangle, X } from 'lucide-react';
import { ModalButton } from '../../../components/ui/Modal';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import type { ProposedOffice } from '../types';

export function PdfOfficeReview({ offices, clarification, onConfirm }: { offices: ProposedOffice[]; clarification: string[]; onConfirm: (offices: ProposedOffice[]) => Promise<void> }) {
  const [rows, setRows] = useState(offices), [busy, setBusy] = useState(false), [clarified, setClarified] = useState<Record<number, string>>({});
  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    const normalized = row.name.trim().toLowerCase();
    if (normalized) nameCounts.set(normalized, (nameCounts.get(normalized) ?? 0) + 1);
  }
  for (const value of Object.values(clarified)) {
    const normalized = value.trim().toLowerCase();
    if (normalized) nameCounts.set(normalized, (nameCounts.get(normalized) ?? 0) + 1);
  }
  const hasBlankRow = rows.some(row => !row.name.trim());
  const hasDuplicateName = Array.from(nameCounts.values()).some(count => count > 1);
  const invalid = hasBlankRow || hasDuplicateName;
  const confirmBlockers = [
    hasBlankRow ? 'Enter a name for every office or exclude blank rows before continuing.' : '',
    hasDuplicateName ? 'Use a unique name for each office before continuing.' : '',
  ].filter(Boolean);

  return <div className="pdf-office-review"><h3><Building2 size={20} /> Check the offices</h3><p>Only these names will be added. Contacts stay blank until you send invitations.</p>
    {rows.map(row => {
      const normalized = row.name.trim().toLowerCase();
      const rowError = !normalized
        ? 'Office name is required.'
        : (nameCounts.get(normalized) ?? 0) > 1
          ? 'Duplicate office name — use a unique name for each office.'
          : undefined;
      return <div className="pdf-office-review__row" key={row.key}>
        <label>
          <span className="sr-only">Office name</span>
          <BoundedTextInput
            aria-label="Office name"
            aria-required="true"
            maxLength={INPUT_LIMITS.TITLE}
            value={row.name}
            disabled={busy}
            error={rowError}
            onChange={event => setRows(current => current.map(item => item.key === row.key ? { ...item, name: event.target.value, officeId: '' } : item))}
          />
        </label>
        <WorkspaceTooltip content={`Exclude ${row.name || 'office'}`} disabled={busy}>
          <span className="inline-flex">
            <button type="button" disabled={busy} aria-label={`Exclude ${row.name}`} onClick={() => setRows(current => current.filter(item => item.key !== row.key))}><X size={17} /></button>
          </span>
        </WorkspaceTooltip>
        <details><summary>View PDF evidence</summary><p>{row.evidence}</p></details>
      </div>;
    })}
    {!rows.length && <p>No named offices selected. The project’s existing office stays unchanged.</p>}
    {!!clarification.length && <>
      <div className="pdf-office-review__notice"><AlertTriangle size={18} /><span>These names need clarification. Enter a specific office only if you know which one; leave blank to skip it.</span></div>
      {clarification.map((name, index) => {
        const value = clarified[index] || '';
        const normalized = value.trim().toLowerCase();
        const clarifiedError = normalized && (nameCounts.get(normalized) ?? 0) > 1
          ? 'Duplicate office name — use a unique name for each office.'
          : undefined;
        return <label key={name} className="pdf-office-review__row">
          <span>{name}</span>
          <BoundedTextInput
            aria-label={`Specific office for ${name}`}
            maxLength={INPUT_LIMITS.TITLE}
            placeholder="Specific office name (optional)"
            value={value}
            disabled={busy}
            error={clarifiedError}
            onChange={event => setClarified(current => ({ ...current, [index]: event.target.value }))}
          />
        </label>;
      })}
    </>}
    {invalid && <p role="alert">Use a different, non-empty name for each office.</p>}
    <ActionBlockerGroup actionLabel="Confirm offices & continue" blockers={confirmBlockers} busy={busy}>
      <ModalButton variant="primary" pending={busy} disabled={invalid} onClick={() => { setBusy(true); const manual = Object.entries(clarified).filter(([, name]) => name.trim()).map(([index, name]) => ({ key: `clarified-${index}`, name: name.trim(), evidence: `Head clarified the source reference: ${clarification[Number(index)]}`, officeId: '', confirmed: true })); void onConfirm([...rows, ...manual]).finally(() => setBusy(false)); }}>Confirm offices & continue</ModalButton>
    </ActionBlockerGroup>
  </div>;
}
