import { useRef, useState } from "react";
import { useAccountActionAccess } from "./AccountActionAccess";
import { beginOperation } from "./operationActivity";
export function useAction({ requireAccess = true } = {}) {
  const assertAccess = useAccountActionAccess();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error>(),
    [notice, setNotice] = useState("");
  const run = async (
    action: () => Promise<unknown>,
    message = "",
    onDone?: () => void,
  ) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    let finish: (() => void) | undefined;
    try {
      if (requireAccess) assertAccess();
      finish = beginOperation("update");
      await action();
      setNotice(message);
      onDone?.();
      return true;
    } catch (e) {
      if (e instanceof Error) setError(e);
      else {
        const failure = e as { message?: unknown; code?: unknown; status?: unknown } | null;
        setError(Object.assign(
          new Error(typeof failure?.message === "string" ? failure.message : "The operation did not finish."),
          {
            code: typeof failure?.code === "string" ? failure.code : undefined,
            status: typeof failure?.status === "number" ? failure.status : undefined,
          },
        ));
      }
      return false;
    } finally {
      finish?.();
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    notice,
    run,
    clear: () => {
      setError(undefined);
      setNotice("");
    },
  };
}
