import { useEffect, useRef, useState } from "react";
import { getQueryCacheGeneration } from "../../shared/queryCache";
import { warmStartupReads, type StartupReadScope } from "./startupReads";

const STARTUP_LIMIT_MS = 12_000;

export function useStartupWarmup(scope: StartupReadScope, ready: boolean) {
  const [finished, setFinished] = useState(false);
  const latestScope = useRef(scope);
  latestScope.current = scope;
  const workspaceId = scope.workspace?.workspace.id;
  const sectionsKey = Array.from(scope.sections).sort().join(",");

  useEffect(() => {
    const timer = window.setTimeout(() => setFinished(true), STARTUP_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || finished) return;
    let active = true;
    const generation = getQueryCacheGeneration();
    const isCurrent = () => active && generation === getQueryCacheGeneration();
    void warmStartupReads(latestScope.current, isCurrent).finally(() => {
      if (active) setFinished(true);
    });
    return () => { active = false; };
  }, [finished, ready, scope.actorId, scope.role, scope.officeId, workspaceId, sectionsKey]);

  return !finished;
}
