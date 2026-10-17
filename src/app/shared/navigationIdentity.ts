import {replaceNavigationHistory} from './navigationHistory';

/** UI ownership only. Permissions are always checked independently. */
export function isForeignNavigationActor(actorId:string,role:string) {
  const state=window.history.state;
  return !!(state?.eflowActorId&&(state.eflowActorId!==actorId||state.eflowActorRole&&state.eflowActorRole!==role));
}
export function claimNavigationIdentity(actorId:string,role:string) {
  if(isForeignNavigationActor(actorId,role)) replaceNavigationHistory('/');
  window.history.replaceState({...window.history.state,eflowActorId:actorId,eflowActorRole:role},'',window.location.href);
}
