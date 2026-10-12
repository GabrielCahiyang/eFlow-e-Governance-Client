import {displayedWorkContributorIds,resolveWorkPersonName} from '../selectors/people';
import type {WorkPerson} from '../types';

export interface WorkPeopleSummaryProps {
 leadId:string|null;
 contributorIds:readonly string[];
 people:readonly WorkPerson[];
 compact?:boolean;
 /** Table cells reuse the same historical name/contributor composition. */
 part?:'lead'|'contributors';
}

/** Display only. No membership, authority or appointment is inferred here. */
export function WorkPeopleSummary({leadId,contributorIds,people,compact=false,part}:WorkPeopleSummaryProps) {
 const contributors=displayedWorkContributorIds(leadId,contributorIds);
 const title=part==='lead'?(leadId?resolveWorkPersonName(people,leadId):'Needs reassignment'):contributors.map(id=>resolveWorkPersonName(people,id)).join(', ')||'No contributors';
 return <div className="r7-work grid min-w-0 gap-1 break-words" data-compact={compact||undefined} title={compact&&part?title:undefined}>
  {part!=='contributors'&&<div><strong>Lead: </strong>{leadId?resolveWorkPersonName(people,leadId):'Needs reassignment'}</div>}
  {part!=='lead'&&<div><strong>Contributors ({contributors.length}): </strong>
   {!contributors.length?'No contributors':compact
    ?contributors.map(id=>resolveWorkPersonName(people,id)).join(', ')
    :<ul className="r7-chips" aria-label="Contributors">{contributors.map(id=><li key={id}><span>{resolveWorkPersonName(people,id)}</span></li>)}</ul>}
  </div>}
 </div>;
}
