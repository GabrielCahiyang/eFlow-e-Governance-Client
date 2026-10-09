// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const events=vi.hoisted(()=>({files:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:()=>{const query={select:()=>query,eq:()=>query,order:async()=>({data:[{id:'status',to_status:'in_progress',actor_name:'Lead',created_at:'2026-10-01'}],error:null})};return query;},channel:()=>{const channel={on:()=>channel,subscribe:()=>channel};return channel;},removeChannel:vi.fn()}}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({subscribeToProgressUpdates:(_task:string,callback:(rows:unknown[])=>void)=>{callback([{id:'progress',authorName:'Contributor',note:'Progress note',createdAt:new Date('2026-10-02').getTime()}]);return()=>{};}}));
vi.mock('../../src/app/features/project-files',()=>({fetchProjectFileEvents:events.files}));
import {TaskActivityTimeline} from '../../src/app/components/workflow/TaskActivityTimeline';
beforeEach(()=>{events.files.mockReset();});afterEach(cleanup);
it('merges immutable document events into the chronological workflow history',async()=>{
 events.files.mockResolvedValue([{id:'file',action:'linked',actorName:'Document author',at:new Date('2026-10-03').getTime()}]);
 const {container}=render(<TaskActivityTimeline taskId="task" projectId="project"/>);await screen.findByText('Document author');await screen.findByText('Progress note');
 expect(events.files).toHaveBeenCalledWith('project','task');
 const text=container.textContent!;expect(text.indexOf('Document author')).toBeLessThan(text.indexOf('Contributor'));expect(text.indexOf('Contributor')).toBeLessThan(text.indexOf('Lead'));
});
it('retains existing workflow history when the additive file history service is unavailable',async()=>{
 events.files.mockRejectedValue(new Error('Project file history unavailable'));
 render(<TaskActivityTimeline taskId="task" projectId="project"/>);await screen.findByRole('alert');await waitFor(()=>expect(screen.getByText('Progress note')).toBeTruthy());expect(screen.getByText('Lead')).toBeTruthy();expect(screen.getByRole('button',{name:'Retry file history'})).toBeTruthy();
});
