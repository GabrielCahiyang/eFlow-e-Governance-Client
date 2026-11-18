export function isQueryAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, status, message } = error as { code?: string; status?: number; message?: string };
  return status === 401 || status === 403 || code === "42501" || code === "PGRST301" ||
    /permission denied|access (?:denied|revoked)|current (?:work|office) access (?:is )?required|not (?:authorized|authorised)|row.level security|jwt (?:expired|invalid)/i.test(message || "");
}

export function isQueryConnectionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, status, message } = error as { code?: string; status?: number; message?: string };
  return status === 0 || status === 408 || (typeof status === "number" && status >= 500) || code === "57014" ||
    /failed to fetch|network|connection|timed? ?out|statement timeout|load failed|service unavailable/i.test(message || "");
}
