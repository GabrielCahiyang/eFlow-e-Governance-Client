import type {WorkImpact} from '../types';
import {WorkImpactSummary} from './WorkImpactSummary';

export function WorkDeleteDialog({impact}:{impact?:WorkImpact}){
 return <div>
  <p>Deletion removes the selected subitem and its children. Recorded work, evidence or financial history prevents deletion.</p>
  {impact?<WorkImpactSummary impact={impact}/>:<p>Review deletion to fetch the current affected counts and blockers.</p>}
 </div>;
}
