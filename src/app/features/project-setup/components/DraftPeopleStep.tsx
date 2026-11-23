import '../../project-offices/projectOffices.css';
import '../../../../styles/people-management.css';
import '../../project-offices/memberEditing.css';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import type { UserProfile } from '../../../types';
import {
  MemberWorkloadModal,
  WorkloadStatusTag,
  type MemberWorkloadSummary,
} from '../../workload';

export function DraftPeopleStep({
  profiles,
  profilesLoading = false,
  orgId,
  projectLeadId,
  selectedIds,
  disabled = false,
  disabledReason = '',
  workloadByUser,
  onToggle,
}: {
  profiles: UserProfile[];
  profilesLoading?: boolean;
  orgId?: string;
  projectLeadId?: string;
  selectedIds: string[];
  disabled?: boolean;
  disabledReason?: string;
  workloadByUser: Map<string, MemberWorkloadSummary>;
  onToggle: (userId: string, checked: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const officeProfiles = useMemo(
    () =>
      profiles
        .filter(
          (person) =>
            (!orgId || person.org_id === orgId) &&
            (person.is_active !== false || selectedIds.includes(person.id) || person.id === projectLeadId) &&
            !['admin', 'super_admin', 'viewer'].includes(person.role),
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' })),
    [profiles, orgId, selectedIds, projectLeadId],
  );

  const people = useMemo(
    () =>
      normalizedQuery
        ? officeProfiles.filter((person) =>
            `${person.full_name} ${person.email}`.toLowerCase().includes(normalizedQuery),
          )
        : officeProfiles,
    [officeProfiles, normalizedQuery],
  );

  const effectiveSelectedIds = useMemo(() => {
    const validIds = new Set(officeProfiles.map((person) => person.id));
    const result = new Set<string>();
    if (projectLeadId && validIds.has(projectLeadId)) result.add(projectLeadId);
    for (const id of selectedIds) {
      if (validIds.has(id)) result.add(id);
    }
    return [...result];
  }, [officeProfiles, projectLeadId, selectedIds]);

  const additionalCount = effectiveSelectedIds.filter((id) => id !== projectLeadId).length;

  const selectedOverloaded = useMemo(
    () =>
      selectedIds
        .filter((id) => id !== projectLeadId)
        .map((userId) => workloadByUser.get(userId))
        .filter((item): item is MemberWorkloadSummary => Boolean(item && item.tier === 'overloaded')),
    [selectedIds, projectLeadId, workloadByUser],
  );

  const name = (id: string) => profiles.find((person) => person.id === id)?.full_name || 'Office member';

  return (
    <section className="po-setup-people" aria-label="Add people to project">
      <h2>Add people</h2>
      {disabledReason ? (
        <p role="status" className="po-help">
          {disabledReason}
        </p>
      ) : profilesLoading ? (
        <p role="status" className="po-help">
          Loading office members…
        </p>
      ) : (
        <div className="po-member-editor" aria-label="Own Office project team">
          <p className="po-help">
            Select office members to join this project (optional). Your selections stay saved across tabs and apply
            automatically when project setup finishes.
          </p>
          <label className="po-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              className="po-search"
              aria-label="Search Office members"
              placeholder="Search office members"
              maxLength={INPUT_LIMITS.SEARCH}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="po-member-list po-member-access-list">
            <div className="po-member-access-heading">
              <span>Office members</span>
              <span>Workload</span>
              <span>Team status</span>
            </div>
            {people.map((person) => {
              const isLead = Boolean(projectLeadId && person.id === projectLeadId);
              const included = isLead || selectedIds.includes(person.id);
              const memberLoad = workloadByUser.get(person.id);
              return (
                <div className="po-member-access-row" data-selected={included || undefined} key={person.id}>
                  <label className="po-member-access-person">
                    <input
                      type="checkbox"
                      aria-label={`Include ${person.full_name}`}
                      checked={included}
                      disabled={disabled || isLead || person.is_active === false}
                      onChange={(event) => onToggle(person.id, event.target.checked)}
                    />
                    <span className="po-avatar">
                      {person.full_name
                        .split(' ')
                        .filter(Boolean)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span>
                      <strong>{person.full_name}</strong>
                      <small>{person.email}</small>
                    </span>
                    <span className="po-member-account-role">
                      {person.role === 'head'
                        ? 'Head'
                        : person.role === 'accounting_staff'
                          ? 'Accounting Staff'
                          : 'Member'}
                    </span>
                  </label>
                  <div className="po-member-workload-cell">
                    {memberLoad ? (
                      <WorkloadStatusTag
                        tier={memberLoad.tier}
                        loadPoints={memberLoad.loadPoints}
                        compact
                        onClick={() => setInspectUserId(person.id)}
                        title={`Inspect ${person.full_name}'s workload breakdown`}
                      />
                    ) : (
                      <span className="po-member-edit-head" aria-hidden="true">
                        —
                      </span>
                    )}
                  </div>
                  <span className="po-member-edit-head">
                    {isLead ? 'Project Lead' : included ? 'Selected' : '—'}
                  </span>
                </div>
              );
            })}
            {!people.length && (
              <p className="po-member-empty">
                {normalizedQuery
                  ? 'No active office members match your search.'
                  : 'No active office members available to select yet.'}
              </p>
            )}
          </div>

          {selectedOverloaded.length > 0 && (
            <div className="wl-panel wl-panel--overloaded" role="status">
              <div className="wl-panel__head">
                <div className="min-w-0">
                  <strong className="wl-panel__title">
                    {selectedOverloaded.length === 1
                      ? `${selectedOverloaded[0].fullName} is currently overloaded`
                      : `${selectedOverloaded.length} selected members are currently overloaded`}
                  </strong>
                  <p className="wl-panel__subtitle">
                    You can still enroll them on the project roster, but avoid assigning them as Task Lead without
                    reviewing their active load first.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedOverloaded.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      className="wl-alt-card__btn"
                      onClick={() => setInspectUserId(member.userId)}
                    >
                      View {member.fullName.split(' ')[0]}&apos;s load ({member.loadPoints.toFixed(1)} pts)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <footer>
            <span className="po-member-summary" aria-live="polite">
              {effectiveSelectedIds.length} selected
              {additionalCount > 0
                ? ` · +${additionalCount} added (saved automatically when setup finishes)`
                : ' · Optional — select additional members or continue to Draft tasks'}
            </span>
          </footer>
        </div>
      )}

      {inspectUserId && (
        <MemberWorkloadModal
          open
          userId={inspectUserId}
          userName={name(inspectUserId)}
          orgId={orgId}
          onClose={() => setInspectUserId(null)}
        />
      )}
    </section>
  );
}
