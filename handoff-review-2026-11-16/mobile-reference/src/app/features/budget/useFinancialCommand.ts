import { useRef, useState } from "react";
import { useAccountActionAccess } from "../../shared/AccountActionAccess";
import { beginOperation } from "../../shared/operationActivity";
import { useToast } from "../../components/ui/Toast";
import { draftStore } from "../../../platform/draftStore";
import { feedback, PublicMessageError } from "../../shared/userMessages";
import {
  executeFinancialCommand,
  FinancialCancelled,
  type FinancialReceipt,
} from "./financialReceipt";
import * as Crypto from "expo-crypto";
const activeScopes = new Set<string>();
export function useFinancialCommand(actorId: string, scope: string) {
  const assertAccess = useAccountActionAccess();
  const { toast } = useToast();
  const pending = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error>(),
    [notice, setNotice] = useState("");
  const run = async (
    key: string,
    command: () => Promise<unknown>,
    refresh?: () => Promise<void>,
    success = "Financial action recorded.",
  ) => {
    const activeScope = actorId + ":" + scope;
    if (pending.current || activeScopes.has(activeScope)) return false;
    activeScopes.add(activeScope);
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    let saved = false;
    let finish: (() => void) | undefined;
    try {
      assertAccess(actorId);
      if (!actorId)
        throw new PublicMessageError("Current work access is required.");
      finish = beginOperation("update");
      const scopeHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        scope,
      );
      const prefix = `financial:${scopeHash}:`;
      const receiptKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        scope + ":" + key,
      );
      await executeFinancialCommand(
        {
          get: (key) => draftStore.get<FinancialReceipt>(actorId, prefix + key),
          set: (key, value) => draftStore.set(actorId, prefix + key, value),
          remove: (key) => draftStore.remove(actorId, prefix + key),
        },
        receiptKey,
        command,
        () => assertAccess(actorId),
      );
      saved = true;
      setNotice(success);
      if (success) toast(success, "success");
      await refresh?.();
      return true;
    } catch (e) {
      if (e instanceof FinancialCancelled) {
        setError(
          new PublicMessageError(e.message || "This action was cancelled."),
        );
        return false;
      }
      const detail =
        e instanceof Error
          ? e.message
          : "No confirmed financial result was returned.";
      setError(
        saved
          ? new PublicMessageError(feedback.saved)
          : e instanceof Error
            ? e
            : new Error(detail),
      );
      return false;
    } finally {
      finish?.();
      activeScopes.delete(activeScope);
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    run,
    busy,
    error,
    notice,
    clear: () => {
      setError(undefined);
      setNotice("");
    },
  };
}
export function useFinancialAction(
  actorId: string,
  scope: string,
  fingerprint: string,
) {
  const action = useFinancialCommand(actorId, scope);
  return {
    ...action,
    run: (
      operation: () => Promise<unknown>,
      message = "Financial action recorded.",
      refresh?: () => Promise<void>,
    ) => action.run(fingerprint, operation, refresh, message),
  };
}
