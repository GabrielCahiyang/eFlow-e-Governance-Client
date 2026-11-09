import { invalidateQueryDomain } from "../../../shared/queryCache";

const collaborationDraftEvents = new EventTarget();
const DRAFTS_CHANGED_EVENT = "drafts-changed";

export function notifyCollaborationDraftsChanged() {
  invalidateQueryDomain("collaboration-drafts");
  invalidateQueryDomain("collaboration-memberships");
  collaborationDraftEvents.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
}

export function subscribeToLocalCollaborationDraftChanges(callback: () => void) {
  collaborationDraftEvents.addEventListener(DRAFTS_CHANGED_EVENT, callback);
  return () => collaborationDraftEvents.removeEventListener(DRAFTS_CHANGED_EVENT, callback);
}
