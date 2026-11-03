import {useSyncExternalStore} from 'react';
import {CalendarDays, Clock3, TriangleAlert} from 'lucide-react';
import {deadlinePresentation} from '../../shared/deadlinePresentation';
import './deadlineBadge.css';

// One clock for every visible badge; refresh after a suspended/background tab too.
let clock = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function tick() { clock = Date.now(); listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick(); timer = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer); timer = undefined;
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    }
  };
}
const snapshot = () => clock;
export function DeadlineBadge({value, status, now, history = false, showDate = true}: {
  value?: string | null; status?: string; now?: number; history?: boolean; showDate?: boolean;
}) {
  const liveNow = useSyncExternalStore(subscribe, snapshot, snapshot);
  const state = deadlinePresentation(value, status, now ?? liveNow);
  const Icon = state.tone === 'red' ? TriangleAlert : state.tone === 'yellow' ? Clock3 : CalendarDays;
  const date = state.date && new Date(state.date + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  return <span className="eflow-deadline" data-tone={state.tone}>
    {showDate && date && <time dateTime={value || state.date}>{date}</time>}
    <span className="eflow-deadline__signal"><Icon size={13} aria-hidden="true"/>{history && <span>At change · </span>}{state.label}</span>
  </span>;
}
