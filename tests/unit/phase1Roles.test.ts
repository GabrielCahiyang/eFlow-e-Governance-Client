import {describe,expect,it} from 'vitest';
import {normalizeUserRole,getRoleLabel} from '../../src/app/shared/roles';
import {resolvePermissions,MANAGED_ROLES} from '../../src/app/features/permissions';
import {getRoleNavigation} from '../../src/app/features/navigation/roleNavigation';

describe('Phase 1 account authority',()=>{
 it.each([['super_admin','admin'],['dept_head','head'],['department_head','head'],['assistant_head','member'],['employee','member'],['accounting_staff','accounting_staff']])('normalizes %s at the boundary', (input,output)=>expect(normalizeUserRole(input)).toBe(output));
 it.each(['executive','legislative','hrmo','finance','councilor_pad','task_lead','team_leader','toString','__proto__',null,42])('fails closed for unsupported identity %s',role=>expect(()=>normalizeUserRole(role)).toThrow('Unsupported account role'));
 it('keeps exactly four managed account roles',()=>expect(MANAGED_ROLES.map(r=>r.key)).toEqual(['admin','head','accounting_staff','member']));
 it('never turns Admin overrides into operational authority',()=>{
  const permissions=resolvePermissions('admin',[{role:'admin',permission:'projects.create',allowed:true}],[{userId:'admin',permission:'tasks.verify',allowed:true}]);
  expect(permissions.has('users.manage')).toBe(true);
  for(const p of ['projects.create','tasks.assign','tasks.verify','accounting.release_cash','navigation.projects']) expect(permissions.has(p)).toBe(false);
  expect(getRoleNavigation('admin').navItems.map(i=>i.id)).toEqual(['users']);
 });
 it('separates Head financial authorization from Accounting execution',()=>{
  const head=resolvePermissions('head',[],[]),accounting=resolvePermissions('accounting_staff',[],[]);
  expect(head.has('navigation.department_budgets')).toBe(true);
  for(const p of ['accounting.release_cash','accounting.settle_liquidation','accounting.post_journal']){
   expect(head.has(p)).toBe(false);expect(accounting.has(p)).toBe(true);
  }
  expect(getRoleLabel('assistant_head')).toBe('Member');
 });
});
