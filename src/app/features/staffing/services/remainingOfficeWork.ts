import { prepareAutoAssignment,applyAutoAssignment } from './autoAssignment';
export async function assignRemainingOfficeWork(ids:string[],onProgress:(message:string)=>void){
 const {fetchWorkTree}=await import('../../nested-work');
 let assigned=0;const failures:string[]=[];
 for(let index=0;index<ids.length;index++){
  try{const snapshot=await fetchWorkTree(ids[index]);if(snapshot.root.lead||!snapshot.root.open)continue;
   onProgress(`Choosing people for task ${index+1} of ${ids.length}`);
   const request=await prepareAutoAssignment(snapshot,()=>{});await applyAutoAssignment(request);assigned++;
  }catch(reason){failures.push((reason as Error).message);}
 }
 return {assigned,failures};
}
