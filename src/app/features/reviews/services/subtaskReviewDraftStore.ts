import type {SubtaskReviewItem} from '../../subtasks';

// Runtime-only feedback vault. No evidence, submission snapshots, names, tokens
// or credentials are stored. Actor changes/remounts hide, rather than delete it.
const drafts=new Map<string,{feedback:string;order:number}>();
let order=0;
function key(actorId:string,item:SubtaskReviewItem):string|undefined {
 const {subtask,submission}=item;
 if(!actorId||!subtask.taskId||!subtask.id||!submission.id||subtask.taskId!==submission.taskId||subtask.id!==submission.subtaskId||!Number.isSafeInteger(submission.version)||submission.version<1)return;
 return JSON.stringify([actorId,'subtask-review',subtask.taskId,subtask.id,submission.id,submission.version]);
}
export function sameSubtaskReviewTarget(left:SubtaskReviewItem,right:SubtaskReviewItem):boolean {
 const identity=key('scope',left);
 return !!identity&&identity===key('scope',right);
}
export function writeSubtaskReviewDraft(actorId:string,item:SubtaskReviewItem,feedback:string):void {
 const identity=key(actorId,item);if(!identity)return;
 if(feedback)drafts.set(identity,{feedback,order:++order});else drafts.delete(identity);
}
/** Only explicit discard or a confirmed successful decision removes a draft. */
export function discardSubtaskReviewDraft(actorId:string,item:SubtaskReviewItem):void {
 const identity=key(actorId,item);if(identity)drafts.delete(identity);
}
/** Caller must supply its freshly authorized, review-capable queue. A newer
 * attempt/version or closed state never recovers an older draft. It stays
 * quarantined in memory and cannot be silently applied to a different target.
 */
export function recoverSubtaskReviewDraft(actorId:string,authorized:readonly SubtaskReviewItem[]) {
 let result:{item:SubtaskReviewItem;feedback:string;order:number}|undefined;
 for(const item of authorized){
  if(item.submission.status!=='pending')continue;
  const identity=key(actorId,item),stored=identity?drafts.get(identity):undefined;
  if(stored&&(!result||stored.order>result.order))result={item,feedback:stored.feedback,order:stored.order};
 }
 return result;
}
