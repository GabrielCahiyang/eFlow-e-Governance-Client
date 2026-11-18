// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {LoadingScreen} from '../../src/app/features/app-shell/LoadingScreen';
import {ViewLoadingState} from '../../src/app/components/ui/ViewLoadingState';
import {SubtaskWorkDrawer} from '../../src/app/features/subtasks';
import {TaskInspector} from '../../src/app/features/task-inspector';
import {TaskDetailDrawer} from '../../src/app/features/tasks';
import {InspectorSkeleton,DialogSkeleton,CardSectionSkeleton,InlineCellSkeleton} from '../../src/app/components/ui/SurfaceSkeletons';
afterEach(cleanup);
it('shows only the brand, heading and progress track during startup',()=>{
 const {container}=render(<LoadingScreen/>);expect(screen.getByRole('img',{name:'eFlow'})).toBeVisible();expect(screen.getByRole('heading',{name:'Getting things done'})).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent('Getting things done');expect(container.querySelector('.eflow-loading-track')).toBeTruthy();expect(screen.queryByText('LGU Ormoc City')).toBeNull();expect(screen.queryByText('Loading eFlow…')).toBeNull();
});
it('shows an accessible status and a decorative workspace preview for deferred views',()=>{
 const {container}=render(<ViewLoadingState/>);expect(screen.getByRole('status',{name:'Getting things done'})).toHaveAttribute('aria-busy','true');expect(screen.getByRole('img',{name:'eFlow'})).toBeVisible();expect(container.querySelector('.eflow-view-loading__track')).toHaveAttribute('aria-hidden','true');expect(container.querySelector('.eflow-view-loading__skeleton')).toHaveAttribute('aria-hidden','true');expect(container.querySelectorAll('.eflow-view-loading__cards>div')).toHaveLength(4);
});
it('does not render any skeleton when SubtaskWorkDrawer or TaskDetailDrawer is closed',()=>{
 const {container}=render(<>
  <SubtaskWorkDrawer subtask={null} onClose={()=>{}}/>
  <TaskInspector task={null} onClose={()=>{}}/>
  <TaskDetailDrawer task={null} onClose={()=>{}}/>
 </>);
 expect(container.querySelector('.eflow-view-loading')).toBeNull();
 expect(container.firstChild).toBeNull();
});
it('renders scoped non-tab skeletons without the full-tab ViewLoadingState chrome',()=>{
 const {container}=render(<>
  <InspectorSkeleton presentation="dialog" label="Loading subtask details…"/>
  <DialogSkeleton label="Loading staffing…"/>
  <CardSectionSkeleton rows={2} label="Loading funding details…"/>
  <InlineCellSkeleton label="Loading office…"/>
 </>);
 expect(container.querySelector('.eflow-view-loading')).toBeNull();
 expect(screen.getByRole('status',{name:'Loading subtask details…'})).toHaveAttribute('aria-busy','true');
 expect(screen.getByRole('status',{name:'Loading staffing…'})).toHaveAttribute('aria-busy','true');
 expect(screen.getByRole('status',{name:'Loading funding details…'})).toHaveAttribute('aria-busy','true');
 expect(screen.getByRole('status',{name:'Loading office…'})).toHaveAttribute('aria-busy','true');
});
