import { useEffect, useRef, useState } from "react";
import {
  useConfirmation,
  type ConfirmationOptions,
} from "../components/ui/useConfirmation";
import { useExplicitDraft } from "./useExplicitDraft";

type ReviewedMutation = {
  key: string;
  confirmation?: ConfirmationOptions;
  validate?: () => void;
  operation: () => Promise<unknown>;
  success: string;
  onSaved?: () => void;
  refresh?: () => Promise<unknown>;
  /** Explicit repeat is allowed only after a known write and a successful read. */
  allowRepeatAfterRefresh?: boolean;
};

/** A UI receipt, not a server idempotency key. Unknown writes require independent verification. */
export function useReviewedMutation(context: string) {
  const latestContext = useRef(context);
  latestContext.current = context;
  const { confirm, dialog } = useConfirmation();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "warning">("success");
  const outcomes = useRef(new Set<string>());
  const guard = useExplicitDraft(
    "Action in progress",
    false,
    pending,
    () => {},
    context,
  );
  useEffect(() => {
    latestContext.current = context;
    setMessage("");
    return () => {
      if (latestContext.current === context) latestContext.current = "";
    };
  }, [context]);
  const run = async (action: ReviewedMutation): Promise<boolean> => {
    if (guard.pendingRef.current) return false;
    const origin = context;
    const key = `${origin}:${action.key}`;
    if (outcomes.current.has(key)) {
      setTone("warning");
      setMessage(
        "Check the current record before repeating this action. Its previous result is saved or requires verification.",
      );
      return false;
    }
    guard.pendingRef.current = true;
    setPending(true);
    let started = false;
    let saved = false;
    try {
      if (action.confirmation && !(await confirm(action.confirmation)))
        return false;
      if (latestContext.current !== origin) return false;
      action.validate?.();
      started = true;
      await action.operation();
      saved = true;
      outcomes.current.add(key);
      if (latestContext.current !== origin) return true;
      setTone("success");
      setMessage(action.success);
      action.onSaved?.();
      await action.refresh?.();
      if (action.refresh && action.allowRepeatAfterRefresh)
        outcomes.current.delete(key);
      return true;
    } catch (error) {
      if (started) outcomes.current.add(key);
      if (latestContext.current !== origin) return saved;
      setTone(saved ? "warning" : "error");
      const detail =
        error instanceof Error
          ? error.message
          : "The action could not be completed.";
      setMessage(
        saved
          ? `${action.success} The view could not refresh. Refresh the current record; do not repeat the write.`
          : started
            ? `${detail} The result needs verification. Refresh and check the current record before retrying.`
            : detail,
      );
      return saved;
    } finally {
      guard.pendingRef.current = false;
      setPending(false);
    }
  };
  return { run, pending, message, tone, dialog, confirm };
}
