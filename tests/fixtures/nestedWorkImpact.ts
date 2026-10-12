import type {WorkImpact,WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';

/** Synthetic RPC response only. Production preview eligibility stays server-side. */
export function nestedWorkImpactFixture(data:WorkTreeSnapshot,request:Pick<WorkRequest,'revision'|'command'|'payload'>,patch:Partial<WorkImpact>={}):WorkImpact {
 const target=data.nodes.find(node=>node.id===request.payload.id),selected=new Set<string>();
 if(target)selected.add(target.id);
 else if(request.command==='order')for(const node of data.nodes.filter(node=>node.parent_subtask_id===(request.payload.parent||null)))selected.add(node.id);
 else for(const node of data.nodes)selected.add(node.id);
 for(let depth=0;depth<8;depth++)for(const node of data.nodes)if(node.parent_subtask_id&&selected.has(node.parent_subtask_id))selected.add(node.id);
 const transferring=['root_lead','staff'].includes(request.command)&&request.payload.lead!==(target?.lead_id??data.root.lead);
 return {root_id:data.root.id,expected_revision:request.revision,current_revision:data.revision,command:request.command,allowed:true,blocker_codes:[],
  selected_count:selected.size,descendant_count:target?selected.size-1:selected.size,
  affected_appointment_count:transferring||request.command==='move'?data.nodes.filter(node=>selected.has(node.id)&&node.id!==target?.id&&node.lead_id).length:0,
  before_path:target?[target.title]:[],after_path:target?[target.title]:[],fingerprint:'synthetic-checked-impact',
  ...(request.command==='edit'&&Object.hasOwn(request.payload,'due')?{requires_date_confirmation:false,date_impact:{old_due:target?.due_date??null,new_due:request.payload.due as string|null,items:[]}}:{}),...patch};
}
