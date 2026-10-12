import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {requestNavigation} from '../../../shared/navigationGuard';
import {SubtaskReviewInbox,SubitemReviewDetail} from '../../reviews';
import {buildWorkDisplayTree,type WorkTreeSnapshot} from '../../nested-work';

/** Existing Inbox still owns reviewer discovery, feedback and decision APIs. */
export function SubitemReviewGate({rootId,itemId,readOnly,onClose,tree,rootTitle}:{rootId:string;itemId:string;readOnly:boolean;onClose:()=>void;tree?:WorkTreeSnapshot;rootTitle?:string}){
 return <FeatureDialog title="Subitem evidence review" onClose={()=>void requestNavigation(onClose)}>
 <div className="min-h-0 overflow-y-auto p-4">
  <SubtaskReviewInbox embedded readOnly={readOnly} onShowTasks={onClose} focus={{notificationId:`inspector:${itemId}`,kind:'subtask_review',taskId:rootId,entityId:itemId}}
   renderDetail={props=>{
    const node=tree&&tree.root.id===props.item.subtask.taskId?tree.nodes.find(node=>node.id===props.item.subtask.id):undefined;
    const row=node&&tree?buildWorkDisplayTree(tree.nodes).find(row=>row.id===node.id):undefined;
    const parent=node?.parent_subtask_id?tree?.nodes.find(parent=>parent.id===node.parent_subtask_id):undefined;
    const reviewer=node?.current_reviewer?tree?.people.find(person=>person.id===node.current_reviewer)?.name:undefined;
    return <SubitemReviewDetail {...props} currentReviewerName={undefined} context={node&&row?{taskId:rootId,subtaskId:node.id,rootTitle:rootTitle||props.item.taskTitle,
     path:row.path,parentTitle:parent?.title||(node.parent_subtask_id?'Parent unavailable':rootTitle||props.item.taskTitle),incomplete:!!row.context||row.pathTruncated,currentReviewerName:reviewer}:undefined}/>;
   }}/>
 </div>
 </FeatureDialog>;
}
