import { InspectorTeam } from './InspectorTeam';
import { requestNavigation } from '../../../shared/navigationGuard';
import {Button,Heading} from '@vibe/core';

/** Compose existing staffing and hierarchy against the Inspector owner's controller. */
export function InspectorWork({staffingReason,onRecommend,...team}: Parameters<typeof InspectorTeam>[0] & {
 staffingReason: string | null;
 onRecommend: () => void;
}) {
 return <div className="space-y-4">
  <InspectorTeam {...team}/>
  {team.presentation==='page'?(staffingReason?null:<section className="task-page__card task-page__staffing" aria-label="Advisory staffing"><div><Heading type="h2">Need help choosing people?</Heading><p>Find available people with relevant experience.</p></div><Button kind="secondary" size="small" onClick={()=>void requestNavigation(onRecommend)}>Recommend staff</Button></section>):<section aria-label="Advisory staffing"><h3>Staffing suggestions</h3>{staffingReason ? <p className="po-help">{staffingReason}</p> : <><p className="po-help">Review confirmed professional evidence and Office workload before appointing an owner.</p><button className="eflow-text-button" onClick={() => void requestNavigation(onRecommend)}>Recommend staff</button></>}</section>}
 </div>;
}
