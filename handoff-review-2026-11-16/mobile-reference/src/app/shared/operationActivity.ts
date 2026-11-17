import { subscribeDisplayCache } from "./displayCache";

type Kind = "update" | "permissions";
const pending = new Map<symbol, Kind>();
const listeners = new Set<() => void>();
let subscribed = false;
const publish = () => listeners.forEach((listener) => listener());

/** Feedback only: never a permission, mutation receipt, or optimistic server state. */
export function beginOperation(kind: Kind): () => void {
  if (!subscribed) {
    subscribed = true;
    subscribeDisplayCache((reason) => {
      if (reason === "identity") {
        pending.clear();
        publish();
      }
    });
  }
  const token = Symbol(kind);
  pending.set(token, kind);
  publish();
  return () => {
    if (pending.delete(token)) publish();
  };
}

export function operationMessage(): string {
  return [...pending.values()].includes("update")
    ? "Updating…"
    : pending.size
      ? "Checking actions…"
      : "";
}

export function subscribeOperationActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isPermissionRead = (key: string) =>
  /(?:^|[-:])(access|permission|permissions|capabilities|authority|structure|staffing|detail-edit|schedule-edit)(?:[-:]|$)/i.test(
    key,
  );
