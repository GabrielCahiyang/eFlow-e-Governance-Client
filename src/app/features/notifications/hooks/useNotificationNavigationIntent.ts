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

  useEffect(() => {
    let active=true;
    const inFlight=new Set<NotificationNavigationIntent>();
    const actor=user?.id;
    const current=(intent:NotificationNavigationIntent)=>!!actor&&active&&actorRef.current===actor&&peekNotificationNavigationIntent(actor)===intent;
    const apply = (intent: NotificationNavigationIntent) => {
      if(!current(intent)||inFlight.has(intent))return;
      if (!matchesRef.current(intent)) return;
      inFlight.add(intent);
      const finish=(handled:boolean)=>{inFlight.delete(intent);if(handled&&current(intent))completeNotificationNavigationIntent(intent.notificationId,intent);};
      try{
        const result=handleRef.current(intent,()=>current(intent));
        if(typeof result==='boolean')finish(result);
        else void result.then(finish,()=>finish(false));
      }catch{finish(false);}
    };

    const unsubscribe = subscribeToNotificationNavigationIntent(apply);
    const pending = user?.id?peekNotificationNavigationIntent(user.id):null;
    if (pending) apply(pending);
    return ()=>{active=false;unsubscribe();};
    // The caller controls retries as its page data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id,...dependencies]);
}
