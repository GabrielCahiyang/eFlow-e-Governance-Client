import {WorkTree,type WorkTreeController} from '../../nested-work';

/** The shared hierarchy/editor owns child controls; never clone/filter its data. */
export function SubitemChildWork({itemId,controller,readOnly,executionBlocked,onOpenItem,onReviewItem}:{
 itemId:string;controller:WorkTreeController;readOnly:boolean;executionBlocked:boolean;
 onOpenItem:(id:string)=>void;onReviewItem?:(id:string)=>void;
}){
 return <WorkTree key={itemId} rootId={controller.rootId} branchParentId={itemId} branchActions controller={controller} readOnly={readOnly} executionBlocked={executionBlocked}
  onOpenOfficeNode={node=>onOpenItem(node.id)} onReviewOfficeNode={onReviewItem?node=>onReviewItem(node.id):undefined}/>;
}
