// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectReadinessSummary, ProjectReadinessSummaryProvider } from '../../src/app/features/project-readiness';
import { useReadinessSummaryContext } from '../../src/app/features/project-readiness/components/ProjectReadinessSummary';
import type { ProjectReadiness } from '../../src/app/features/project-readiness/types';
const api=vi.hoisted(()=>({readiness:vi.fn()}));
vi.mock('../../src/app/features/project-readiness/services/readinessService',()=>({fetchReadiness:api.readiness}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const snapshot={projectId:'a',stage:'Planning',governed:false,ready:false,canActivate:false,checks:[{key:'dates',ok:true},{key:'structure',ok:false}]};
describe('project readiness summary',()=>{
  it('presents actual confirmed checks and retries only readiness after a failure',async()=>{
    api.readiness.mockRejectedValueOnce(new Error('Readiness request failed')).mockResolvedValueOnce(snapshot);
    render(<ProjectReadinessSummaryProvider projectId="a" refreshKey="1"><ProjectReadinessSummary /></ProjectReadinessSummaryProvider>);
    await screen.findByText('Readiness summary unavailable');fireEvent.click(screen.getByRole('button',{name:'Retry'}));
    await screen.findByText('Planning · 1 of 2 checks confirmed');expect(api.readiness).toHaveBeenCalledTimes(2);expect(api.readiness).toHaveBeenLastCalledWith('a');
  });
  it('ignores a previous project response after switching context',async()=>{
    let previous!:(value:unknown)=>void;api.readiness.mockImplementationOnce(()=>new Promise(resolve=>{previous=resolve;})).mockResolvedValueOnce({...snapshot,projectId:'b',stage:'Active'});
    const view=render(<ProjectReadinessSummaryProvider projectId="a" refreshKey="1"><ProjectReadinessSummary /></ProjectReadinessSummaryProvider>);
    view.rerender(<ProjectReadinessSummaryProvider projectId="b" refreshKey="2"><ProjectReadinessSummary /></ProjectReadinessSummaryProvider>);
    await screen.findByText('Active · 1 of 2 checks confirmed');await act(async()=>previous(snapshot));
    expect(screen.queryByText('Planning · 1 of 2 checks confirmed')).toBeNull();
  });
  it('keeps a newer panel update when an older header request finishes',async()=>{
    let previous!:(value:unknown)=>void;api.readiness.mockImplementationOnce(()=>new Promise(resolve=>{previous=resolve;}));
    function PanelUpdate(){const context=useReadinessSummaryContext()!;return <button onClick={()=>context.update({...snapshot,stage:'Active'} as ProjectReadiness)}>Update panel</button>;}
    render(<ProjectReadinessSummaryProvider projectId="a" refreshKey="1"><ProjectReadinessSummary /><PanelUpdate /></ProjectReadinessSummaryProvider>);
    fireEvent.click(screen.getByRole('button',{name:'Update panel'}));await screen.findByText('Active · 1 of 2 checks confirmed');
    await act(async()=>previous(snapshot));expect(screen.queryByText('Planning · 1 of 2 checks confirmed')).toBeNull();
  });
});
