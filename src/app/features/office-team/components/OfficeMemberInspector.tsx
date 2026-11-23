import { useState } from 'react';
import { ArrowRight, Building2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { WorkspaceTabs } from '../../../components/ui/workspace';
import { requestNavigation } from '../../../shared/navigationGuard';
import { ProfessionalProfilePanel } from '../../professional-profile';
import { accountRoleLabel } from '../selectors';
import type { OfficeMember } from '../types';

function memberInitials(name?: string) {
  return (
    (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function OfficeMemberInspector({
  member,
  office,
  onClose,
  onReturnFocus,
}: {
  member?: OfficeMember;
  office: string;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const [tab, setTab] = useState('overview');

  const handleClose = () => {
    void requestNavigation(() => {
      onClose();
      requestAnimationFrame(() => onReturnFocus());
    });
  };

  return (
    <Modal
      isOpen
      title={member ? member.full_name : 'Office member unavailable'}
      description={member ? `${office} · Office account membership` : 'Unable to verify member record'}
      width="max-w-2xl"
      onClose={handleClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {member && tab === 'overview' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void requestNavigation(() => setTab('profile'))}
            >
              Open Professional Profile
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      }
    >
      {member ? (
        <div className="space-y-5">
          {/* Identity Summary Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-sm font-semibold text-[var(--eflow-primary)]"
              >
                {memberInitials(member.full_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--eflow-text)]">
                  {member.full_name}
                </p>
                <p className="truncate text-xs text-[var(--eflow-text-muted)]">
                  {member.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-2.5 py-1 text-xs font-medium text-[var(--eflow-text-secondary)]">
                <ShieldCheck size={13} aria-hidden="true" />
                {accountRoleLabel(member.role)}
              </span>
              <span
                role="status"
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  member.is_active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-[var(--eflow-text-muted)]'
                }`}
              >
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <WorkspaceTabs
            value={tab}
            onValueChange={(next) => void requestNavigation(() => setTab(next))}
            label="Member details"
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: (
                  <div className="space-y-4 pt-3">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5">
                        <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--eflow-text-muted)]">
                          <Mail size={13} aria-hidden="true" />
                          Email address
                        </dt>
                        <dd className="mt-1 break-all text-sm font-medium text-[var(--eflow-text)]">
                          {member.email}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5">
                        <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--eflow-text-muted)]">
                          <Building2 size={13} aria-hidden="true" />
                          Assigned office
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--eflow-text)]">
                          {office}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5">
                        <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--eflow-text-muted)]">
                          <UserRound size={13} aria-hidden="true" />
                          Account role
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--eflow-text)]">
                          {accountRoleLabel(member.role)}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5">
                        <dt className="text-xs font-medium text-[var(--eflow-text-muted)]">
                          Account status
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--eflow-text)]">
                          {member.is_active ? 'Active account' : 'Inactive account'}
                        </dd>
                      </div>
                    </dl>
                    <p className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--eflow-text-secondary)]">
                      Office membership is separate from project participation and task execution teams. Assign task contributors directly inside each project’s Main table or task details.
                    </p>
                  </div>
                ),
              },
              {
                id: 'profile',
                label: 'Professional Profile',
                content:
                  tab === 'profile' ? (
                    <div className="pt-3">
                      <ProfessionalProfilePanel key={member.id} userId={member.id} />
                    </div>
                  ) : null,
              },
            ]}
          />
        </div>
      ) : (
        <FeedbackState tone="warning" title="Member unavailable">
          This member is no longer available in the authorized Office list. Close this dialog and refresh the table.
        </FeedbackState>
      )}
    </Modal>
  );
}
