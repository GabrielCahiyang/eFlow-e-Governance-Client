import { InspectorTeam } from './InspectorTeam';
import { requestNavigation } from '../../../shared/navigationGuard';

/** Compose existing staffing and hierarchy against the Inspector owner's controller. */
export function InspectorWork({staffingReason,onRecommend,...team}: Parameters<typeof InspectorTeam>[0] & {
 staffingReason: string | null;
 onRecommend: () => void;
}) {
 return <div className="space-y-4">
  <InspectorTeam {...team}/>
  <section aria-label="Advisory staffing"><h3>Staffing suggestions</h3>{staffingReason ? <p className="po-help">{staffingReason}</p> : <><p className="po-help">Review confirmed professional evidence and Office workload before appointing an owner.</p><button className="eflow-text-button" onClick={() => void requestNavigation(onRecommend)}>Recommend staff</button></>}</section>
 </div>;
}
