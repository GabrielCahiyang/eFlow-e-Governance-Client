import { useId, useRef, useState, type MutableRefObject } from 'react';
import { Mail, Plus, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { getPhilippineCalendarDate, scheduledDateError } from '../../../shared/calendarDates';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { sendProjectInvitation, submitProjectInvitation } from '../services/projectInvitationService';
import type { InvitationDraft } from '../types';
import { SkillTagSelector } from '../../../components/ui/SkillTagSelector';
import { DateInput } from '../../../components/ui/DateInput';
import { useSkillTags } from '../../../shared/skillTags';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const blank = (): InvitationDraft => ({ id: crypto.randomUUID(), email: '', summary: '', skills: '', engagement: 'Other', end: '', untilClose: true });

export function ProjectInvitationForm({ project, office, root, node, timezone, canSend = false, onDone, onClose, closeRef }: { project: string; office: string; root?: string; node?: string; timezone: string; canSend?: boolean; onDone: () => void; onClose: () => void; closeRef?: MutableRefObject<(() => void) | undefined> }) {
  const { activeLabels: availableSkillTags, loading: loadingSkillTags } = useSkillTags(true);
  const [rows, setRows] = useState<InvitationDraft[]>(() => [blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [touchedEmails, setTouchedEmails] = useState<Record<string, boolean>>({});
  const [touchedDates, setTouchedDates] = useState<Record<string, boolean>>({});
  const [invalidDates, setInvalidDates] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formUid = useId();
  const todayManila = getPhilippineCalendarDate();
  const attempted = useRef(new Set<string>()), dirty = rows.some(row => !!row.email && !receipts[row.id]);
  const guard = useExplicitDraft('Project invitations', dirty, busy, onClose), confirmation = useConfirmation();
  async function close() { if (guard.pendingRef.current || busy) return; if (dirty && !await confirmation.confirm({ title: 'Discard unsent invitation details?', description: 'Saved requests and sent invitations remain available in the invitation list.', actionLabel: 'Discard unsent details' })) return; if (guard.pendingRef.current) return; guard.markClean(); onClose(); }
  if (closeRef) closeRef.current = () => void close();
  const change = (id: string, patch: Partial<InvitationDraft>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));

  const rowEmailError = (row: InvitationDraft, index: number) => {
    const trimmed = row.email.trim();
    if (!trimmed) {
      const otherHasEmail = rows.some((item) => item.id !== row.id && item.email.trim());
      return index === 0 && !otherHasEmail ? 'Email address is required.' : '';
    }
    if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address (for example, name@example.com).';
    return '';
  };

  const rowDateError = (row: InvitationDraft) => {
    if (row.untilClose) return '';
    if (invalidDates[row.id]) return 'Enter a valid access end date in MM/DD/YYYY format.';
    if (!row.end) {
      return row.engagement !== 'Permanent' ? 'Select an access end date or choose Until project completion or archive.' : '';
    }
    return scheduledDateError(row.end, { earliest: todayManila, label: 'Access end date' });
  };

  const unsentFilledRows = rows.filter((row) => row.email.trim() && !receipts[row.id]);
  const invalidEmailRow = unsentFilledRows.find((row) => !EMAIL_PATTERN.test(row.email.trim()));
  const invalidDateRow = unsentFilledRows.find((row) => Boolean(rowDateError(row)));
  const firstBlockingReason = !unsentFilledRows.length
    ? 'Enter at least one recipient email address.'
    : invalidEmailRow
      ? `Enter a valid email address for “${invalidEmailRow.email.trim()}”.`
      : invalidDateRow
        ? rowDateError(invalidDateRow)
        : '';
  const submitDisabled = busy || Boolean(firstBlockingReason);
  const submitTip = busy ? '' : firstBlockingReason;

  async function send() {
    setSubmitAttempted(true);
    if (guard.pendingRef.current || firstBlockingReason) return;
    guard.pendingRef.current = true; setBusy(true); setError(''); const failures: string[] = [], next = { ...receipts };
    try {
      for (const row of rows.filter(row => row.email.trim())) {
        if (next[row.id]) continue; attempted.current.add(row.id);
        try {
          if (canSend) { const result = await sendProjectInvitation(project, office, row, timezone, root, node); next[row.id] = result.status; }
          else { await submitProjectInvitation(project, office, row, timezone, root, node); next[row.id] = 'Request submitted · pending Head approval'; }
          setReceipts({ ...next }); onDone();
        } catch (reason) { failures.push(`${row.email}: ${(reason as Error).message}`); }
      }
      setError(failures.join('\n')); if (!failures.length) guard.markClean();
    } finally { guard.pendingRef.current = false; setBusy(false); }
  }

  return <div className="r8-form">
    <div className="r8-invite-explanation"><UserRoundPlus size={22} aria-hidden="true" /><div><strong>{canSend ? 'Invite people to this project' : 'Request a project invitation'}</strong><p>{canSend ? 'Send an invitation to their email. They enter their own name, choose a password and complete their profile when they join.' : 'Your sponsoring Head reviews the request before an invitation is sent. The recipient completes their own profile and password.'}</p></div></div>
    <form noValidate onSubmit={event => { event.preventDefault(); event.stopPropagation(); void send(); }}>
      {rows.map((row, index) => {
        const emailId = `${formUid}-email-${row.id}`;
        const dateId = `${formUid}-end-${row.id}`;
        const rawEmailErr = rowEmailError(row, index);
        const visibleEmailErr = touchedEmails[row.id] || submitAttempted || row.email.length > 0 ? rawEmailErr : '';
        const rawDateErr = rowDateError(row);
        const visibleDateErr = touchedDates[row.id] || submitAttempted || Boolean(invalidDates[row.id]) || Boolean(row.end) ? rawDateErr : '';
        return <div key={row.id}><fieldset className="r8-invite-person" disabled={busy || attempted.current.has(row.id)}><legend>Person {index + 1}</legend>
          <div className="grid gap-1">
            <label htmlFor={emailId}>Email address {index + 1} <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></label>
            <BoundedTextInput
              id={emailId}
              type="email"
              autoComplete="off"
              aria-required={index === 0 || undefined}
              value={row.email}
              maxLength={INPUT_LIMITS.EMAIL}
              placeholder="name@example.com"
              error={visibleEmailErr || undefined}
              onBlur={() => setTouchedEmails((prev) => ({ ...prev, [row.id]: true }))}
              onChange={event => {
                change(row.id, { email: event.target.value });
                if (!touchedEmails[row.id]) setTouchedEmails((prev) => ({ ...prev, [row.id]: true }));
              }}
            />
          </div>
          <label>Engagement<select aria-label="Engagement" value={row.engagement} onChange={event => change(row.id, { engagement: event.target.value as InvitationDraft['engagement'] })}>{['Permanent', 'Job Order', 'OJT', 'Consultant', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="r8-invite-until"><input type="checkbox" checked={row.untilClose} onChange={event => {
            const checked = event.target.checked;
            change(row.id, { untilClose: checked, end: checked ? '' : row.end });
            if (checked) setInvalidDates((prev) => ({ ...prev, [row.id]: false }));
          }} />Until project completion or archive</label>
          {!row.untilClose && <div className="grid gap-1">
            <label htmlFor={dateId}>Access ends after this date · {timezone}{row.engagement !== 'Permanent' && <span className="text-[var(--eflow-negative-text)]" aria-hidden="true"> *</span>}</label>
            <DateInput
              id={dateId}
              min={todayManila}
              aria-required={row.engagement !== 'Permanent' || undefined}
              hasError={Boolean(visibleDateErr)}
              errorMessage={visibleDateErr || undefined}
              value={row.end}
              onInvalidTextChange={(inv) => setInvalidDates((prev) => ({ ...prev, [row.id]: inv }))}
              onBlur={() => setTouchedDates((prev) => ({ ...prev, [row.id]: true }))}
              onChange={event => {
                change(row.id, { end: event.target.value });
                if (!touchedDates[row.id]) setTouchedDates((prev) => ({ ...prev, [row.id]: true }));
              }}
            />
            {visibleDateErr && <div className="eflow-bounded-meta"><span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{visibleDateErr}</span></div>}
          </div>}
          {(availableSkillTags.length > 0 || row.skills) && (
            <SkillTagSelector
              availableTags={availableSkillTags}
              loading={loadingSkillTags}
              selected={row.skills ? row.skills.split(',').map(s => s.trim()).filter(Boolean) : []}
              disabled={busy || attempted.current.has(row.id)}
              title="Requested skills (optional)"
              description="Tap the skills needed for this project member."
              onChange={next => change(row.id, { skills: next.join(', ') })}
            />
          )}
          <p className="r8-invite-scope"><ShieldCheck size={15} aria-hidden="true" />Project-only access{root ? ' · selected task' : ''}{node ? " / subtask" : ''}. This does not grant a permanent account role.</p>
        </fieldset>{receipts[row.id] && <p role="status" className="r8-invite-receipt">{row.email}: {receipts[row.id]}</p>}</div>;
      })}
      {rows.length < 5 && <button type="button" className="r8-add-person" disabled={busy} onClick={() => setRows(current => [...current, blank()])}><Plus size={16} aria-hidden="true" />Add another person</button>}
      {error && <p role="alert">{error} Successful invitations are excluded from retry. Saved request details are retained to prevent duplicates.</p>}
      <footer>
        <button type="button" disabled={busy} onClick={() => void close()}>{canSend ? 'Close invitation form' : 'Close request form'}</button>
        <WorkspaceTooltip content={submitTip} disabled={!submitTip}>
          <span className="inline-flex">
            <button type="submit" className="r8-send-primary" disabled={submitDisabled}><Mail size={16} aria-hidden="true" />{busy ? canSend ? 'Sending…' : 'Submitting…' : canSend ? 'Send invitations' : 'Submit requests for Head approval'}</button>
          </span>
        </WorkspaceTooltip>
      </footer>
    </form>{confirmation.dialog}
  </div>;
}
