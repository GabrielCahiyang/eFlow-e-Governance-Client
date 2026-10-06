import { useEffect, useRef, useState } from 'react';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { resendInvitation, revokeInvitation } from '../services/invitationService';
import { invitationCanManage } from '../presentation';
import type { Invitation } from '../types';
export function useInvitationManagement(scope: string, refresh: () => Promise<void>) {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [receipt, setReceipt] = useState(''), [freshLink, setFreshLink] = useState('');
  const pending = useRef(false), currentScope = useRef(scope); currentScope.current = scope;
  const confirmation = useConfirmation();
  useEffect(() => { currentScope.current = scope; setBusy(''); setFreshLink(''); setError(''); setReceipt(''); return () => { currentScope.current = ''; }; }, [scope]);
  async function manage(item: Invitation, action: 'resend' | 'copy' | 'revoke', allowed: () => boolean) {
    if (pending.current || !allowed() || !invitationCanManage(item)) return;
    pending.current = true;
    const origin = scope;
    try {
      const accepted = await confirmation.confirm({ title: action === 'revoke' ? 'Revoke invitation?' : action === 'copy' ? 'Create a fresh invitation link?' : 'Resend invitation?',
        description: `${item.email} · ${item.invitation_type?.startsWith('project_office') ? 'project Office participation' : item.account_role === 'accounting_staff' ? 'Accounting Staff' : 'Member'}. ${action === 'revoke' ? 'This link will stop working. Existing accepted memberships are unchanged.' : 'The previous link will stop working. Account roles and project access stay as invited.'}`,
        actionLabel: action === 'revoke' ? 'Revoke invitation' : action === 'copy' ? 'Create fresh link' : 'Resend invitation', danger: action === 'revoke' });
      if (!accepted || currentScope.current !== origin || !allowed()) return;
      setBusy(item.id); setError(''); setReceipt(''); setFreshLink('');
      const result = action === 'revoke' ? await revokeInvitation(item.id) : await resendInvitation(item.id, action === 'copy');
      if (currentScope.current !== origin) return;
      setReceipt(`${item.email}: ${action === 'revoke' ? 'invitation revoked.' : 'invitation renewed; the previous link is invalid.'}`);
      if (result.delivery_error) setError(`Invitation exists. Email delivery failed: ${result.delivery_error} Use Resend to retry delivery.`);
      if (action === 'copy' && result.invitation_url) {
        setFreshLink(result.invitation_url);
        try { await navigator.clipboard.writeText(result.invitation_url); }
        catch { if (currentScope.current === origin) setError('Invitation renewed. Clipboard copy failed; select and copy the fresh link below.'); }
      }
      if (currentScope.current !== origin) return;
      // Delivery and clipboard failures must still refresh authoritative validity.
      try { await refresh(); } catch { if (currentScope.current === origin) setError('Invitation action saved. Refresh the list to see its current status.'); }
    } catch (reason) { if (currentScope.current === origin) setError((reason as Error).message || 'Invitation action failed.'); }
    finally { pending.current = false; if (currentScope.current === origin) setBusy(''); }
  }
  return { busy, error, receipt, freshLink, manage, confirmation: confirmation.dialog, clearLink: () => setFreshLink('') };
}
