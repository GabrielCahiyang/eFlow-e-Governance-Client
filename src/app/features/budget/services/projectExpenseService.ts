import { supabase } from '../../../../lib/supabase';
import { budgetReportRead } from './budgetReportReads';

const pendingStatuses = ['liquidation_submitted', 'pending_leader_liquidation_review', 'pending_department_settlement'];
type Amounts = { settled: number; pending: number; pendingCount: number; budget?: number; complete?: boolean; expenseCount?: number };
export type ProjectExpenseTotals = { tasks: Map<string, Amounts>; subtasks: Map<string, Amounts> };

export async function fetchProjectExpenseTotals(taskIds: string[]): Promise<ProjectExpenseTotals> {
  const lead = await budgetReportRead(ids => supabase.rpc('task_lead_expense_totals', { p_task_ids: ids }, { count: 'exact' })
    .order('task_id').order('subtask_id'), taskIds);
  if (lead.error) throw new Error(lead.error.message);
  const completeTasks = new Set((lead.data ?? []).filter(row => !row.subtask_id).map(row => String(row.task_id)));
  const visibleTasks = taskIds.filter(id => !completeTasks.has(id));
  const requests = await budgetReportRead(ids => supabase.from('petty_cash_requests')
    .select('id,task_id,subtask_id,status,actual_spent', { count: 'exact' })
    .in('task_id', ids).in('status', ['settled', ...pendingStatuses]).order('id'), visibleTasks);
  if (requests.error) throw new Error(requests.error.message);

  const pendingIds = (requests.data ?? []).filter(row => row.status !== 'settled').map(row => String(row.id));
  const liquidations = await budgetReportRead(ids => supabase.from('petty_cash_liquidations')
    .select('id,request_id,version,declared_spent,status', { count: 'exact' })
    .in('request_id', ids).order('id'), pendingIds);
  if (liquidations.error) throw new Error(liquidations.error.message);

  const latest = new Map<string, NonNullable<typeof liquidations.data>[number]>();
  for (const row of liquidations.data ?? []) {
    const id = String(row.request_id);
    if (!latest.has(id) || Number(row.version) > Number(latest.get(id)?.version)) latest.set(id, row);
  }
  const totals: ProjectExpenseTotals = { tasks: new Map(), subtasks: new Map() };
  for (const row of lead.data ?? []) {
    const target = row.subtask_id ? totals.subtasks : totals.tasks;
    target.set(String(row.subtask_id ?? row.task_id), {
      settled: Math.round(Number(row.settled) * 100),
      pending: Math.round(Number(row.pending) * 100),
      pendingCount: Number(row.pending_count),
      expenseCount: Number(row.expense_count),
      budget: row.subtask_budget == null ? undefined : Number(row.subtask_budget),
      complete: true,
    });
  }
  const counted = new Set<string>();
  function add(target: Map<string, Amounts>, id: string, bucket: 'settled' | 'pending', cents: number) {
    const total = target.get(id) ?? { settled: 0, pending: 0, pendingCount: 0 };
    total[bucket] += cents;
    if (bucket === 'pending') total.pendingCount++;
    target.set(id, total);
  }
  for (const request of requests.data ?? []) {
    const id = String(request.id);
    if (counted.has(id)) continue;
    counted.add(id);
    const settled = request.status === 'settled';
    const report = latest.get(id);
    if (!settled && (!report || !['pending', 'pending_leader_review', 'pending_department_settlement'].includes(String(report.status)))) continue;
    const amount = settled ? request.actual_spent : report?.declared_spent;
    if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) < 0) continue;
    const bucket = settled ? 'settled' : 'pending';
    const cents = Math.round(Number(amount) * 100);
    add(totals.tasks, String(request.task_id), bucket, cents);
    if (request.subtask_id) add(totals.subtasks, String(request.subtask_id), bucket, cents);
  }
  return totals;
}
