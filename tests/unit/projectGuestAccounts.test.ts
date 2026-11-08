import { expect, it } from 'vitest';
import { guestMatches, guestStatus, isTemporaryGuestProfile, type ProjectGuest } from '../../src/app/features/administration/guests/types';
const now = Date.parse('2026-11-09T00:00:00Z');
const guest: ProjectGuest = {user_id:'guest',full_name:'Guest',email:'guest@example.test',sponsor_office:'Office',is_active:true,projects:[],unassigned_since:null,deactivates_at:new Date(now+86400000).toISOString(),deactivated_at:null,deactivation_reason:null,registered_at:'2026-11-01',finance_open:false};
it('treats project membership separately from task assignment and activity', () => {
  expect(guestMatches(guest,'unassigned',now)).toBe(true);
  expect(guestMatches(guest,'active',now)).toBe(true);
  const assigned = {...guest, projects:[{id:'project',title:'On-hold project'}]};
  expect(guestMatches(assigned,'active',now)).toBe(true);
  expect(guestMatches(assigned,'soon',now)).toBe(false);
  expect(guestStatus(assigned,now).label).toBe('Active');
});
it('shows the countdown, financial hold and inactive state clearly', () => {
  expect(guestStatus(guest,now).label).toBe('Deactivates in 1 day');
  expect(guestMatches(guest,'soon',now)).toBe(true);
  expect(guestStatus({...guest,finance_open:true},now).label).toContain('Cleanup paused');
  expect(guestMatches({...guest,finance_open:true},'soon',now)).toBe(false);
  expect(guestStatus({...guest,is_active:false},now).label).toBe('Deactivated');
  expect(guestStatus({...guest,deactivates_at:new Date(now-1).toISOString()},now).label).toBe('Deactivation due');
});
it('protects permanent employee and Admin accounts even when they joined by invitation', () => {
  const profile = {id:'user',employee_id:'GUEST-user',org_id:null,role:'member'};
  expect(isTemporaryGuestProfile(profile)).toBe(true);
  expect(isTemporaryGuestProfile({...profile,org_id:'LEDIPO'})).toBe(false);
  expect(isTemporaryGuestProfile({...profile,role:'admin'})).toBe(false);
  expect(isTemporaryGuestProfile({...profile,employee_id:'EMP-user'})).toBe(false);
});
