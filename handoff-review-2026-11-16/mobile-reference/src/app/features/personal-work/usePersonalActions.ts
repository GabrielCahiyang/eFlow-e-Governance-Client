import { useEffect, useRef, useState } from "react";
import { PublicMessageError, userErrorMessage } from "../../shared/userMessages";
import { useAccountActionAccess } from "../../shared/AccountActionAccess";
import { beginOperation } from "../../shared/operationActivity";
import { useToast } from "../../components/ui/Toast";
import { draftStore } from "../../../platform/draftStore";
import { sendPersonalRequest, PersonalCommandFailure } from "./services";
import { isPersonalRequest, type MobilePersonalCommand, type PersonalRequest } from "./requestRecovery";
const personalActionToastLabel: Record<MobilePersonalCommand, string> = {
  set_member: "Project team updated.",
  create_task: "Personal task added.",
  staff_task: "Task assignments saved.",
  start_task: "Personal task started.",
  progress_task: "Personal progress saved.",
  submit_task: "Personal work submitted.",
  review_task: "Review decision saved.",
  complete_project: "Personal project completed.",
  archive_project: "Personal project archived.",
  shortcut: "Project shortcut updated.",
};
export function usePersonalActions(
  actor: string,
  project: string,
  onSaved: () => Promise<void>,
) {
  const assertAccess = useAccountActionAccess();
  const { toast } = useToast();
  const scope = "personal-command:" + project,
    [pending, setPending] = useState<PersonalRequest | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [recoveryBlocked, setRecoveryBlocked] = useState(false),
    [canDiscard, setCanDiscard] = useState(false);
  const active = useRef(false),
    generation = useRef(0),
    receipt = useRef<PersonalRequest | null>(null);
  const recoveryReady = useRef(false);
  useEffect(() => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    setNotice("");
    setPending(null);
    receipt.current = null;
    recoveryReady.current = false;
    setRecoveryBlocked(false);
    setCanDiscard(false);
    void draftStore
      .get<unknown>(actor, scope)
      .then((value) => {
        if (version !== generation.current) return;
        if (value !== null && !isPersonalRequest(value, actor, project))
          throw new PublicMessageError(
            "The saved personal-work request could not be verified. Check its original result before continuing.",
          );
        receipt.current = value as PersonalRequest | null;
        recoveryReady.current = true;
        setPending(receipt.current);
      })
      .catch((reason) => {
        if (version === generation.current) {
          setError(userErrorMessage(reason, "action"));
          setRecoveryBlocked(true);
        }
      })
      .finally(() => {
        if (version === generation.current) setLoading(false);
      });
    return () => {
      ++generation.current;
    };
  }, [actor, project]);
  const execute = async (
    command?: MobilePersonalCommand,
    payload?: Record<string, unknown>,
  ) => {
    if (
      active.current ||
      loading ||
      !recoveryReady.current ||
      !actor ||
      !project
    )
      return false;
    if (!receipt.current && !command) return false;
    active.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setCanDiscard(false);
    const version = generation.current;
    const finish = beginOperation("update");
    try {
      assertAccess(actor);
      let saved = receipt.current;
      if (saved && command)
        throw new PublicMessageError(
          "Check your previous attempt before starting another change.",
        );
      if (!saved) {
        saved = {
          schema: 1,
          actor,
          project,
          command: command!,
          payload: payload!,
          request: crypto.randomUUID(),
        };
        await draftStore.set(actor, scope, saved);
        if (version !== generation.current) return false;
        receipt.current = saved;
        if (version === generation.current) setPending(saved);
      }
      assertAccess(actor);
      await sendPersonalRequest(saved);
      await draftStore.remove(actor, scope);
      if (version === generation.current) {
        receipt.current = null;
        setPending(null);
        setNotice("Changes saved.");
        toast(personalActionToastLabel[saved.command] || "Changes saved.", "success");
        try {
          await onSaved();
        } catch {
          setError(
            "Changes were saved, but the updated view could not load. Refresh this project.",
          );
        }
      }
      return true;
    } catch (reason) {
      if (version === generation.current) {
        setCanDiscard(
          reason instanceof PersonalCommandFailure && reason.confirmedRejected,
        );
        setError(userErrorMessage(reason, "action"));
      }
      return false;
    } finally {
      finish();
      active.current = false;
      if (version === generation.current) setBusy(false);
    }
  };
  return {
    busy,
    loading,
    error,
    notice,
    pending,
    recoveryBlocked,
    canDiscard,
    discard: async () => {
      if (active.current || !canDiscard) return;
      active.current = true;
      setBusy(true);
      const version = generation.current;
      try {
        await draftStore.remove(actor, scope);
        if (version === generation.current) {
          receipt.current = null;
          setPending(null);
          setCanDiscard(false);
          setError("");
        }
      } catch (reason) {
        if (version === generation.current)
          setError(userErrorMessage(reason, "action"));
      } finally {
        active.current = false;
        if (version === generation.current) setBusy(false);
      }
    },
    run: (command: MobilePersonalCommand, payload: Record<string, unknown>) =>
      execute(command, payload),
    retry: () => execute(),
  };
}
