import {useState} from 'react';
import {WorkTree,type WorkTreeController} from '../../nested-work';
import type {Task} from '../../tasks';
import {SubitemActionModal,type SubitemActionSection} from './SubitemActionModal';

/** The shared hierarchy/editor owns child controls; never clone/filter its data. */
export function SubitemChildWork({itemId,rootTask,controller,readOnly,executionBlocked,onOpenItem,onReviewItem}:{
 itemId:string;rootTask?:Task;controller:WorkTreeController;readOnly:boolean;executionBlocked:boolean;
 onOpenItem:(id:string)=>void;onReviewItem?:(id:string)=>void;
}){
 const [sectionModal,setSectionModal]=useState<{id:string;section:SubitemActionSection}>();
 const snapshot=controller.data;
 if(snapshot?.root.project&&!snapshot.nodes.some(node=>node.parent_subtask_id===itemId))return null;
 return <>
  <WorkTree key={itemId} rootId={controller.rootId} branchParentId={itemId} branchActions controller={controller} readOnly={readOnly} executionBlocked={executionBlocked}
   onOpenOfficeNode={node=>onOpenItem(node.id)} onReviewOfficeNode={onReviewItem?node=>onReviewItem(node.id):undefined}
   onSubtaskSection={rootTask?(section,node)=>setSectionModal({id:node.id,section}):undefined}/>
  {sectionModal&&rootTask&&<SubitemActionModal key={`${sectionModal.id}:${sectionModal.section}`} rootTask={rootTask} itemId={sectionModal.id} section={sectionModal.section} controller={controller} readOnly={readOnly} executionBlocked={executionBlocked} onClose={()=>setSectionModal(undefined)}/>}
 </>;
}
