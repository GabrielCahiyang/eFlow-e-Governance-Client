import { useEffect, useRef, useState } from 'react';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { TaskInspectorOrigin } from '../types';
export type { TaskInspectorOrigin } from '../types';
/** Only identity and origin live here. Task records always come from the authorized caller. */
export function useTaskInspector(scope: string) {
 const [selection, setSelection] = useState<{ taskId: string; origin: TaskInspectorOrigin } | null>(null);
 const previous = useRef(scope);
 useEffect(() => { if (previous.current !== scope) { previous.current = scope; setSelection(null); } }, [scope]);
 const openTask = (taskId: string, origin: TaskInspectorOrigin = {view: scope}, afterOpen?: () => void) => { void requestNavigation(() => {
  const returnFocus = origin.returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  setSelection({ taskId, origin: { ...origin, returnFocus } });
  afterOpen?.();
 }); };
 const close = () => { setSelection(null); };
 return { taskId: previous.current === scope ? selection?.taskId || null : null, origin: selection?.origin, openTask, close };
}
