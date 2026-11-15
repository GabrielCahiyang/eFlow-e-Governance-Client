import {expect,it} from 'vitest';
import {pendingTaskDependencies,taskStartBlocker} from '../../src/app/features/tasks/selectors/dependencyReadiness';
import type {Task} from '../../src/app/features/tasks/taskTypes';
it('requires approved prerequisites, treating missing, cancelled and unreviewed work as incomplete',()=>{
 const tasks=[{id:'done',status:'completed'},{id:'review',status:'for_review'},{id:'cancelled',status:'cancelled'}] as Task[];
 expect(pendingTaskDependencies({dependencyIds:['done','review','cancelled','missing']},tasks)).toEqual(['review','cancelled','missing']);
 expect(pendingTaskDependencies({},tasks)).toEqual([]);
});
it('permits a scheduled or overdue Start only when every selected prerequisite is completed',()=>{
 const today=new Date('2026-11-15T00:00:00Z');
 expect(taskStartBlocker({startDate:'2026-11-15',dependencyIds:[]},[],today)).toBeNull();
 expect(taskStartBlocker({startDate:'2026-11-14',dependencyIds:['done']},[{id:'done',status:'completed'}] as Task[],today)).toBeNull();
 expect(taskStartBlocker({startDate:'2026-11-16'},[],today)).toContain('on or after');
 expect(taskStartBlocker({},[],today)).toContain('Set a planned start');
 expect(taskStartBlocker({startDate:'invalid'},[],today)).toContain('Set a planned start');
 for(const status of ['todo','for_review','cancelled'])expect(taskStartBlocker({startDate:'2026-11-14',dependencyIds:['selected']},[{id:'selected',status}] as Task[],today)).toContain('prerequisite');
 expect(taskStartBlocker({startDate:'2026-11-14',dependencyIds:['missing']},[],today)).toContain('prerequisite');
});
