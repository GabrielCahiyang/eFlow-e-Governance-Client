import {expect,it} from 'vitest';
import {appendOfficeRows} from '../../src/app/features/personal-work/services/officeWorkRows';
import type {Task} from '../../src/app/features/tasks';
import type {WorkSnapshot} from '../../src/app/features/personal-work/types';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {selectWorkRows} from '../../src/app/features/personal-work/workSelectors';
it('keeps pending review visible in Leading as read-only work until completion moves it to History',()=>{
 const row={key:'task',mine:true,leading:true,actionable:false,history:false,status:'for_review',title:'Task',kind:'office-task'} as any;
 expect(selectWorkRows([row],'Leading','All my work')).toEqual([row]);
 const completed={...row,status:'completed',history:true};
 expect(selectWorkRows([completed],'Leading','All my work')).toEqual([]);
 expect(selectWorkRows([completed],'History','All my work')).toEqual([completed]);
});
it.each(['in_progress','for_review','completed'])('uses the newer tree %s status in every personal-work row and its inspector task',status=>{
 const task={id:'task',status:'todo',assigneeId:'lead',teamMemberIds:['lead']} as Task;
 const tree={root:{id:'task',status,open:status==='in_progress'},people:[{id:'lead',eligible:true}],nodes:[]} as unknown as WorkTreeSnapshot;
 const out={rows:[],projects:[],workspaces:[],issues:[],unavailable:[]} as unknown as WorkSnapshot;
 appendOfficeRows(out,'lead',[task],()=>({} as any),new Map([['task',tree]]),new Map(),new Map(),new Set());
 expect(out.rows[0].status).toBe(status);expect(out.rows[0].task?.status).toBe(status);expect(out.rows[0].history).toBe(status==='completed');
});
