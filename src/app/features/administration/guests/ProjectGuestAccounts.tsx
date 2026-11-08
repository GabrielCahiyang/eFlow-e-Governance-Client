import { useState, type ReactNode } from 'react';
import { Clock3, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { isAdminRole } from '../../../shared/roles';
import { Button } from '../../../components/ui/button';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useProjectGuests } from './useProjectGuests';
import { GuestAccountDialog } from './GuestAccountDialog';
import { guestMatches, guestStatus, type GuestFilter, type ProjectGuest } from './types';
import './projectGuests.css';

export function AccountDirectoryTabs({children}: {children: ReactNode}) {
  const {userProfile} = useAuth();
  const admin = isAdminRole(userProfile?.role);
  const [tab, setTab] = useState<'office' | 'guests'>('office');
  if (!admin) return <>{children}</>;
  return <><div className="guest-directory-tabs" role="tablist" aria-label="Account type">
    <button type="button" role="tab" aria-selected={tab === 'office'} onClick={() => void requestNavigation(() => setTab('office'))}><UsersRound size={17}/>Office accounts</button>
    <button type="button" role="tab" aria-selected={tab === 'guests'} onClick={() => void requestNavigation(() => setTab('guests'))}><UserRoundCheck size={17}/>Project guests</button>
  </div><div role="tabpanel" aria-label={tab === 'office' ? 'Office accounts' : 'Project guests'}>{tab === 'office' ? children : <ProjectGuestAccounts key={userProfile?.id}/>}</div></>;
}

function ProjectGuestAccounts() {
  const {userProfile} = useAuth();
  const state = useProjectGuests(userProfile?.id || '', isAdminRole(userProfile?.role));
  const [filter, setFilter] = useState<GuestFilter>('all'), [notice, setNotice] = useState('');
  const [selection, setSelection] = useState<{guest: ProjectGuest; mode: 'details' | 'activate' | 'deactivate'}>();
  const columns: Column<ProjectGuest>[] = [
    {key: 'full_name', header: 'Person', sortable: true, sortValue: g => g.full_name, render: g => <div><strong>{g.full_name}</strong><small className="guest-secondary">{g.email}</small></div>},
    {key: 'sponsor', header: 'Sponsoring office', render: g => g.sponsor_office},
    {key: 'projects', header: 'Active projects', render: g => g.projects.length ? <ul>{g.projects.map(p => <li key={p.id}>{p.title}</li>)}</ul> : <span className="guest-secondary">No active project</span>},
    {key: 'status', header: 'Status', render: g => <span className="guest-status" data-tone={guestStatus(g).tone}>{guestStatus(g).label}</span>},
    {key: 'deadline', header: 'Deactivation', render: g => !g.is_active ? g.deactivated_at ? new Date(g.deactivated_at).toLocaleDateString() : 'Deactivated' : g.finance_open && !g.projects.length ? 'Paused until cash is settled' : g.deactivates_at ? new Date(g.deactivates_at).toLocaleString() : 'No countdown'},
    {key: 'actions', header: 'Actions', action: true, render: guest => <div className="guest-row-actions"><Button size="sm" variant="outline" onClick={() => setSelection({guest, mode: 'details'})}>View details</Button><Button size="sm" variant={guest.is_active ? 'outline' : 'default'} disabled={guest.is_active && guest.finance_open} title={guest.is_active && guest.finance_open ? 'Settle the open cash responsibility first.' : undefined} onClick={() => setSelection({guest, mode: guest.is_active ? 'deactivate' : 'activate'})}>{guest.is_active ? 'Deactivate' : 'Reactivate'}</Button></div>},
  ];
  const stats = [{filter: 'active', label: 'Active guests', icon: UserRoundCheck}, {filter: 'unassigned', label: 'Awaiting assignment', icon: UsersRound}, {filter: 'soon', label: 'Deactivating soon', icon: Clock3}, {filter: 'deactivated', label: 'Deactivated', icon: ShieldCheck}] as const;
  return <section className="guest-accounts" aria-label="Project guest accounts">
    <header><h2>Project guests</h2><p>Temporary project accounts. After 7 days without an active project, login is deactivated. Work and history are kept.</p></header>
    <div className="guest-stats">{stats.map(stat => <button type="button" key={stat.filter} aria-pressed={filter === stat.filter} onClick={() => setFilter(current => current === stat.filter ? 'all' : stat.filter)}><stat.icon size={19}/><span>{stat.label}<strong>{state.loading ? '—' : state.data.filter(g => guestMatches(g, stat.filter)).length}</strong></span></button>)}</div>
    {notice && <FeedbackState tone="success" title="Account updated">{notice}</FeedbackState>}
    {state.error && state.data.length > 0 && <FeedbackState tone="error" title="Guest list could not update">{state.error}</FeedbackState>}
    <div className="guest-filter"><label>Show<select aria-label="Guest status filter" value={filter} onChange={e => setFilter(e.target.value as GuestFilter)}><option value="all">All project guests</option>{stats.map(s => <option value={s.filter} key={s.filter}>{s.label}</option>)}</select></label><small>Updates automatically · Accounts with open cash are protected.</small></div>
    <DataTable data={state.data.filter(g => guestMatches(g, filter))} columns={columns} keyExtractor={g => g.user_id} loading={state.loading} error={!state.data.length ? state.error : undefined} onRetry={() => void state.refresh()} searchPlaceholder="Search guest name, email, office or project" searchFilter={(g, q) => [g.full_name, g.email, g.sponsor_office, ...g.projects.map(p => p.title)].join(' ').toLowerCase().includes(q.toLowerCase())} ariaLabel="Project guests table" emptyMessage="No project guests match this view." emptyIllustration="people"/>
    {selection && <GuestAccountDialog key={selection.guest.user_id + selection.mode} {...selection} onClose={() => setSelection(undefined)} onSaved={() => {setNotice(selection.mode === 'activate' ? 'Guest login reactivated. Assign an active project within 7 days.' : 'Guest account deactivated. Work and history were kept.'); setSelection(undefined); void state.refresh();}}/>}
  </section>;
}
