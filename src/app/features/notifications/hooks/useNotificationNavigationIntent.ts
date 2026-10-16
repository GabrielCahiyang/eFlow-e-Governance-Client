import { useEffect, useRef, type DependencyList } from "react";
import {useAuth} from '../../../contexts/AuthContext';
import type { NotificationNavigationIntent } from "../navigation";
import {
  completeNotificationNavigationIntent,
  peekNotificationNavigationIntent,
  subscribeToNotificationNavigationIntent,
} from "../navigationIntent";

/**
 * Applies a queued notification focus after its destination page mounts. The
 * handler returns false while its realtime data is still loading, preserving
 * the focus until the referenced record can be resolved.
 */
export function useNotificationNavigationIntent(
  matches: (intent: NotificationNavigationIntent) => boolean,
  handle: (intent: NotificationNavigationIntent,isCurrent:()=>boolean) => boolean|Promise<boolean>,
  dependencies: DependencyList,
): void {
  const {user}=useAuth();
  const actorRef=useRef(user?.id);actorRef.current=user?.id;
  const matchesRef = useRef(matches);
  const handleRef = useRef(handle);
  matchesRef.current = matches;
  handleRef.current = handle;
  const applyRef=useRef<((intent:NotificationNavigationIntent,sourceRetry?:boolean)=>void)|undefined>(undefined);

  useEffect(() => {
    let active=true;
    const inFlight=new Set<NotificationNavigationIntent>();
    const waitingRetry=new Set<NotificationNavigationIntent>();
    const actor=user?.id;
    const current=(intent:NotificationNavigationIntent)=>!!actor&&active&&actorRef.current===actor&&peekNotificationNavigationIntent(actor)===intent;
    const apply = (intent: NotificationNavigationIntent,sourceRetry=false) => {
      if(!current(intent))return;
      if(inFlight.has(intent)){if(sourceRetry)waitingRetry.add(intent);return;}
      if (!matchesRef.current(intent)) return;
      inFlight.add(intent);
      const finish=(handled:boolean)=>{
        inFlight.delete(intent);const retry=waitingRetry.delete(intent);
        if(handled&&current(intent))completeNotificationNavigationIntent(intent.notificationId,intent);
        else if(!handled&&retry&&current(intent))apply(intent);
      };
      try{
        const result=handleRef.current(intent,()=>current(intent));
        if(typeof result==='boolean')finish(result);
        else void result.then(finish,()=>finish(false));
      }catch{finish(false);}
    };
    applyRef.current=apply;

    const unsubscribe = subscribeToNotificationNavigationIntent(apply);
    return ()=>{active=false;applyRef.current=undefined;unsubscribe();};
  }, [user?.id]);

  useEffect(()=>{
    const pending=user?.id?peekNotificationNavigationIntent(user.id):null;
    if(pending)applyRef.current?.(pending,true);
    // The caller controls retries as its page data changes.
    // An existing exact read stays owned by this actor/intent across those
    // changes; only completion, replacement, account change or unmount ends it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id,...dependencies]);
}
