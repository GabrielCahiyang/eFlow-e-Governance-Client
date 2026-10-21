import {expect,it} from 'vitest';
import {pendingTaskDependencies} from '../../src/app/features/tasks/selectors/dependencyReadiness';
import type {Task} from '../../src/app/features/tasks/taskTypes';
it('requires approved prerequisites, treating missing, cancelled and unreviewed work as incomplete',()=>{
 const tasks=[{id:'done',status:'completed'},{id:'review',status:'for_review'},{id:'cancelled',status:'cancelled'}] as Task[];
 expect(pendingTaskDependencies({dependencyIds:['done','review','cancelled','missing']},tasks)).toEqual(['review','cancelled','missing']);
 expect(pendingTaskDependencies({},tasks)).toEqual([]);
});
