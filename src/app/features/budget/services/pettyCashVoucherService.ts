import { supabase } from "../../../../lib/supabase";
import type { CashFundingLine } from "../types";
import { assertCashNeededByIsCurrentOrFuture } from "../selectors/cashWorkflowRules";
export async function createVoucherCashRequest(input:{taskId:string;subtaskId?:string;lines:CashFundingLine[];purpose:string;neededBy?:string;key:string;existingId?:string}) {
  assertCashNeededByIsCurrentOrFuture(input.neededBy);
  const {data,error}=await supabase.rpc("create_contextual_cash_request_v2",{p_task:input.taskId,p_subtask:input.subtaskId||null,p_lines:input.lines,p_purpose:input.purpose,p_needed_by:input.neededBy||null,p_key:input.key,p_existing:input.existingId||null});
  if(error)throw new Error(error.message);return String(data);
}
export async function mapOfficeBudgetAccount(sectionId:string,code:string) {
  const {error}=await supabase.rpc("map_office_budget_account",{p_section:sectionId,p_code:code});if(error)throw new Error(error.message);
}
