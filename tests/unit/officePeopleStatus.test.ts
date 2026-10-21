import {describe,expect,it,vi} from 'vitest';
vi.mock('../../src/lib/supabase',()=>({supabase:{}}));
vi.mock('../../src/app/features/project-invitations',()=>({}));
import {officePersonStatus,type OfficePerson} from '../../src/app/features/project-offices/services/officePeople';
function person(state:string,delivery_status:string,extras:Record<string,unknown>={}){
 return {active:false,invitation:{state,delivery_status,...extras}} as OfficePerson;
}
describe('project Office invitation receipts',()=>{
 it('does not label an unattempted or failed delivery as sent',()=>{
  expect(officePersonStatus(person('approved','not_attempted'))).toBe('Ready to send');
  expect(officePersonStatus(person('approved','attempting'))).toBe('Sending invitation');
  expect(officePersonStatus(person('approved','failed'))).toBe('Invite failed');
  expect(officePersonStatus(person('approved','provider_accepted'))).toBe('Invite pending');
 });
 it('distinguishes expiry, withdrawal and ended access from active participation',()=>{
  expect(officePersonStatus(person('approved','provider_accepted',{expires_at:'2020-01-01'}))).toBe('Invitation expired');
  expect(officePersonStatus(person('revoked','provider_accepted'))).toBe('Invitation revoked');
  expect(officePersonStatus(person('accepted','provider_accepted'))).toBe('Access ended');
  expect(officePersonStatus({...person('accepted','provider_accepted'),active:true})).toBe('Joined');
 });
});
