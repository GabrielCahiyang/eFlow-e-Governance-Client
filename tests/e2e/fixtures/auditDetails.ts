export const auditDetailRows = () => [
  {
    id: 'audit-access-change-2026-0001', actor_id: 'actor', actor_name: 'Maria Cristina de los Santos',
    entity_type: 'profile', entity_id: 'directory-person-reference-2026-0001', action: 'profile.updated',
    org_id: '10000000-0000-4000-8000-000000000001', created_at: '2026-10-17T08:30:00Z',
    reason: 'Moved to the project coordination team after the approved staffing review. The previous assignment remains part of the audit history.',
    before_data: { role: 'member', office_assignment: 'Community programme support', notes: 'Original assignment. '.repeat(25), settings: { secret: 'before-private-secret', notifications: true } },
    after_data: { role: 'head', office_assignment: 'LEDIPO project coordination and investment support', notes: 'Updated coordination responsibilities. '.repeat(25), settings: { secret: 'after-private-secret', notifications: false } },
    metadata: { source: 'Account management', authorization: { api_key: 'metadata-private-secret', ordinary: 'Approved administrative change' }, pds: { address: 'private-home-address' } },
  },
  { id: 'audit-action-only', actor_name: 'System', entity_type: 'profile', action: 'account.activation_sent', created_at: '2026-10-17T08:00:00Z' },
];
