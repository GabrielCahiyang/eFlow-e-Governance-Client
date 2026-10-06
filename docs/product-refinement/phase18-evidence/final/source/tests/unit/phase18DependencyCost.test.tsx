// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DependencyCell} from '../../src/app/features/project-table/components/DependencyCell';
import type {Task} from '../../src/app/features/tasks';
afterEach(cleanup);
it('does not construct choices for a closed editor, then reads current choices when opened',async()=>{
 const task:Task={id:'task',title:'Assessment',orgId:'office',status:'todo',createdAt:1,updatedAt:1};
 const choices=[task,{...task,id:'other',title:'Briefing'}];
 const filtered=vi.spyOn(choices,'filter');
 render(<DependencyCell task={task} tasks={choices} disabled={false} save={vi.fn()}/>);
 expect(filtered).not.toHaveBeenCalled();expect(screen.queryByRole('checkbox')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Edit dependencies for Assessment'}));
 expect(await screen.findByRole('checkbox',{name:'Briefing'})).toBeTruthy();
 expect(filtered).toHaveBeenCalled();
});
