// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';
import {isProjectDraft,isOpenProject} from '../../src/app/features/projects/selectors/projectPublication';
import {rowToProject} from '../../src/app/features/projects/services/projectMappers';
import {DraftPublicationAction} from '../../src/app/features/project-readiness/components/DraftPublicationAction';
import {readinessResolution} from '../../src/app/features/project-readiness/resolution';
import type {Project} from '../../src/app/features/projects/services/types';
afterEach(cleanup);
const project={id:'p',title:'Plan',description:'',status:'planning',priority:'medium',createdAt:0,updatedAt:0} as Project;
const ready={projectId:'p',checks:[],ready:true,canActivate:true,canPublish:true,stage:'Ready to publish',governed:false};
describe('draft-first project publication',()=>{
 it('preserves historical planning projects in Open Projects',()=>{expect(isOpenProject(project)).toBe(true);expect(isProjectDraft(project)).toBe(false);});
 it('keeps an explicit draft out of Open Projects',()=>{expect(isOpenProject({...project,publicationState:'draft'})).toBe(false);expect(isProjectDraft({...project,publicationState:'draft'})).toBe(true);});
 it('shows published projects but not archived projects',()=>{expect(isOpenProject({...project,publicationState:'published',status:'active'})).toBe(true);expect(isOpenProject({...project,status:'archived'})).toBe(false);});
 it('maps publication markers and history without inferring them from status',()=>{expect(rowToProject({id:'p',status:'planning',publication_state:'draft'}).publicationState).toBe('draft');expect(rowToProject({id:'legacy',status:'planning'}).publicationState).toBe('published');expect(rowToProject({published_at:'2026-10-08T00:00:00Z',published_by:'head'}).publishedBy).toBe('head');});
 it('shows specific missing fields and disables publication',()=>{const publish=vi.fn();render(<DraftPublicationAction readiness={{...ready,canActivate:false,ready:false,checks:[{key:'project_description',label:'Project purpose filled in',detail:'Project description/purpose cannot be blank.',ok:false}]}} busy={false} onPublish={publish}/>);expect(screen.getByText(/description\/purpose cannot be blank/)).toBeTruthy();expect((screen.getByRole('button',{name:'Publish project'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Publish project'}));expect(publish).not.toHaveBeenCalled();});
 it('does not give a non-Head a publish button',()=>{render(<DraftPublicationAction readiness={{...ready,canPublish:false}} busy={false} onPublish={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Publish project'})).toBeNull();});
 it('permits the Head to request publication only when ready',()=>{const publish=vi.fn();render(<DraftPublicationAction readiness={ready} busy={false} onPublish={publish}/>);fireEvent.click(screen.getByRole('button',{name:'Publish project'}));expect(publish).toHaveBeenCalledOnce();});
 it('links missing details to their existing editors',()=>{expect(readinessResolution('project_description',false)?.view).toBe('timeline');expect(readinessResolution('task_dates:123',false)?.view).toBe('gantt');expect(readinessResolution('task_name:123',false)?.view).toBe('tasks');});
});
