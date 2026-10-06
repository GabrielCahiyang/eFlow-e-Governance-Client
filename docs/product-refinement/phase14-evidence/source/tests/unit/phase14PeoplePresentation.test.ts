import { describe, expect, it } from 'vitest';
import { filterOfficeMembers, isAppointedOfficeHead } from '../../src/app/features/office-team/selectors';
import { deliveryLabel, invitationValidity, invitationCanManage } from '../../src/app/features/invitations/presentation';
import type { Invitation } from '../../src/app/features/invitations';
import type { Organization, UserProfile } from '../../src/app/types';
const user = { id: 'head', org_id: 'own', role: 'head', is_active: true } as UserProfile;
const organizations = [{ id: 'own', head_user_id: 'head' }] as Organization[];
describe('Phase 14 account and invitation presentation', () => {
 it('only grants invitation management to an active appointed own-Office Head', () => {
  expect(isAppointedOfficeHead(user, organizations)).toBe(true);
  for (const role of ['member', 'admin', 'accounting_staff']) expect(isAppointedOfficeHead({ ...user, role } as UserProfile, organizations)).toBe(false);
  for (const patch of [{ is_active: false }, { org_id: 'foreign' }, { id: 'other' }]) expect(isAppointedOfficeHead({ ...user, ...patch }, organizations)).toBe(false);
 });
 it('filters active members using account roles and normalized name/email search', () => {
  const members = [{ id: 'm', full_name: 'Maria', email: 'm@example.test', role: 'member', is_active: true }, { id: 'a', full_name: 'Ana', email: 'a@example.test', role: 'accounting_staff', is_active: true }, { id: 'old', full_name: 'Maria', email: 'old@example.test', role: 'member', is_active: false }];
  expect(filterOfficeMembers(members, ' MARIA ', 'all').map(m => m.id)).toEqual(['m']); expect(filterOfficeMembers(members, 'example', 'accounting_staff').map(m => m.id)).toEqual(['a']);
 });
 it('never infers invalidity from delivery failure and computes expiry independently', () => {
  const item = { status: 'pending', email_delivery_status: 'failed', expires_at: '2030-01-01' } as Invitation;
  expect(invitationValidity(item, Date.parse('2026-01-01'))).toBe('pending'); expect(deliveryLabel(item)).toBe('Failed'); expect(invitationCanManage(item)).toBe(true);
  expect(invitationValidity(item, Date.parse('2031-01-01'))).toBe('expired'); expect(invitationValidity({ ...item, status: 'revoked' })).toBe('revoked'); expect(invitationCanManage({ ...item, status: 'accepted' })).toBe(false);
 });
});
