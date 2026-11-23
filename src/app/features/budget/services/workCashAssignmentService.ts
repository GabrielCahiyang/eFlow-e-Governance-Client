import { supabase } from "../../../../lib/supabase";
import { assertActionActor } from "../../../shared/actionActor";
import type {
  ReceiptItem,
  TaskCashPools,
  WorkCashAssignment,
  WorkCashAssignmentReceipt,
  WorkCashSourceKind,
} from "../types";
import { SUBTASK_BUDGET_CHANGED_EVENT } from "./budgetService";

const throwIf = (error: { message: string; code?: string } | null) => {
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      throw new Error(
        "Cash distribution is not installed in Supabase yet. Apply migration 20261123100000_work_cash_distribution_and_petty_cash_assignments.sql, then refresh.",
      );
    }
    throw Object.assign(new Error(error.message), { code: error.code });
  }
};

function safeFileName(name: string) {
  return (name.trim() || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function dispatchCashAssignmentChanged(detail: { taskId?: string; subtaskId?: string | null }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SUBTASK_BUDGET_CHANGED_EVENT, { detail }));
    window.dispatchEvent(new Event("eflow:office-petty"));
    window.dispatchEvent(new Event("eflow:expenses-updated"));
  }
}

export function mapTaskCashPools(raw: unknown): TaskCashPools | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const totalsObj = (obj.totals && typeof obj.totals === "object"
    ? obj.totals
    : {}) as Record<string, unknown>;

  const taskCashReleases = Array.isArray(obj.taskCashReleases)
    ? (obj.taskCashReleases as Array<Record<string, unknown>>).map((row) => ({
        requestId: String(row.requestId || ""),
        requestNumber: Number(row.requestNumber || 0),
        purpose: String(row.purpose || ""),
        status: String(row.status || ""),
        sourceLabels: Array.isArray(row.sourceLabels)
          ? row.sourceLabels.map((item) => String(item))
          : [],
        fundingLines: Array.isArray(row.fundingLines)
          ? (row.fundingLines as Array<Record<string, unknown>>).map((line) => ({
              allocationLineId: String(line.allocationLineId || ""),
              amount: Number(line.amount || 0),
              sourceName: line.sourceName ? String(line.sourceName) : undefined,
            }))
          : [],
        releasedAmount: Number(row.releasedAmount || 0),
        assignedToTask: Number(row.assignedToTask || 0),
        assignedToSubtasks: Number(row.assignedToSubtasks || 0),
        unassignedAmount: Number(row.unassignedAmount || 0),
        recordedReceiptsTotal: Number(row.recordedReceiptsTotal || 0),
        liquidationDueAt: row.liquidationDueAt ? String(row.liquidationDueAt) : null,
        holderId: row.holderId ? String(row.holderId) : undefined,
        holderName: String(row.holderName || ""),
        isCurrentHolder: row.isCurrentHolder === true,
        acknowledged: row.acknowledged !== false,
      }))
    : [];

  const officePettyCashReleases = Array.isArray(obj.officePettyCashReleases)
    ? (obj.officePettyCashReleases as Array<Record<string, unknown>>).map((row) => ({
        officeCashRequestId: String(row.officeCashRequestId || ""),
        purpose: String(row.purpose || ""),
        releasedAmount: Number(row.releasedAmount || 0),
        assignedHere: Number(row.assignedHere || 0),
        assignedElsewhere: Number(row.assignedElsewhere || 0),
        unassignedAmount: Number(row.unassignedAmount || 0),
        recordedReceiptsTotal: Number(row.recordedReceiptsTotal || 0),
        liquidationDueAt: row.liquidationDueAt ? String(row.liquidationDueAt) : null,
        holderId: row.holderId ? String(row.holderId) : undefined,
        holderName: String(row.holderName || ""),
        isCurrentHolder: row.isCurrentHolder === true,
      }))
    : [];

  const assignments: WorkCashAssignment[] = Array.isArray(obj.assignments)
    ? (obj.assignments as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id || ""),
        sourceKind: (row.sourceKind === "office_petty_cash"
          ? "office_petty_cash"
          : "task_cash_release") as WorkCashSourceKind,
        sourceRequestId: String(row.sourceRequestId || ""),
        sourceLabel: String(row.sourceLabel || ""),
        sourceOrgId: row.sourceOrgId ? String(row.sourceOrgId) : undefined,
        fundingLines: Array.isArray(row.fundingLines)
          ? (row.fundingLines as Array<Record<string, unknown>>).map((line) => ({
              allocationLineId: String(line.allocationLineId || ""),
              amount: Number(line.amount || 0),
              sourceName: line.sourceName ? String(line.sourceName) : undefined,
            }))
          : [],
        taskId: String(row.taskId || ""),
        subtaskId: row.subtaskId ? String(row.subtaskId) : null,
        subtaskTitle: row.subtaskTitle ? String(row.subtaskTitle) : null,
        amount: Number(row.amount || 0),
        recordedSpent: Number(row.recordedSpent || 0),
        unspentAmount: Number(row.unspentAmount || 0),
        status: (row.status === "recalled" || row.status === "settled"
          ? row.status
          : "active") as WorkCashAssignment["status"],
        note: String(row.note || ""),
        assignedBy: String(row.assignedBy || ""),
        assignedByName: String(row.assignedByName || ""),
        canLogReceipt: row.canLogReceipt === true,
        canRecall: row.canRecall === true,
        receipts: mapAssignmentReceipts(row.receipts),
      }))
    : [];

  return {
    canAssignCash: obj.canAssignCash === true,
    taskCashReleases,
    officePettyCashReleases,
    assignments,
    totals: {
      cashOnHandTask: Number(totalsObj.cashOnHandTask || 0),
      cashOnHandAssigned: Number(totalsObj.cashOnHandAssigned || 0),
      cashOnHandUnassigned: Number(totalsObj.cashOnHandUnassigned || 0),
      officePettyCashOnHand: Number(totalsObj.officePettyCashOnHand || 0),
      officePettyCashAssigned: Number(totalsObj.officePettyCashAssigned || 0),
      subtaskTaskCashAssigned: Number(totalsObj.subtaskTaskCashAssigned || 0),
      subtaskOfficePettyCashAssigned: Number(
        totalsObj.subtaskOfficePettyCashAssigned || 0,
      ),
      unrequestedBudget: Number(totalsObj.unrequestedBudget || 0),
    },
  };
}

function mapAssignmentReceipts(raw: unknown): WorkCashAssignmentReceipt[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || ""),
    assignmentId: String(row.assignmentId || ""),
    taskId: row.taskId ? String(row.taskId) : undefined,
    subtaskId: row.subtaskId ? String(row.subtaskId) : null,
    subtaskTitle: row.subtaskTitle ? String(row.subtaskTitle) : null,
    vendor: String(row.vendor || ""),
    receiptNumber: String(row.receiptNumber || ""),
    receiptDate: String(row.receiptDate || ""),
    description: String(row.description || ""),
    amount: Number(row.amount || 0),
    items: Array.isArray(row.items)
      ? (row.items as Array<Record<string, unknown>>).map((item, idx) => ({
          id: String(item.id || `${row.id || "item"}-${idx}`),
          allocationLineId: String(item.allocationLineId || ""),
          quantity: Number(item.quantity || 1),
          unit: String(item.unit || "lot"),
          particular: String(item.particular || ""),
          amount: Number(item.amount || 0),
          purpose: String(item.purpose || ""),
          accountName: item.accountName ? String(item.accountName) : undefined,
          accountLabel: item.accountLabel ? String(item.accountLabel) : undefined,
        }))
      : [],
    fileName: String(row.fileName || "receipt"),
    filePath: String(row.filePath || ""),
    mimeType: String(row.mimeType || "application/octet-stream"),
    fileSize: Number(row.fileSize || 0),
    uploadedBy: String(row.uploadedBy || ""),
    uploadedByName: String(row.uploadedByName || ""),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    canDelete: row.canDelete === true,
  }));
}

export async function assignWorkCash(input: {
  taskId: string;
  subtaskId?: string | null;
  sourceKind: WorkCashSourceKind;
  sourceRequestId: string;
  amount: number;
  note?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("assign_work_cash", {
    p_task_id: input.taskId,
    p_subtask_id: input.subtaskId || null,
    p_source_kind: input.sourceKind,
    p_source_request_id: input.sourceRequestId,
    p_amount: input.amount,
    p_note: input.note?.trim() || "",
    p_key: input.idempotencyKey || crypto.randomUUID(),
  });
  throwIf(error);
  dispatchCashAssignmentChanged({
    taskId: input.taskId,
    subtaskId: input.subtaskId ?? null,
  });
  return String(data);
}

export async function recallWorkCash(input: {
  assignmentId: string;
  taskId?: string;
  subtaskId?: string | null;
  reason?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("recall_work_cash", {
    p_assignment_id: input.assignmentId,
    p_reason: input.reason?.trim() || "",
    p_key: input.idempotencyKey || crypto.randomUUID(),
  });
  throwIf(error);
  dispatchCashAssignmentChanged({
    taskId: input.taskId,
    subtaskId: input.subtaskId ?? null,
  });
  return String(data);
}

export async function recordAssignmentReceipt(input: {
  assignment: WorkCashAssignment;
  actor: string;
  vendor: string;
  receiptNumber?: string;
  receiptDate: string;
  description: string;
  amount: number;
  items?: ReceiptItem[];
  file: File;
  idempotencyKey?: string;
}): Promise<string> {
  const { assignment, file } = input;
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (file.size > 10 * 1024 * 1024 || !allowedTypes.includes(file.type)) {
    throw new Error("Attach a JPG, PNG, WebP, or PDF receipt up to 10 MB.");
  }

  const key = input.idempotencyKey || crypto.randomUUID();
  await assertActionActor(input.actor);

  const isOfficeCash = assignment.sourceKind === "office_petty_cash";
  const bucketName = isOfficeCash ? "office-petty-receipts" : "budget-receipts";
  const filePath = isOfficeCash
    ? `${assignment.sourceRequestId}/assignments/${assignment.id}/${key}-${safeFileName(file.name)}`
    : `${assignment.sourceOrgId}/${assignment.sourceRequestId}/assignments/${assignment.id}/${key}-${safeFileName(file.name)}`;

  const bucket = supabase.storage.from(bucketName);
  const { error: uploadError } = await bucket.upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  await assertActionActor(input.actor);
  const { data, error } = await supabase.rpc("record_assignment_receipt", {
    p_assignment_id: assignment.id,
    p_vendor: input.vendor.trim(),
    p_receipt_number: input.receiptNumber?.trim() || null,
    p_receipt_date: input.receiptDate,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_items: (input.items ?? []).map((item) => ({
      allocationLineId: item.allocationLineId,
      quantity: item.quantity,
      unit: item.unit.trim(),
      particular: item.particular.trim(),
      purpose: item.purpose.trim(),
      amount: item.amount,
    })),
    p_file_name: file.name,
    p_file_path: filePath,
    p_mime_type: file.type || "application/octet-stream",
    p_file_size: file.size,
    p_key: key,
  });
  if (error) {
    // Best-effort cleanup of orphan file if DB validation rejected the receipt
    void bucket.remove([filePath]).catch(() => {});
    throwIf(error);
  }
  dispatchCashAssignmentChanged({
    taskId: assignment.taskId,
    subtaskId: assignment.subtaskId ?? null,
  });
  return String(data);
}

export async function deleteAssignmentReceipt(input: {
  receiptId: string;
  sourceKind: WorkCashSourceKind;
  filePath: string;
  taskId?: string;
  subtaskId?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("delete_assignment_receipt", {
    p_receipt_id: input.receiptId,
  });
  throwIf(error);
  const bucketName =
    input.sourceKind === "office_petty_cash"
      ? "office-petty-receipts"
      : "budget-receipts";
  void supabase.storage
    .from(bucketName)
    .remove([input.filePath])
    .catch(() => {});
  dispatchCashAssignmentChanged({
    taskId: input.taskId,
    subtaskId: input.subtaskId ?? null,
  });
}

export async function fetchRequestAssignmentReceipts(
  pettyCashRequestId: string,
): Promise<WorkCashAssignmentReceipt[]> {
  const { data, error } = await supabase.rpc("get_request_assignment_receipts", {
    p_petty_cash_request_id: pettyCashRequestId,
  });
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return [];
    }
    throwIf(error);
  }
  return mapAssignmentReceipts(data);
}

export async function createAssignmentReceiptSignedUrl(
  sourceKind: WorkCashSourceKind,
  filePath: string,
): Promise<string> {
  const bucketName =
    sourceKind === "office_petty_cash"
      ? "office-petty-receipts"
      : "budget-receipts";
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, 600);
  if (error) throw new Error(error.message);
  return data!.signedUrl;
}
