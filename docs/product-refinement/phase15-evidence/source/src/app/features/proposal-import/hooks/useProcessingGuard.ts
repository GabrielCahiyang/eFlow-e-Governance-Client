import { useEffect } from "react";
import { acquireNavigationLock } from "../../../shared/navigationLock";

export function useProcessingGuard(active: boolean, onProcessingChange?: (active: boolean) => void) {
  useEffect(() => {
    onProcessingChange?.(active);
    if (!active) return;
    const release = acquireNavigationLock();
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { release(); window.removeEventListener("beforeunload", warn); onProcessingChange?.(false); };
  }, [active, onProcessingChange]);
}
