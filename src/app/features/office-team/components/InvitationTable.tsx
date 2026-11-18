import { MoreHorizontal } from 'lucide-react';
import { ActionMenu, StatusPill } from '../../../components/ui/workspace';
import {
  deliveryLabel,
  invitationCanManage,
  invitationValidity,
  type Invitation,
} from '../../invitations';
import { accountRoleLabel } from '../selectors';

export function InvitationTable({
  rows,
  busy,
  canManage,
  onAction,
}: {
  rows: Invitation[];
  busy: string;
  canManage: boolean;
  onAction: (item: Invitation, action: 'resend' | 'copy' | 'revoke') => void;
  onPds?: (item: Invitation, file: File) => void;
}) {
  return (
    <div className="eflow-team-table-wrap">
      <table className="eflow-team-table eflow-invitation-table">
        <caption className="sr-only">
          Office invitations — validity and email delivery are separate
        </caption>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Account role</th>
            <th scope="col">Invitation validity</th>
            <th scope="col">Email delivery</th>
            <th scope="col">Invited</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const validity = invitationValidity(item);
            return (
              <tr key={item.id}>
                <th scope="row">{item.email}</th>
                <td data-label="Account role">
                  <span className="eflow-role-badge">
                    {accountRoleLabel(item.account_role)}
                  </span>
                </td>
                <td data-label="Invitation validity">
                  <StatusPill
                    label={validity[0].toUpperCase() + validity.slice(1)}
                    tone={
                      validity === 'accepted'
                        ? 'positive'
                        : validity === 'revoked'
                          ? 'negative'
                          : 'warning'
                    }
                  />
                </td>
                <td data-label="Email delivery">
                  {deliveryLabel(item)}
                  {item.email_delivery_status === 'failed' && (
                    <small className="eflow-delivery-failed">
                      Invitation may still be valid · resend delivery
                    </small>
                  )}
                </td>
                <td data-label="Invited">
                  {new Date(item.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </td>
                <td data-label="Actions">
                  {canManage && invitationCanManage(item) ? (
                    <div className="eflow-invitation-actions">
                      <ActionMenu tooltip="Invitation actions"
                        trigger={
                          <button
                            className="eflow-icon-button"
                            aria-label={`Manage invitation for ${item.email}`}
                            disabled={Boolean(busy)}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        }
                        actions={[
                          {
                            id: 'resend',
                            label: 'Resend invitation',
                            onSelect: () => onAction(item, 'resend'),
                          },
                          {
                            id: 'copy',
                            label: 'Copy fresh link (replaces old link)',
                            onSelect: () => onAction(item, 'copy'),
                          },
                          {
                            id: 'revoke',
                            label: 'Revoke invitation',
                            onSelect: () => onAction(item, 'revoke'),
                          },
                        ]}
                      />
                      {busy === item.id && (
                        <span role="status" className="eflow-invite-help">
                          Working…
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="eflow-invite-help">
                      {canManage
                        ? 'No pending action'
                        : 'Only the appointed own-Office Head can manage invitations.'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
