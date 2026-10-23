import type { DepartmentBudgetBundle, DepartmentBudgetSummary } from '../types';

const sumMoney = (amounts: number[]) => amounts.reduce((total, amount) => total + Math.round(amount * 100), 0) / 100;

/** Cash movements describe a commitment; they do not create new appropriation. */
export function financialPosition(data: DepartmentBudgetBundle, summary: DepartmentBudgetSummary) {
  return {
    authority: summary.approvedAmount,
    committed: summary.committedAmount,
    available: summary.availableAmount,
    released: sumMoney(data.requests.map(request => request.releasedAmount || 0)),
    spent: summary.spentAmount,
    returned: sumMoney(data.requests.filter(request => request.status === 'settled').map(request => request.returnedAmount || 0)),
    unsettled: sumMoney(data.requests.filter(request => request.status !== 'settled').map(request => request.releasedAmount || 0)),
    unusedCommitment: Math.max(0, Math.round((summary.committedAmount - summary.spentAmount) * 100) / 100),
  };
}
