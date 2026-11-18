import { readableUiError } from '../../../../shared/userFacingError';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { activationLabel, activationRoleLabel, listPendingActivations, manageAccountActivation, type PendingActivation } from '../../../account-activation';
import { useReviewedMutation } from '../../../../shared/useReviewedMutation';
import '../../../account-activation/activation.css';

const deliveryLabel = (value: string | null) => ({ sent: 'Email sent', delivered: 'Delivered', failed: 'Email failed', bounced: 'Email bounced', queued: 'Queued' })[value || ''] || 'Not sent';

export function PendingActivationsTable({
  actorId,
  revision,
  onCountChange,
}: {
  actorId: string;
  revision: number;
  onCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = useState<PendingActivation[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const mounted = useRef(true), generation = useRef(0), [refreshVersion, setRefreshVersion] = useState(0);
  const action = useReviewedMutation(`pending-activations:${actorId}`);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setError('');
    try {
      const result = await listPendingActivations();
      if (!Array.isArray(result.invitations)) throw new Error('Could not load invitations. Please refresh.');
      if (mounted.current && request === generation.current) {
        setRows(result.invitations);
        onCountChange?.(result.invitations.length);
        setRefreshVersion(n => n + 1);
      }
    } catch (reason) {
      if (mounted.current && request === generation.current) {
        setRows([]);
        onCountChange?.(0);
        setError(readableUiError(reason, 'Could not load pending invitations.', 'read'));
      }
    }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, [onCountChange]);
  useEffect(() => { void refresh(); }, [refresh, revision]);
  const manage = async (row: PendingActivation, operation: 'resend' | 'revoke' | 'approve') => {
    const label = operation === 'resend' ? 'Resend email' : operation === 'revoke' ? 'Revoke invitation' : 'Approve account';
    await action.run({
      key: `${row.invitation_id}:${operation}:${refreshVersion}`,
      confirmation: operation === 'resend' ? undefined : {
        title: `${label}?`, actionLabel: label, danger: operation === 'revoke',
        description: operation === 'approve' ? `Give ${row.full_name || row.email} the ${activationRoleLabel(row.requested_privileged_role || row.account_role)} role in ${row.office_name}?`
          : `${row.full_name || row.email} will no longer be able to use this activation link.`,
      },
      operation: async () => {
        if(operation==='resend'&&row.requires_reinvite)throw new Error('Revoke this invitation, then create a new invitation from People & Accounts.');
        const result = await manageAccountActivation(row.invitation_id, operation);
        if (result.email_delivery_status === 'failed' && operation === 'resend') throw new Error(result.delivery_error || 'Invitation saved, but the email failed to send. Verify email gateway settings and retry.');
      },
      success: operation === 'resend' ? 'Activation email sent.' : operation === 'revoke' ? 'Invitation revoked.' : 'Account approved.',
      refresh,
    });
  };
  return <section className="eflow-pending-activations" aria-label="Pending activation">
    <header>
      <div>
        <h2>Pending invitations & role approvals</h2>
        <p>Invited users activate their account from their email link. Privileged roles require Admin approval after verification.</p>
      </div>
      <Button variant="outline" size="sm" disabled={action.pending || loading} onClick={() => void refresh()}>
        <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
        Refresh invitations
      </Button>
    </header>
    {action.dialog}
    {action.message && <FeedbackState tone={action.tone} title={action.tone === 'success' ? 'Saved' : 'Please review'}>{action.message}</FeedbackState>}
    {error ? <FeedbackState tone="error" title="Invitations unavailable" onRetry={() => void refresh()}>{error}</FeedbackState> : loading ? (
      <div role="status" aria-label="Loading invitations…">
        <span className="sr-only">Loading invitations…</span>
        <div className="eflow-pending-scroll" aria-hidden="true">
          <table aria-label="Account activation invitations">
            <thead><tr><th>Person</th><th>Role / Office</th><th>Status</th><th>Email</th><th>Link expires</th><th>Actions</th></tr></thead>
            <tbody>
              {[0, 1, 2].map((index) => (
                <tr key={index}>
                  <td><div className="h-3.5 w-28 animate-pulse rounded bg-neutral-200/80" /><div className="mt-1 h-2.5 w-36 animate-pulse rounded bg-neutral-100" /></td>
                  <td><div className="h-3.5 w-24 animate-pulse rounded bg-neutral-200/80" /><div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-neutral-100" /></td>
                  <td><div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" /></td>
                  <td><div className="h-3 w-16 animate-pulse rounded bg-neutral-100" /></td>
                  <td><div className="h-3 w-24 animate-pulse rounded bg-neutral-100" /></td>
                  <td><div className="eflow-pending-actions"><div className="h-7 w-16 animate-pulse rounded-md bg-neutral-100" /><div className="h-7 w-16 animate-pulse rounded-md bg-neutral-100" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : !rows.length ? <EmptyState illustration="inbox" size="compact" title="No pending invitations or role approvals."/> : <div className="eflow-pending-scroll"><table aria-label="Account activation invitations"><thead><tr><th>Person</th><th>Role / Office</th><th>Status</th><th>Email</th><th>Link expires</th><th>Actions</th></tr></thead><tbody>{rows.map(row => {
      const pending = row.status === 'pending' || row.status === 'expired';
      return <tr key={row.invitation_id}><td>{row.full_name || row.email}<small>{row.full_name ? row.email : 'Name entered at activation'}</small></td><td>{activationRoleLabel(row.requested_privileged_role || row.account_role)}<small>{row.office_name}</small></td><td><span className="eflow-activation-status">{activationLabel(row)}</span>{row.needs_reconciliation && <small>Contact support before resending this invitation.</small>}{pending&&row.requires_reinvite&&<small>Revoke this invitation, then send a new one from your Admin account.</small>}</td><td>{deliveryLabel(row.email_delivery_status)}</td><td className="eflow-tabular">{new Date(row.expires_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td><td><div className="eflow-pending-actions">{pending && <><Button variant="outline" size="sm" disabled={action.pending || loading || row.needs_reconciliation || row.requires_reinvite} onClick={() => void manage(row, 'resend')}><Mail size={13} aria-hidden="true" />Resend</Button><Button variant="ghost" size="sm" className="text-[var(--eflow-negative-text)]" disabled={action.pending || loading} onClick={() => void manage(row, 'revoke')}><XCircle size={13} aria-hidden="true" />Revoke</Button></>}{row.awaiting_authority && <Button size="sm" disabled={action.pending || loading} onClick={() => void manage(row, 'approve')}><ShieldCheck size={13} aria-hidden="true" />Approve role</Button>}</div></td></tr>;
    })}</tbody></table></div>}
  </section>;
}
