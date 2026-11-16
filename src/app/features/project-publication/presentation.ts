import type { SealState } from "./types";
export const sealLabels: Record<SealState, string> = {
  preparing: "Preparing records and files",
  review_ready: "Ready for your review",
  queued: "Waiting to publish",
  uploading: "Saving public archive",
  broadcast: "Sending Amoy transaction",
  confirming: "Waiting for blockchain finality",
  confirmed: "Sealed on Amoy",
  failed: "Publication stopped",
  simulation: "Simulation finished",
  cancelled: "Preview discarded",
};
export const isSealPending = (state?: SealState) =>
  !!state &&
  ["preparing", "queued", "uploading", "broadcast", "confirming"].includes(
    state,
  );
export const sectionLabel = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase());
export function publicRecordUrl(id: string) {
  const configuredBase = (
    import.meta.env.VITE_PUBLIC_PORTAL_URL as string | undefined
  )
    ?.trim()
    .replace(/\/+$/, "");
  const base = configuredBase || window.location.origin;
  return `${base}/project-record/${encodeURIComponent(id)}`;
}
