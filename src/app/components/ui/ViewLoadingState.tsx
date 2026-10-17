import { EFlowMark } from '../../../components/EFlowMark';
import './viewLoadingState.css';

/** Lightweight, shared by code-split views without importing their feature. */
export function ViewLoadingState() {
  return <div className="eflow-view-loading" role="status" aria-label="Getting your workspace ready" aria-busy="true">
    <div className="eflow-view-loading__brand"><EFlowMark height={28} state="submitting"/><span>Getting your workspace ready</span></div>
    <div className="eflow-view-loading__skeleton" aria-hidden="true">
      <div className="eflow-view-loading__title"/><div className="eflow-view-loading__subtitle"/>
      <div className="eflow-view-loading__cards">{[0,1,2,3].map(i=><div key={i}/>)}</div>
      <div className="eflow-view-loading__panel">{[0,1,2,3].map(i=><div key={i}/>)}</div>
    </div>
  </div>;
}
