import { realpathSync } from "node:fs";

export function resolveBrowserExecutable(
  requested: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== "win32") return requested;

  try {
    // The native API resolves virtualized AppData to its physical location.
    // Windows' assembly loader needs that location to find Firefox's mozglue.
    return realpathSync.native(requested);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return requested;
    throw error;
  }
}
