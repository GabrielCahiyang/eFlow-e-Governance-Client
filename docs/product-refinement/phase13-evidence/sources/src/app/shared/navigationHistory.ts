export const NAVIGATION_LOCATION_EVENT = 'eflow:locationchange';
export function replaceNavigationHistory(url: string) {
  window.history.replaceState({ ...window.history.state, eflowIndex: window.history.state?.eflowIndex ?? 0 }, '', url);
}
export function pushNavigationHistory(url: string) {
  if (window.history.state?.eflowIndex === undefined) replaceNavigationHistory(window.location.href);
  window.history.pushState({ ...window.history.state, eflowNavigation: true, eflowIndex: window.history.state.eflowIndex + 1 }, '', url);
  window.dispatchEvent(new Event(NAVIGATION_LOCATION_EVENT));
}
