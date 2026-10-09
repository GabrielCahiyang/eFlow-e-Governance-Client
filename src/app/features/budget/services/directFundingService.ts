import { supabase } from "../../../../lib/supabase";
export interface DirectFundingLine { partitionId: string; amount: number; particular: string }
export async function fundOfficeWork(input: { taskId: string; fiscalYear: number; lines: DirectFundingLine[]; reason: string; authorizationKey: string }) {
  const { data,error }=await supabase.rpc("fund_office_work",{p_task_id:input.taskId,p_fiscal_year:input.fiscalYear,p_lines:input.lines,p_reason:input.reason.trim(),p_authorization_key:input.authorizationKey});
  if(error) throw new Error(error.message);
  return String(data);
}
