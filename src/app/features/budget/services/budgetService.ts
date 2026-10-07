import { supabase } from "../../../../lib/supabase";
import type { AccountingAccount, BudgetLineInput, DepartmentBudgetBundle, GeneralJournalEntry, JournalAdjustmentLineInput, ReceiptDraft, TaskFundingContext } from "../types";
import { mapAdjustment, mapAllocation, mapAllocationLine, mapBudgetLine, mapBudgetSummary, mapCommitment, mapLedger, mapLiquidation, mapReceipt, mapRelease, mapRequest } from "./budgetMappers";
import { assertCashNeededByIsCurrentOrFuture } from "../selectors/cashWorkflowRules";
import { fetchBudgetSections } from "./budgetSectionService";

const throwIf = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export async function fetchDepartmentFiscalYears(orgId: string) {
  const { data, error } = await supabase.from("department_fiscal_budgets")
    .select("fiscal_year,status,approved_amount")
    .eq("org_id", orgId)
    .order("fiscal_year", { ascending: false });
  throwIf(error);
  return (data || []).map((row) => ({
    year: Number(row.fiscal_year),
    status: String(row.status),
    amount: Number(row.approved_amount || 0),
  }));
}

export async function fetchDepartmentBudgetBundle(orgId: string, fiscalYear: number): Promise<DepartmentBudgetBundle> {
  const summaryResult = await supabase.rpc("department_budget_summary", { p_org_id: orgId, p_fiscal_year: fiscalYear });
  if (summaryResult.error) {
    if (/not found|schema cache/i.test(summaryResult.error.message)) throw new Error("Apply the office budget migration, then refresh this page.");
    throw new Error(summaryResult.error.message);
  }
  const summary = summaryResult.data ? mapBudgetSummary(summaryResult.data as Record<string, unknown>) : null;
  const sectionData = await fetchBudgetSections(orgId, fiscalYear);
  if (!summary) return { ...sectionData, summary: null, lines: [], commitments: [], allocations: [], allocationLines: [], requests: [], requestAttachments: [], releases: [], liquidations: [], ledger: [], adjustments: [] };
  const [linesResult, commitmentsResult, requestsResult, ledgerResult, adjustmentsResult] = await Promise.all([
    supabase.from("department_budget_lines").select("*").eq("fiscal_budget_id", summary.id).order("position"),
    supabase.from("budget_commitments").select("*").eq("fiscal_budget_id", summary.id).order("created_at", { ascending: false }),
    supabase.from("petty_cash_requests").select("*").eq("fiscal_budget_id", summary.id).order("created_at", { ascending: false }),
    supabase.from("budget_ledger_entries").select("*").eq("fiscal_budget_id", summary.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("department_budget_adjustments").select("*").eq("fiscal_budget_id", summary.id).order("created_at", { ascending: false }),
  ]);
  [linesResult.error, commitmentsResult.error, requestsResult.error, ledgerResult.error].forEach(throwIf);
  if (adjustmentsResult.error && !isMissingSchemaObject(adjustmentsResult.error.message)) throwIf(adjustmentsResult.error);
  const commitments = (commitmentsResult.data || []).map((row) => mapCommitment(row as Record<string, unknown>));
  const commitmentIds = commitments.map((item) => item.id);
  const requestRows = (requestsResult.data || []) as Array<Record<string, unknown>>;
  const profileIds = uniqueIds(requestRows.flatMap((row) => [row.requester_id, row.task_leader_id, row.cash_recipient_id]));
  const taskIds = uniqueIds(requestRows.map((row) => row.task_id));
  const subtaskIds = uniqueIds(requestRows.map((row) => row.subtask_id));
  const [profilesResult, tasksResult, requestSubtasksResult] = await Promise.all([
    profileIds.length ? supabase.from("profiles").select("id,full_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    taskIds.length ? supabase.from("tasks").select("id,title").in("id", taskIds) : Promise.resolve({ data: [], error: null }),
    subtaskIds.length ? supabase.from("subtasks").select("id,title").in("id", subtaskIds) : Promise.resolve({ data: [], error: null }),
  ]);
  throwIf(profilesResult.error); throwIf(tasksResult.error); throwIf(requestSubtasksResult.error);
  const profileById = rowMap(profilesResult.data || []);
  const taskById = rowMap(tasksResult.data || []);
  const requestSubtaskById = rowMap(requestSubtasksResult.data || []);
  const requests = requestRows.map((row) => mapRequest({
    ...row,
    requester: profileById.get(String(row.requester_id || "")),
    task_leader: profileById.get(String(row.task_leader_id || "")),
    cash_recipient: profileById.get(String(row.cash_recipient_id || "")),
    task: taskById.get(String(row.task_id || "")),
    subtask: requestSubtaskById.get(String(row.subtask_id || "")),
  }));
  const requestIds = requests.map((item) => item.id);
  const [allocationsResult, liquidationsResult, releasesResult, requestAttachmentsResult] = await Promise.all([
    commitmentIds.length ? supabase.from("work_budget_allocations").select("*").in("commitment_id", commitmentIds).order("requested_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    requestIds.length ? supabase.from("petty_cash_liquidations").select("*").in("request_id", requestIds).order("submitted_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    requestIds.length ? supabase.from("petty_cash_releases").select("*").in("request_id", requestIds).order("scheduled_date", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    requestIds.length ? supabase.from("petty_cash_request_attachments").select("*").in("request_id", requestIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  throwIf(allocationsResult.error); throwIf(liquidationsResult.error); throwIf(releasesResult.error);
  if (requestAttachmentsResult.error && !isMissingSchemaObject(requestAttachmentsResult.error.message)) throwIf(requestAttachmentsResult.error);
  const allocationRows = (allocationsResult.data || []) as Array<Record<string, unknown>>;
  const allocationSubtaskIds = uniqueIds(allocationRows.map((row) => row.subtask_id));
  const allocationSubtasksResult = allocationSubtaskIds.length
    ? await supabase.from("subtasks").select("id,title,assigned_to_ids").in("id", allocationSubtaskIds)
    : { data: [], error: null };
  throwIf(allocationSubtasksResult.error);
  const allocationSubtaskById = rowMap(allocationSubtasksResult.data || []);
  const allocations = allocationRows.map((row) => mapAllocation({
    ...row,
    subtask: allocationSubtaskById.get(String(row.subtask_id || "")),
  }));
  const allocationIds = allocations.map((item) => item.id);
  const allocationLinesResult = allocationIds.length
    ? await supabase.from("work_budget_allocation_lines").select("*").in("allocation_id", allocationIds).order("position")
    : { data: [], error: null };
  throwIf(allocationLinesResult.error);
  const liquidationRows = liquidationsResult.data || [];
  const liquidationIds = liquidationRows.map((row) => String((row as Record<string, unknown>).id));
  const receiptsResult = liquidationIds.length
    ? await supabase.from("petty_cash_receipts").select("*").in("liquidation_id", liquidationIds)
    : { data: [], error: null };
  throwIf(receiptsResult.error);
  const receiptIds = (receiptsResult.data || []).map(r=>String(r.id));
  const [cashLinesResult,itemsResult] = await Promise.all([
    requestIds.length ? supabase.from("petty_cash_request_lines").select("*").in("request_id",requestIds) : Promise.resolve({data:[],error:null}),
    receiptIds.length ? supabase.from("petty_cash_receipt_items").select("*").in("receipt_id",receiptIds).order("position") : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [cashLinesResult,itemsResult]) if(result.error&&!isMissingSchemaObject(result.error.message))throwIf(result.error);
  requests.forEach(r=>{r.fundingLines=(cashLinesResult.data||[]).filter(l=>l.request_id===r.id).map(l=>({allocationLineId:String(l.allocation_line_id),amount:Number(l.amount),sourceName:String((allocationLinesResult.data||[]).find(s=>s.id===l.allocation_line_id)?.category||"Approved source")}));});
  const receipts = (receiptsResult.data || []).map(row=>({...mapReceipt(row as Record<string,unknown>),items:(itemsResult.data||[]).filter(i=>i.receipt_id===row.id).map(i=>({id:String(i.id),allocationLineId:String(i.allocation_line_id),quantity:Number(i.quantity),unit:String(i.unit),particular:String(i.particular),purpose:String(i.purpose),amount:Number(i.amount),accountName:String(i.account_name),accountLabel:i.account_label?String(i.account_label):undefined}))}));
  return {
    ...sectionData,
    summary,
    lines: (linesResult.data || []).map((row) => mapBudgetLine(row as Record<string, unknown>)),
    commitments,
    allocations,
    allocationLines: (allocationLinesResult.data || []).map((row) => mapAllocationLine(row as Record<string, unknown>)),
    requests,
    requestAttachments: requestAttachmentsResult.error ? [] : (requestAttachmentsResult.data || []).map((row) => ({
      id: String(row.id), requestId: String(row.request_id), fileName: String(row.file_name || "Attachment"),
      filePath: String(row.file_path || ""), mimeType: String(row.mime_type || "application/octet-stream"),
      fileSize: Number(row.file_size || 0), createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
    })),
    releases: (releasesResult.data || []).map((row) => mapRelease(row as Record<string, unknown>)),
    liquidations: liquidationRows.map((row) => mapLiquidation(row as Record<string, unknown>, receipts)),
    ledger: (ledgerResult.data || []).map((row) => mapLedger(row as Record<string, unknown>)),
    adjustments: adjustmentsResult.error ? [] : (adjustmentsResult.data || []).map((row) => mapAdjustment(row as Record<string, unknown>)),
    schemaWarnings: adjustmentsResult.error ? ["The latest fiscal controls update has not been applied to the live system."] : [],
  };
}

export async function saveDepartmentFiscalBudget(input: {
  orgId: string; fiscalYear: number; pettyCashLimit: number; requestLimit: number;
  liquidationDueDays?: number; allowReceiptLimitOverride?: boolean;
  threshold: number; notes: string; lines: BudgetLineInput[];
}) {
  const { data, error } = await supabase.rpc("save_department_fiscal_budget_v2", {
    p_org_id: input.orgId, p_fiscal_year: input.fiscalYear,
    p_daily_release_limit: input.pettyCashLimit, p_per_receipt_limit: input.requestLimit,
    p_liquidation_due_days: input.liquidationDueDays ?? 15,
    p_allow_receipt_limit_override: input.allowReceiptLimitOverride ?? false,
    p_underutilization_threshold: input.threshold, p_notes: input.notes,
    p_lines: input.lines.map((line, position) => ({ ...line, position })),
  });
  throwIf(error); return String(data);
}

export async function lockDepartmentFiscalBudget(budgetId: string) {
  const { error } = await supabase.rpc("lock_department_fiscal_budget", { p_budget_id: budgetId }); throwIf(error);
}

export async function createWorkBudgetAllocation(input: { taskId: string; subtaskId?: string; amount: number; reason: string }) {
  const { data, error } = await supabase.rpc("create_work_budget_allocation", {
    p_task_id: input.taskId, p_subtask_id: input.subtaskId || null, p_amount: input.amount, p_reason: input.reason,
  }); throwIf(error); return String(data);
}

export async function createSubtaskBudgetAllocation(input: { taskId: string; subtaskId: string; parentAllocationLineId?: string; amount: number; reason: string }) {
  const { data, error } = await supabase.rpc("create_subtask_budget_allocation", {
    p_task_id: input.taskId, p_subtask_id: input.subtaskId,
    p_parent_allocation_line_id: input.parentAllocationLineId || null,
    p_amount: input.amount, p_reason: input.reason,
  }); throwIf(error); return String(data);
}

export async function decideWorkBudgetAllocation(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("decide_work_budget_allocation", { p_allocation_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function createPettyCashRequest(input: { allocationId: string; amount: number; purpose: string; neededBy?: string }) {
  assertCashNeededByIsCurrentOrFuture(input.neededBy);
  const { data, error } = await supabase.rpc("create_petty_cash_request", {
    p_allocation_id: input.allocationId, p_amount: input.amount, p_purpose: input.purpose, p_needed_by: input.neededBy || null,
  }); throwIf(error); return String(data);
}

export async function fetchTaskFundingContext(taskId: string, subtaskId?: string): Promise<TaskFundingContext> {
  const { data, error } = await supabase.rpc("get_task_funding_context", {
    p_task_id: taskId,
    p_subtask_id: subtaskId || null,
  });
  throwIf(error);
  const row = (data || {}) as Record<string, unknown>;
  const cap = row.cap && typeof row.cap === "object" ? row.cap as Record<string, unknown> : undefined;
  const lines = Array.isArray(row.lines) ? row.lines as Array<Record<string, unknown>> : [];
  return {
    funded: Boolean(row.funded),
    supportsItemizedCash: Boolean(row.supportsItemizedCash),
    fiscalYear: row.fiscalYear ? Number(row.fiscalYear) : undefined,
    fundingOrgId: row.fundingOrgId ? String(row.fundingOrgId) : undefined,
    taskId: String(row.taskId || taskId),
    subtaskId: row.subtaskId ? String(row.subtaskId) : undefined,
    taskAllocationId: row.taskAllocationId ? String(row.taskAllocationId) : undefined,
    taskBudget: Number(row.taskBudget || 0),
    available: Number(row.available || 0),
    taskLeaderId: row.taskLeaderId ? String(row.taskLeaderId) : undefined,
    cap: cap ? {
      id: String(cap.id), amount: Number(cap.amount || 0), available: Number(cap.available || 0),
      allocationLineId: String(cap.allocationLineId || ""), reason: String(cap.reason || ""),
    } : undefined,
    lines: lines.map((line) => ({
      id: String(line.id), expenseClass: String(line.expenseClass || ""),
      category: String(line.category || ""), particular: String(line.particular || ""),
      fundSource: String(line.fundSource || ""), amount: Number(line.amount || 0),
      available: Number(line.available || 0),
    })),
  };
}

export async function createContextualCashRequest(input: {
  taskId: string;
  subtaskId?: string;
  allocationLineId: string;
  amount: number;
  purpose: string;
  neededBy?: string;
  idempotencyKey: string;
}) {
  assertCashNeededByIsCurrentOrFuture(input.neededBy);
  const { data, error } = await supabase.rpc("create_contextual_cash_request", {
    p_task_id: input.taskId,
    p_subtask_id: input.subtaskId || null,
    p_allocation_line_id: input.allocationLineId,
    p_amount: input.amount,
    p_purpose: input.purpose,
    p_needed_by: input.neededBy || null,
    p_idempotency_key: input.idempotencyKey,
  });
  throwIf(error);
  return String(data);
}

export async function resubmitContextualCashRequest(input: {
  requestId: string;
  allocationLineId: string;
  amount: number;
  purpose: string;
  neededBy?: string;
}) {
  assertCashNeededByIsCurrentOrFuture(input.neededBy);
  const { error } = await supabase.rpc("resubmit_contextual_cash_request", {
    p_request_id: input.requestId,
    p_allocation_line_id: input.allocationLineId,
    p_amount: input.amount,
    p_purpose: input.purpose,
    p_needed_by: input.neededBy || null,
  });
  throwIf(error);
}

export async function setSubtaskBudgetCap(input: {
  taskId: string;
  subtaskId: string;
  allocationLineId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("set_subtask_budget_cap", {
    p_task_id: input.taskId,
    p_subtask_id: input.subtaskId,
    p_parent_allocation_line_id: input.allocationLineId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  throwIf(error);
  return String(data);
}

export async function removeSubtaskBudgetCap(input: { capId: string; reason: string; idempotencyKey: string }) {
  const { error } = await supabase.rpc("remove_subtask_budget_cap", {
    p_cap_allocation_id: input.capId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  throwIf(error);
}

export async function cancelContextualCashRequest(requestId: string, reason: string) {
  const { error } = await supabase.rpc("cancel_contextual_cash_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  throwIf(error);
}

export async function resubmitPettyCashRequest(input: { requestId: string; amount: number; purpose: string; neededBy?: string }) {
  assertCashNeededByIsCurrentOrFuture(input.neededBy);
  const { error } = await supabase.rpc("resubmit_petty_cash_request", {
    p_request_id: input.requestId, p_amount: input.amount,
    p_purpose: input.purpose, p_needed_by: input.neededBy || null,
  }); throwIf(error);
}

export async function decidePettyCashRequest(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("decide_petty_cash_request", { p_request_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function decidePettyCashLeaderReview(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("decide_petty_cash_leader_review", { p_request_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function markPettyCashReleased(releaseId: string, release?: { method: "cash" | "cheque"; chequeNumber?: string }) {
  if (!release) {
    const { error } = await supabase.rpc("mark_petty_cash_released", { p_release_id: releaseId });
    throwIf(error);
    return;
  }
  const { error } = await supabase.rpc("record_accounting_petty_cash_release", {
    p_release_id: releaseId,
    p_release_method: release?.method || "cash",
    p_cheque_number: release?.method === "cheque" ? release.chequeNumber?.trim() || null : null,
  });
  throwIf(error);
}

export async function recordAccountingRelease(input: { releaseId: string; method: "cash" | "cheque"; chequeNumber?: string }) {
  await markPettyCashReleased(input.releaseId, { method: input.method, chequeNumber: input.chequeNumber });
}

export async function overridePettyCashReleaseSchedule(releaseId: string, reason: string) {
  if (reason.trim().length < 10) throw new Error("Explain the schedule override in at least 10 characters.");
  const { error } = await supabase.rpc("override_petty_cash_release_schedule", {
    p_release_id: releaseId, p_reason: reason.trim(),
  });
  if (error?.code === "PGRST202" || (error && /could not find.*override_petty_cash_release_schedule/i.test(error.message))) {
    throw new Error("The cash release override is not installed in Supabase yet. Apply migration 20260831000002_cash_release_schedule_override.sql, then try again.");
  }
  throwIf(error);
}

export async function overrideAccountingPettyCashReleaseSchedule(input: {
  releaseId: string;
  reason: string;
  method: "cash" | "cheque";
  chequeNumber?: string;
}) {
  if (input.reason.trim().length < 10) {
    throw new Error("Explain the schedule override in at least 10 characters.");
  }
  const { error } = await supabase.rpc("override_accounting_petty_cash_release_schedule", {
    p_release_id: input.releaseId,
    p_reason: input.reason.trim(),
    p_release_method: input.method,
    p_cheque_number: input.method === "cheque" ? input.chequeNumber?.trim() || null : null,
  });
  if (error?.code === "PGRST202" || (error && /could not find.*override_accounting_petty_cash_release_schedule/i.test(error.message))) {
    throw new Error("The accounting schedule override is not installed in Supabase. Run migration 20260919000003_accounting_release_schedule_override.sql in the SQL Editor, then retry.");
  }
  throwIf(error);
}

export async function acknowledgePettyCashRelease(releaseId: string, voucherNumber?: string) {
  const { error } = voucherNumber
    ? await supabase.rpc("acknowledge_accounting_release", { p_release_id: releaseId, p_voucher_number: voucherNumber })
    : await supabase.rpc("acknowledge_petty_cash_release", { p_release_id: releaseId });
  throwIf(error);
}

export async function adjustDepartmentFiscalBudget(input: { budgetId: string; adjustedAmount: number; reason: string; supportFilePath?: string }) {
  const { data, error } = await supabase.rpc("adjust_department_fiscal_budget", {
    p_budget_id: input.budgetId, p_adjusted_amount: input.adjustedAmount,
    p_reason: input.reason, p_support_file_path: input.supportFilePath || null,
  }); throwIf(error); return String(data);
}

export async function closeDepartmentFiscalBudget(budgetId: string, reason: string) {
  const { error } = await supabase.rpc("close_department_fiscal_budget", { p_budget_id: budgetId, p_reason: reason }); throwIf(error);
}

let maintenancePromise: Promise<void> | null = null;
export function runDepartmentBudgetMaintenance() {
  if (maintenancePromise) return maintenancePromise;
  maintenancePromise = (async () => {
    const { error } = await supabase.rpc("run_department_budget_maintenance");
    if (error && !/not found|schema cache/i.test(error.message)) throw new Error(error.message);
  })();
  const current = maintenancePromise;
  void current.finally(() => { if (maintenancePromise === current) maintenancePromise = null; });
  return current;
}

function safeFileName(name: string) { return (name.trim() || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_"); }

export async function uploadCashRequestAttachment(input: { orgId: string; requestId: string; file: File }) {
  const filePath = `${input.orgId}/${input.requestId}/requests/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage.from("budget-receipts").upload(filePath, input.file, { upsert: false });
  throwIf(uploadError);
  const { data, error } = await supabase.rpc("add_cash_request_attachment", {
    p_request_id: input.requestId,
    p_file_name: input.file.name,
    p_file_path: filePath,
    p_mime_type: input.file.type || "application/octet-stream",
    p_file_size: input.file.size,
  });
  if (error) {
    await supabase.storage.from("budget-receipts").remove([filePath]);
    throw new Error(error.message);
  }
  return String(data);
}

export async function submitPettyCashLiquidation(input: { orgId: string; requestId: string; spent: number; note: string; receipts: ReceiptDraft[]; refundReceiptNumber?: string; refundDate?: string; idempotencyKey?: string }) {
  const uploaded: Array<{ fileName: string; filePath: string; mimeType: string; fileSize: number }> = [];
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  let rpcStarted = false;
  try {
    for (const [index, receipt] of input.receipts.entries()) {
      if (!receipt.file) throw new Error("Attach a file for every receipt row.");
      // A stable command-scoped path makes a network retry idempotent at the
      // storage layer as well as in PostgreSQL, avoiding orphaned duplicates.
      const filePath = `${input.orgId}/${input.requestId}/${idempotencyKey}-${index}-${safeFileName(receipt.file.name)}`;
      const { error } = await supabase.storage.from("budget-receipts").upload(filePath, receipt.file, { upsert: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throwIf(error);
      uploaded.push({ fileName: receipt.file.name, filePath, mimeType: receipt.file.type || "application/octet-stream", fileSize: receipt.file.size });
    }
    const payload = input.receipts.map((receipt, index) => ({
      vendor: receipt.vendor, receiptNumber: receipt.receiptNumber, receiptDate: receipt.receiptDate,
      description: receipt.description.trim() || receipt.items?.map(i=>i.particular).join(", ") || "", amount: receipt.amount, overrideReason: receipt.overrideReason, ...uploaded[index],
      ...(receipt.items ? {items:receipt.items} : {}),
    }));
    // Once PostgreSQL is called, a transport failure cannot prove the command
    // rolled back. Keep the stable files so an idempotent retry can reconcile.
    rpcStarted = true;
    const itemized = input.receipts.some(r=>r.items!==undefined);
    const { data, error } = itemized ? await supabase.rpc("submit_itemized_cash_liquidation", {
      p_request:input.requestId,p_spent:input.spent,p_note:input.note,p_receipts:payload,p_key:idempotencyKey,
      p_refund_number:input.refundReceiptNumber?.trim()||null,p_refund_date:input.refundDate||null,
    }) : await supabase.rpc("submit_accounting_cash_liquidation", {
      p_request_id: input.requestId, p_declared_spent: input.spent, p_note: input.note, p_receipts: payload,
      p_idempotency_key: idempotencyKey,
      p_refund_receipt_number: input.refundReceiptNumber?.trim() || null,
      p_refund_date: input.refundDate || null,
    });
    // Older deployments can lack the accounting wrapper while still having the
    // contextual liquidation command. It is equivalent when no cash is returned.
    if (error?.code === "PGRST202" && !itemized && !input.refundReceiptNumber?.trim()) {
      const fallback = await supabase.rpc("submit_contextual_cash_liquidation", {
        p_request_id: input.requestId, p_declared_spent: input.spent, p_note: input.note,
        p_receipts: payload, p_idempotency_key: idempotencyKey,
      });
      throwIf(fallback.error);
      return String(fallback.data);
    }
    if (error?.code === "PGRST202") {
      throw new Error("The accounting liquidation function is not installed in Supabase. Apply migration 20260919000000_phase04_phase05_accounting.sql before submitting a cash return.");
    }
    throwIf(error);
    return String(data);
  } catch (error) {
    if (!rpcStarted && uploaded.length) await supabase.storage.from("budget-receipts").remove(uploaded.map((item) => item.filePath));
    const message = error instanceof Error ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message : "Could not submit the liquidation.";
    throw new Error(message);
  }
}

export async function decidePettyCashLiquidation(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("settle_accounting_liquidation", { p_liquidation_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function authorizeLateLiquidation(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("decide_petty_cash_liquidation", { p_liquidation_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function decidePettyCashLiquidationLeaderReview(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("decide_petty_cash_liquidation_leader_review", { p_liquidation_id: id, p_approve: approve, p_reason: reason }); throwIf(error);
}

export async function createReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("budget-receipts").createSignedUrl(path, 600); throwIf(error); return data!.signedUrl;
}

export async function fetchAccountingAccounts(): Promise<AccountingAccount[]> {
  const { data, error } = await supabase.from("accounting_accounts")
    .select("code,title,classification,normal_balance")
    .eq("is_active", true)
    .order("code");
  throwIf(error);
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    code: String(row.code),
    title: String(row.title),
    classification: String(row.classification) as AccountingAccount["classification"],
    normalBalance: String(row.normal_balance) as AccountingAccount["normalBalance"],
  }));
}

export async function fetchGeneralJournal(orgId: string, fiscalYear: number): Promise<GeneralJournalEntry[]> {
  const start = `${fiscalYear}-01-01`;
  const end = `${fiscalYear + 1}-01-01`;
  const entriesResult = await supabase.from("general_journal_entries").select("*")
    .eq("org_id", orgId).gte("entry_date", start).lt("entry_date", end)
    .order("entry_date", { ascending: false }).order("entry_number", { ascending: false });
  throwIf(entriesResult.error);
  const entryRows = (entriesResult.data || []) as Array<Record<string, unknown>>;
  const entryIds = entryRows.map((row) => String(row.id));
  const posterIds = uniqueIds(entryRows.map((row) => row.posted_by));
  const [linesResult, profilesResult] = await Promise.all([
    entryIds.length ? supabase.from("general_journal_lines").select("*").in("journal_entry_id", entryIds).order("line_number") : Promise.resolve({ data: [], error: null }),
    posterIds.length ? supabase.from("profiles").select("id,full_name").in("id", posterIds) : Promise.resolve({ data: [], error: null }),
  ]);
  throwIf(linesResult.error); throwIf(profilesResult.error);
  const profileById = rowMap((profilesResult.data || []) as Array<Record<string, unknown>>);
  const lineRows = (linesResult.data || []) as Array<Record<string, unknown>>;
  return entryRows.map((row) => ({
    id: String(row.id),
    entryNumber: Number(row.entry_number || 0),
    fiscalBudgetId: String(row.fiscal_budget_id),
    orgId: String(row.org_id),
    entryDate: String(row.entry_date),
    referenceNumber: String(row.reference_number || ""),
    sourceType: String(row.source_type) as GeneralJournalEntry["sourceType"],
    sourceId: row.source_id ? String(row.source_id) : undefined,
    memo: String(row.memo || ""),
    postedBy: row.posted_by ? String(row.posted_by) : undefined,
    postedByName: (profileById.get(String(row.posted_by || "")) as { full_name?: string } | undefined)?.full_name,
    postedAt: row.posted_at ? new Date(String(row.posted_at)).getTime() : 0,
    lines: lineRows.filter((line) => String(line.journal_entry_id) === String(row.id)).map((line) => ({
      id: String(line.id),
      lineNumber: Number(line.line_number || 0),
      accountCode: String(line.account_code || ""),
      accountTitle: String(line.account_title || ""),
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    })),
  }));
}

export async function postGeneralJournalAdjustment(input: {
  fiscalBudgetId: string;
  entryDate: string;
  referenceNumber: string;
  memo: string;
  lines: JournalAdjustmentLineInput[];
}) {
  const { data, error } = await supabase.rpc("post_general_journal_adjustment", {
    p_fiscal_budget_id: input.fiscalBudgetId,
    p_entry_date: input.entryDate,
    p_reference_number: input.referenceNumber,
    p_memo: input.memo,
    p_lines: input.lines.map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })),
  });
  throwIf(error);
  return String(data);
}

function uniqueIds(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || "")).filter(Boolean)));
}

function rowMap(rows: Array<Record<string, unknown>>) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function isMissingSchemaObject(message: string) {
  return /schema cache|could not find the table|does not exist/i.test(message);
}
