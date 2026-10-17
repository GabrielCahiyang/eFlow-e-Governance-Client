import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { activationLabel, activationRoleLabel, listPendingActivations, manageAccountActivation, type PendingActivation } from '../../../account-activation';
import { useReviewedMutation } from '../../../../shared/useReviewedMutation';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import '../../../account-activation/activation.css';

const deliveryLabel = (value: string | null) => ({ sent: 'Email sent', delivered: 'Delivered', failed: 'Email failed', bounced: 'Email bounced', queued: 'Queued' })[value || ''] || 'Not sent';

export function PendingActivationsTable({ actorId, revision }: { actorId: string; revision: number }) {
  const [rows, setRows] = useState<PendingActivation[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const mounted = useRef(true), generation = useRef(0), [refreshVersion, setRefreshVersion] = useState(0);
  const action = useReviewedMutation(`pending-activations:${actorId}`);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setError('');
    try {
      const result = await listPendingActivations();
      if (!Array.isArray(result.invitations)) throw new Error('Could not load invitations. Please refresh.');
      if (mounted.current && request === generation.current) { setRows(result.invitations); setRefreshVersion(n => n + 1); }
    } catch (reason) { if (mounted.current && request === generation.current) { setRows([]); setError(reason instanceof Error ? reason.message : 'Could not load pending invitations.'); } }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh, revision]);
  const manage = async (row: PendingActivation, operation: 'resend' | 'revoke' | 'approve') => {
    const label = operation === 'resend' ? 'Resend email' : operation === 'revoke' ? 'Revoke invitation' : 'Approve account';
    await action.run({
      key: `${row.invitation_id}:${operation}:${refreshVersion}`,
      confirmation: operation === 'resend' ? undefined : {
        title: `${label}?`, actionLabel: label, danger: operation === 'revoke',
        description: operation === 'approve' ? `Give ${row.full_name} the ${activationRoleLabel(row.requested_privileged_role || row.account_role)} role in ${row.office_name}?`
          : `${row.full_name} will no longer be able to use this activation link.`,
      },
      operation: async () => {
        const result = await manageAccountActivation(row.invitation_id, operation);
        if (result.email_delivery_status === 'failed' && operation === 'resend') throw new Error(result.delivery_error || 'Invitation saved, but the email failed. Check the email setup.');
      },
      success: operation === 'resend' ? 'Activation email sent.' : operation === 'revoke' ? 'Invitation revoked.' : 'Account approved.',
      refresh,
    });
  };
  return <section className="eflow-pending-activations" aria-label="Pending activation">
    <header><div><h2>Pending activation</h2><p>People activate their own accounts using the email link.</p></div><Button kind="tertiary" size="small" disabled={action.pending || loading} onClick={() => void refresh()}>Refresh invitations</Button></header>
    {action.dialog}
    {action.message && <FeedbackState tone={action.tone} title={action.tone === 'success' ? 'Saved' : 'Please review'}>{action.message}</FeedbackState>}
    {error ? <FeedbackState tone="error" title="Invitations unavailable" onRetry={() => void refresh()}>{error}</FeedbackState> : loading ? <p role="status">Loading invitations…</p> : !rows.length ? <p>No pending activations.</p> : <div className="eflow-pending-scroll"><table aria-label="Account activation invitations"><thead><tr><th>Person</th><th>Role / Office</th><th>Status</th><th>Email</th><th>Link expires</th><th>Actions</th></tr></thead><tbody>{rows.map(row => {
      const pending = row.status === 'pending' || row.status === 'expired';
      return <tr key={row.invitation_id}><td>{row.full_name}<small>{row.email}</small></td><td>{activationRoleLabel(row.requested_privileged_role || row.account_role)}<small>{row.office_name}</small></td><td><span className="eflow-activation-status">{activationLabel(row)}</span>{row.needs_reconciliation && <small>Activation needs support review before resending.</small>}</td><td>{deliveryLabel(row.email_delivery_status)}</td><td>{new Date(row.expires_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td><td><div className="eflow-pending-actions">{pending && <><Button kind="secondary" size="small" disabled={action.pending || loading || row.needs_reconciliation} onClick={() => void manage(row, 'resend')}>Resend</Button><Button kind="tertiary" color="negative" size="small" disabled={action.pending || loading} onClick={() => void manage(row, 'revoke')}>Revoke</Button></>}{row.awaiting_authority && <Button kind="primary" size="small" disabled={action.pending || loading} onClick={() => void manage(row, 'approve')}>Approve role</Button>}</div></td></tr>;
    })}</tbody></table></div>}
  </section>;
}
