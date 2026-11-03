import {expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({snapshot:vi.fn(),tree:vi.fn()}));
vi.mock('../../src/app/features/workspaces',()=>({fetchPersonalProject:api.snapshot}));
vi.mock('../../src/app/features/nested-work',()=>({fetchWorkTree:api.tree,buildWorkNodeDisplayMetadata:()=>new Map(),WorkTreeUnavailable:class extends Error{}}));
import {appendPersonalRows} from '../../src/app/features/personal-work/services/personalWorkSource';
import type {WorkSnapshot} from '../../src/app/features/personal-work/types';
it.each(['in_progress','submitted','done'])('uses the newer personal tree %s status for Leading and History',async status=>{
 api.snapshot.mockResolvedValue({owner:'lead',project:{status:'active',workspace_id:'workspace'},members:[],tasks:[{id:'task',title:'Task',status:'todo',lead_id:'lead'}]});
 api.tree.mockResolvedValue({root:{id:'task',status,open:status==='in_progress'},nodes:[],people:[]});
 const out={rows:[],projects:[{id:'project',kind:'personal',title:'Personal',timezone:'Asia/Manila'}],workspaces:[],issues:[],unavailable:[]} as unknown as WorkSnapshot;
 await appendPersonalRows(out,'lead');
 expect(out.rows[0].status).toBe(status==='done'?'completed':status);
 expect(out.rows[0].personalTask?.status).toBe(status);
 expect(out.rows[0].history).toBe(status==='done');
});
