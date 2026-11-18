import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, ModalButton } from '../../../components/ui/Modal';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useSkillTags } from '../../../shared/skillTags';
import { sendInvitations } from '../services/invitationService';
import { InvitationPersonFields } from './InvitationPersonFields';
import type { InvitedRole } from '../types';
import '../invitations.css';

type Row = { id: string; email: string; account_role: InvitedRole; skills: string[] };
const emptyRow = (): Row => ({ id: crypto.randomUUID(), email: '', account_role: 'member', skills: [] });

export function InviteMemberDialog({
  officeName,
  open,
  onOpenChange,
  onSent,
}: {
  officeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const confirmation = useConfirmation();
  const { activeLabels: availableSkillTags, loading: loadingSkillTags } = useSkillTags(open);
  const reset = () => {
    setRows([emptyRow()]);
    setMessage('');
    setReceipt('');
  };
  const guard = useExplicitDraft(
    'Office invitations',
    open && rows.some((row) => !!row.email.trim() || row.skills.length > 0 || row.account_role !== 'member'),
    open && busy,
    reset,
  );
  const close = () => {
    if (!guard.pendingRef.current)
      void requestNavigation(() => {
        reset();
        onOpenChange(false);
      });
  };
  const change = (id: string, values: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...values } : row)));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (guard.pendingRef.current) return;
    const selected = rows.filter((row) => row.email.trim());
    if (!selected.length) return;
    guard.pendingRef.current = true;
    try {
      if (
        !(await confirmation.confirm({
          title: 'Send Office invitations?',
          description: `Invite these people to ${officeName}. They create their own accounts with the account roles shown.`,
          actionLabel: 'Send invitations',
          impact: (
            <ul>
              {selected.map((row) => (
                <li key={row.id}>
                  {row.email.trim()} · {row.account_role === 'member' ? 'Member' : 'Accounting Staff'}
                  {row.skills.length > 0 ? ` · ${row.skills.join(', ')}` : ''}
                </li>
              ))}
            </ul>
          ),
        }))
      )
        return;
      setBusy(true);
      setMessage('');
      setReceipt('');
      console.info(
        '[eFlow Invitations] Sending invitations:',
        selected.map(({ email, account_role, skills }) => ({
          email: email.trim(),
          role: account_role,
          skills,
        })),
      );
      const { results } = await sendInvitations(
        selected.map(({ email, account_role, skills }) => ({
          email,
          account_role,
          ...(skills.length > 0 ? { skills } : {}),
        })),
      );
      const errors: string[] = [];
      const created = new Set<string>();
      for (const [index, result] of results.entries()) {
        if (result.error) {
          console.error('[eFlow Invitations] Failed to send invitation for', result.email, ':', result.error);
          errors.push(`${result.email}: ${result.error}`);
        }
        if (result.invitation) {
          created.add(selected[index].id);
          if (result.invitation.delivery_error) {
            console.warn(
              '[eFlow Invitations] Invitation created for',
              result.email,
              'but email delivery failed:',
              result.invitation.delivery_error,
            );
            errors.push(`${result.email}: ${result.invitation.delivery_error}`);
          } else {
            console.info('[eFlow Invitations] Invitation email sent to', result.email, {
              id: result.invitation.id,
              status: result.invitation.status,
              delivery: result.invitation.email_delivery_status,
            });
          }
        }
      }
      if (created.size) {
        onSent();
        setReceipt(
          `${created.size} invitation${created.size === 1 ? '' : 's'} created. Successful rows will not be sent again. Delivery failures can be retried from Invitations.`,
        );
      }
      setRows((current) => current.filter((row) => !created.has(row.id)));
      if (errors.length) setMessage(errors.join('\n'));
      else {
        guard.markClean();
        onOpenChange(false);
        reset();
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      guard.pendingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={close}
        preventClose={busy}
        title="Now, let’s bring the team in."
        description={`Invite people to ${officeName}. They’ll create their own eFlow account.`}
        width="max-w-3xl"
        footer={
          <>
            <ModalButton disabled={busy} onClick={close}>
              Remind me later
            </ModalButton>
            <ModalButton
              variant="primary"
              pending={busy}
              disabled={!rows.some((row) => row.email.trim())}
              onClick={() => formRef.current?.requestSubmit()}
            >
              Send invitations
            </ModalButton>
          </>
        }
      >
        <form ref={formRef} className="eflow-head-dialog-form" onSubmit={send}>
          <div className="eflow-invite-rows">
            {rows.map((row, index) => (
              <InvitationPersonFields
                compact
                key={row.id}
                id={row.id}
                index={index}
                email={row.email}
                skills={row.skills}
                availableSkills={availableSkillTags}
                loadingSkills={loadingSkillTags}
                disabled={busy}
                onEmail={(email) => change(row.id, { email })}
                onSkills={(skills) => change(row.id, { skills })}
              >
                <label className="sr-only" htmlFor={`role-${row.id}`}>
                  Role {index + 1}
                </label>
                <select
                  id={`role-${row.id}`}
                  value={row.account_role}
                  onChange={(event) => change(row.id, { account_role: event.target.value as InvitedRole })}
                >
                  <option value="member">Member</option>
                  <option value="accounting_staff">Accounting Staff</option>
                </select>
                {rows.length > 1 && (
                  <WorkspaceTooltip content={`Remove person ${index + 1}`}>
                    <button
                      type="button"
                      className="eflow-icon-button"
                      aria-label={`Remove person ${index + 1}`}
                      onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </WorkspaceTooltip>
                )}
              </InvitationPersonFields>
            ))}
          </div>
          {rows.length < 5 && (
            <button
              type="button"
              className="eflow-text-button"
              disabled={busy}
              onClick={() => setRows((current) => [...current, emptyRow()])}
            >
              <Plus size={17} /> Add another person
            </button>
          )}
          {message && (
            <p role="alert" className="eflow-form-error" id="invite-errors">
              {message}
            </p>
          )}
          {receipt && <p role="status">{receipt}</p>}
        </form>
      </Modal>
      {confirmation.dialog}
    </>
  );
}
