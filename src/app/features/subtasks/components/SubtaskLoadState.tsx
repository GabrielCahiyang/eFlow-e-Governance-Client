import {AlertCircle,ArrowLeft,LoaderCircle,RefreshCw} from 'lucide-react';
import './subtaskLoadState.css';

export function SubtaskLoadState({loading,error,onRetry,onClose}:{loading:boolean;error:string;onRetry:()=>void;onClose:()=>void}){
 return <div className="subtask-load">
  <button type="button" className="subtask-load__back" aria-label="Close subtask detail" onClick={onClose}><ArrowLeft size={16} aria-hidden="true"/>Back to work</button>
  {loading?<>
   <div className="subtask-load__status" role="status" aria-busy="true">
    <span className="subtask-load__icon"><LoaderCircle size={24} aria-hidden="true"/></span>
    <div><h2>Loading subtask…</h2><p>Getting your work ready.</p></div>
   </div>
   <div className="subtask-load__skeleton" aria-hidden="true">
    <div className="subtask-load__title"/><div className="subtask-load__meta"/>
    <div className="subtask-load__tabs"><span/><span/></div>
    <div className="subtask-load__panel"><div/><div/><div className="subtask-load__field"/><div className="subtask-load__line"/></div>
   </div>
  </>:<div className="subtask-load__error" role="alert"><AlertCircle size={24} aria-hidden="true"/><div><h2>Subtask unavailable</h2><p>{error||'This subtask is no longer available.'}</p><button type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Retry subtask</button></div></div>}
 </div>;
}
