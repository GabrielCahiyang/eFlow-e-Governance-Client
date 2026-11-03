import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({from:vi.fn(),task:{} as any}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:api.from}}));
import {assertLeadershipReviewReady} from '../../src/app/features/tasks/services/leadershipReviewReadinessService';
beforeEach(()=>{api.from.mockReset();api.from.mockImplementation(()=>({select:()=>({eq:()=>({single:async()=>({data:api.task,error:null})})})}));});
it('uses the server project review route instead of rejecting a Head-owned task in advance',async()=>{
 api.task={assigned_to:'head',org_id:'office',review_route_mode:'organization_default',linked_project_id:'project'};
 await expect(assertLeadershipReviewReady('task')).resolves.toBeUndefined();expect(api.from.mock.calls).toEqual([['tasks']]);
});
