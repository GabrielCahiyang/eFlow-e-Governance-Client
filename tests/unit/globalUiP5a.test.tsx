// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { administrativePages, buildShellNavigation, getAuthorizedSupportPages, getSupportPageGroup, readNavigationLocation, supportGroupOrder } from '../../src/app/features/navigation';
import { useAccountDirectoryNavigation } from '../../src/app/features/administration/hooks/useAccountDirectoryNavigation';
import { WorkloadBar } from '../../src/app/features/administration/components/user-management/userManagementPrimitives';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });
describe('P5a support contract and actor-local account intent', () => {
  it('distinguishes missing workload from an actual zero workload', () => {
    const view=render(<WorkloadBar value={Number.NaN}/>);expect(screen.getByText('Unavailable')).toBeTruthy();
    view.rerender(<WorkloadBar value={0}/>);expect(screen.queryByText('Unavailable')).toBeNull();expect(screen.getByText('0%')).toBeTruthy();
  });
  it('presents every Admin leaf exactly once using the current support registry', () => {
    const pages=buildShellNavigation({role:'admin',can:()=>true}).filter(item=>item.group==='admin-center').flatMap(item=>item.pages.map(page=>page.label));
    expect(pages).toEqual(administrativePages.map(page=>page.label));
    expect(new Set(pages).size).toBe(11);
    expect(new Set(pages.map(getSupportPageGroup))).toEqual(new Set(supportGroupOrder));
  });
  it('preserves every leaf under a single operational support grant without Admin-only leaves', () => {
    for(const role of ['head','member','accounting_staff']) for(const grant of ['navigation.user_management','navigation.organization','navigation.audit','navigation.system_settings','navigation.data_tools']) {
      const can=(permission:string)=>permission===grant;
      const pages=buildShellNavigation({role,can}).filter(item=>item.group==='admin-center').flatMap(item=>item.pages.map(page=>page.label));
      expect(pages).toEqual(getAuthorizedSupportPages(role,can).map(page=>page.label));
      for(const page of ['Locked out accounts','Role Defaults','User Access'])expect(pages).not.toContain(page);
    }
  });
  it('keeps configuration and legacy support URLs in the existing route owner', () => {
    for(const role of ['admin','head','member','accounting_staff']) for(const page of ['System Settings','Workspace Policy','Email & Integrations','Runtime / AI Health']) {
      window.history.replaceState({},'',`/system-settings?page=${encodeURIComponent(page)}`);
      expect(readNavigationLocation(role,()=>undefined)).toMatchObject({section:role==='admin'?'users':'administration',page});
    }
  });
  it('merges directory updates without overwriting an accepted record handoff', () => {
    const hook=renderHook(()=>useAccountDirectoryNavigation('actor','admin'));
    const update=hook.result.current.update;
    act(()=>update(current=>({...current,selectedUserId:'selected',fromDirectory:true})));
    act(()=>update(current=>({...current,table:{...current.table,search:'retained filter'}})));
    expect(hook.result.current.navigation).toMatchObject({selectedUserId:'selected',fromDirectory:true,table:{search:'retained filter'}});
  });
  it('clears record/filter intent across actor or role changes and rejects old callbacks even after actor return', () => {
    const hook=renderHook(({actor,role})=>useAccountDirectoryNavigation(actor,role),{initialProps:{actor:'first',role:'admin'}});
    const old=hook.result.current.update;
    act(()=>old(current=>({...current,selectedUserId:'private',fromDirectory:true,table:{...current.table,search:'private name'}})));
    hook.rerender({actor:'second',role:'admin'});
    expect(hook.result.current.navigation).toMatchObject({actorId:'second',selectedUserId:'',table:{search:''}});
    act(()=>old(current=>({...current,selectedUserId:'late private'})));
    expect(hook.result.current.navigation.selectedUserId).toBe('');
    hook.rerender({actor:'first',role:'admin'});
    act(()=>old(current=>({...current,selectedUserId:'late after return'})));
    expect(hook.result.current.navigation.selectedUserId).toBe('');
    act(()=>hook.result.current.update(current=>({...current,selectedUserId:'current'})));
    hook.rerender({actor:'first',role:'member'});
    expect(hook.result.current.navigation.selectedUserId).toBe('');
  });
});
