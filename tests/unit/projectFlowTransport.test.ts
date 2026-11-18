import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({
 rpc:vi.fn(),
 removeChannel:vi.fn(),
 channelHandlers:[] as Array<{table:string;callback:()=>void}>,
 subscribeCb:null as ((status:string)=>void)|null,
}));
vi.mock('../../src/lib/supabase',()=>({supabase:{
 rpc:api.rpc,
 channel:()=>{
  const ch={
   on:(_event:string,filter:{table:string},callback:()=>void)=>{api.channelHandlers.push({table:filter.table,callback});return ch;},
   subscribe:(cb?:(status:string)=>void)=>{api.subscribeCb=cb??null;return ch;},
  };
  return ch;
 },
 removeChannel:api.removeChannel,
}}));
import {isQueryAccessDenied} from '../../src/app/shared/queryAccess';
import {projectFlowCall,ProjectFlowError,readProjectFlow,refreshProjectFlow,subscribeProjectFlowChanges} from '../../src/app/features/project-setup/services/projectFlow';
beforeEach(()=>{
 vi.resetAllMocks();
 api.channelHandlers=[];
 api.subscribeCb=null;
});
afterEach(()=>{vi.useRealTimers();});
it.each(['23514','42501','40001','PGRST202'])('treats checked server rejection %s as a definite failed command',async code=>{
 api.rpc.mockResolvedValue({data:null,error:{code,message:'Checked rejection'}});await expect(projectFlowCall('authorize_project_funding',{})).rejects.toBeInstanceOf(ProjectFlowError);
});
it.each(['','08006','PGRST500'])('keeps transport/backend failure %s uncertain so its command identity is retained',async code=>{
 api.rpc.mockResolvedValue({data:null,error:{code,message:'Result unavailable'}});try{await projectFlowCall('authorize_project_funding',{});throw new Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(Error);expect(error).not.toBeInstanceOf(ProjectFlowError);expect((error as Error).message).toBe('Result unavailable');}
});

it('retries readProjectFlow once on transient failure without retrying mutations or 401 denials',async()=>{
 vi.useFakeTimers();
 api.rpc
  .mockResolvedValueOnce({data:null,error:{code:'',message:'TypeError: Failed to fetch'},status:0})
  .mockResolvedValueOnce({data:{ready:true},error:null,status:200});
 const pending=readProjectFlow('proj-retry');
 await vi.advanceTimersByTimeAsync(400);
 await expect(pending).resolves.toEqual({ready:true});
 expect(api.rpc).toHaveBeenCalledTimes(2);

 api.rpc.mockResolvedValueOnce({data:null,error:{code:'',message:'Unauthorized'},status:401});
 try{await readProjectFlow('proj-auth');throw new Error('Expected 401');}catch(error){
  expect(isQueryAccessDenied(error)).toBe(true);
 }
 expect(api.rpc).toHaveBeenCalledTimes(3);

 api.rpc.mockResolvedValueOnce({data:null,error:{code:'08006',message:'Connection reset'},status:503});
 await expect(projectFlowCall('authorize_project_funding',{})).rejects.toThrow('Connection reset');
 expect(api.rpc).toHaveBeenCalledTimes(4);
});

it('lets refreshProjectFlow bypass an in-flight readProjectFlow deduplication entry',async()=>{
 let resolveFirst!: (value:{data:{version:number};error:null})=>void;
 api.rpc
  .mockReturnValueOnce(new Promise(resolve=>{resolveFirst=resolve;}))
  .mockResolvedValueOnce({data:{version:2},error:null});
 const first=readProjectFlow('proj-fresh');
 const second=refreshProjectFlow('proj-fresh');
 resolveFirst({data:{version:1},error:null});
 await expect(first).resolves.toEqual({version:1});
 await expect(second).resolves.toEqual({version:2});
 expect(api.rpc).toHaveBeenCalledTimes(2);
});

it('coalesces Realtime project flow changes and refreshes after socket reconnect',()=>{
 vi.useFakeTimers();
 const onChanged=vi.fn();
 const stop=subscribeProjectFlowChanges('proj-rt',onChanged);
 expect(api.channelHandlers.map(h=>h.table)).toEqual([
  'projects','work_budget_allocations','petty_cash_requests',
  'petty_cash_liquidations','budget_commitments','office_budget_sections',
 ]);
 api.channelHandlers[0].callback();
 api.channelHandlers[1].callback();
 vi.advanceTimersByTime(300);
 expect(onChanged).toHaveBeenCalledTimes(1);

 api.subscribeCb?.('SUBSCRIBED');
 expect(onChanged).toHaveBeenCalledTimes(1);
 api.subscribeCb?.('CHANNEL_ERROR');
 api.subscribeCb?.('SUBSCRIBED');
 vi.advanceTimersByTime(300);
 expect(onChanged).toHaveBeenCalledTimes(2);

 stop();
 expect(api.removeChannel).toHaveBeenCalledTimes(1);
});

import {projectWorkAvailable} from '../../src/app/features/project-setup/projectWorkAvailable';
it('keeps Active, On hold and closed work visible independently of the setup receipt',()=>{
 for(const status of ['active','on_hold','completed','archived'])expect(projectWorkAvailable(status,false)).toBe(true);
 expect(projectWorkAvailable('planning',false)).toBe(false);
 expect(projectWorkAvailable('planning',true)).toBe(true);
});
