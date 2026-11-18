import { supabase } from "../../../../lib/supabase";
import { MutationRejectedError } from "../../../shared/MutationRejectedError";

export type WorkFinancialClearance = {
  version: 1;
  rootId: string;
  nodeId: string | null;
  workAccepted: boolean;
  cashOutstanding: boolean;
  completed: boolean;
  canFinalize: boolean;
};

export type ReceiptSubmissionClearance = {
  version: 1;
  requestId: string;
  workAccepted: boolean;
  canSubmit: boolean;
};

export type CashReturnClearance = {
  version: 1;
  liquidationId: string;
  packageVersion: number;
  amount: number;
  received: boolean;
  approved: boolean;
  receivedBy: string | null;
  approvedBy: string | null;
  reference: string | null;
  canAcknowledge: boolean;
  canApprove: boolean;
};

export type SavedClearanceRequest = {
  id: string;
  args: Record<string, unknown>;
};

export async function clearanceRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error?.code === "PGRST202" || error?.code === "42883") {
    throw new MutationRejectedError(
      "This shared work contract is currently unavailable.",
      error.code,
    );
  }
  if (error) {
    if (/^(22|23|28|42|P0)/.test(error.code || "")) {
      throw new MutationRejectedError(error.message, error.code);
    }
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  return data as T;
}

export function isDeterministicClearanceRejection(error: unknown): boolean {
  if (error instanceof MutationRejectedError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === "string" &&
    (/^(22|23|28|42|P0)/.test(code) || code === "PGRST202" || code === "42883")
  );
}

export async function fetchWorkFinancialClearance(
  root: string,
  node?: string | null,
): Promise<WorkFinancialClearance> {
  const normalizedNode = node ?? null;
  const data = await clearanceRpc<WorkFinancialClearance>(
    "work_financial_clearance",
    {
      p_root: root,
      p_node: normalizedNode,
    },
  );
  if (
    data?.version !== 1 ||
    data.rootId !== root ||
    data.nodeId !== normalizedNode ||
    [
      data.workAccepted,
      data.cashOutstanding,
      data.completed,
      data.canFinalize,
    ].some((value) => typeof value !== "boolean")
  ) {
    throw new Error(
      "Financial clearance could not be verified. Refresh before continuing.",
    );
  }
  return data;
}

export async function fetchReceiptSubmissionClearance(
  request: string,
): Promise<ReceiptSubmissionClearance> {
  const data = await clearanceRpc<ReceiptSubmissionClearance>(
    "receipt_submission_clearance",
    { p_request: request },
  );
  if (
    data?.version !== 1 ||
    data.requestId !== request ||
    typeof data.workAccepted !== "boolean" ||
    typeof data.canSubmit !== "boolean"
  ) {
    throw new Error("Receipt submission access could not be verified.");
  }
  return data;
}

export async function fetchCashReturnClearance(
  liquidation: string,
): Promise<CashReturnClearance> {
  const data = await clearanceRpc<CashReturnClearance>(
    "cash_return_clearance",
    { p_liquidation: liquidation },
  );
  if (
    data?.version !== 1 ||
    data.liquidationId !== liquidation ||
    !Number.isInteger(data.packageVersion) ||
    !Number.isFinite(data.amount) ||
    data.amount < 0 ||
    [data.received, data.approved, data.canAcknowledge, data.canApprove].some(
      (value) => typeof value !== "boolean",
    )
  ) {
    throw new Error(
      "The cash return could not be verified. Refresh before deciding.",
    );
  }
  return data;
}

/** Old clients remain safe; work acceptance needs the new shared contract. */
export async function assertWorkAcceptanceAvailable(
  root: string,
  node?: string | null,
): Promise<WorkFinancialClearance> {
  return fetchWorkFinancialClearance(root, node);
}

function isSavedRequest(value: unknown): value is SavedClearanceRequest {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) &&
    "args" in value &&
    !!value.args &&
    typeof value.args === "object" &&
    !Array.isArray(value.args)
  );
}

export function verifySavedReturn(
  value: unknown,
  liquidation: string,
  version: number,
  amount: number,
): SavedClearanceRequest | undefined {
  if (value == null) return undefined;
  if (
    !isSavedRequest(value) ||
    value.args.p_liquidation !== liquidation ||
    value.args.p_version !== version ||
    value.args.p_amount !== amount ||
    value.args.p_key !== value.id ||
    !["acknowledge", "approve"].includes(String(value.args.p_action)) ||
    typeof value.args.p_reference !== "string" ||
    !value.args.p_reference.trim() ||
    value.args.p_reference.length > 2000 ||
    Object.keys(value.args).some(
      (key) =>
        ![
          "p_liquidation",
          "p_version",
          "p_action",
          "p_amount",
          "p_reference",
          "p_key",
        ].includes(key),
    )
  ) {
    throw new Error(
      "The saved cash-return action could not be verified. Check the original record before continuing.",
    );
  }
  return value;
}

export function verifySavedCompletion(
  value: unknown,
  root: string,
  node?: string | null,
): SavedClearanceRequest | undefined {
  if (value == null) return undefined;
  const normalizedNode = node ?? null;
  if (
    !isSavedRequest(value) ||
    value.args.p_root !== root ||
    value.args.p_node !== normalizedNode ||
    Object.keys(value.args).some((key) => !["p_root", "p_node"].includes(key))
  ) {
    throw new Error(
      "The saved completion could not be verified. Check the original work before continuing.",
    );
  }
  return value;
}

function storageKey(actor: string, scope: string): string {
  return `eflow:clearance-draft:${actor}:${scope}`;
}

export function readSavedClearanceRequest(
  actor: string,
  scope: string,
): unknown {
  if (typeof sessionStorage === "undefined" || !actor) return undefined;
  try {
    const raw = sessionStorage.getItem(storageKey(actor, scope));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new Error(
      "The saved request could not be read. Check the original record before continuing.",
    );
  }
}

export function writeSavedClearanceRequest(
  actor: string,
  scope: string,
  request: SavedClearanceRequest,
): void {
  if (typeof sessionStorage === "undefined" || !actor) return;
  try {
    sessionStorage.setItem(storageKey(actor, scope), JSON.stringify(request));
  } catch {
    /* keep in-memory execution safe */
  }
}

export function clearSavedClearanceRequest(
  actor: string,
  scope: string,
): void {
  if (typeof sessionStorage === "undefined" || !actor) return;
  try {
    sessionStorage.removeItem(storageKey(actor, scope));
  } catch {
    /* ignore storage cleanup error */
  }
}

export async function saveClearanceCommand<T>(
  actor: string,
  scope: string,
  name: string,
  request: SavedClearanceRequest,
  isReceipt: (value: unknown) => value is T,
  recovering = false,
): Promise<T> {
  const session = await supabase.auth.getSession();
  if (session.error || session.data.session?.user.id !== actor) {
    throw new Error("Sign in with the same account to continue.");
  }
  writeSavedClearanceRequest(actor, scope, request);
  try {
    const receipt = await clearanceRpc<unknown>(name, request.args);
    if (!isReceipt(receipt)) {
      throw new Error(
        "The result could not be confirmed. Verify this saved request before submitting again.",
      );
    }
    clearSavedClearanceRequest(actor, scope);
    return receipt;
  } catch (error) {
    if (!recovering && isDeterministicClearanceRejection(error)) {
      clearSavedClearanceRequest(actor, scope);
    }
    throw error;
  }
}
