import type { ProjectCommandData } from "./types";
import { peso } from "../../../budget";
import { SectionEmpty, formatDate } from "../../../../components/workflow/primitives";
import { Coins } from "lucide-react";

function ProjectBudgetTabSkeleton() {
  const pulse = "animate-pulse rounded bg-neutral-200/80";
  return (
    <div
      className="space-y-6 font-sans"
      role="status"
      aria-label="Loading project financial allocation…"
      aria-busy="true"
    >
      <span className="sr-only">Loading project financial allocation…</span>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden="true">
        {[
          ["Approved Allocation", "Approved funding for this project's tasks"],
          ["Total Expenditures", "Verified spending after receipt settlement"],
          ["Available Balance", "Task funds not reserved or spent"],
        ].map(([title, desc]) => (
          <div key={title} className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              {title}
            </span>
            <div className="mt-2">
              <span className={`inline-block h-8 w-36 ${pulse}`} />
            </div>
            <div className="mt-2 text-xs text-neutral-500">{desc}</div>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
            Budget Allocation Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10.5px]">
                <th className="py-2.5 px-3">Item / Particular</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Fund Source</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <td className="py-3 px-3"><span className={`inline-block h-4 w-44 ${pulse}`} /></td>
                  <td className="py-3 px-3"><span className={`inline-block h-3.5 w-24 ${pulse}`} /></td>
                  <td className="py-3 px-3 text-right"><span className={`inline-block h-3.5 w-28 ${pulse}`} /></td>
                  <td className="py-3 px-3 text-right"><span className={`inline-block h-4 w-24 ${pulse}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div aria-hidden="true" className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
            Disbursements &amp; Petty Cash
          </h3>
        </div>
        <div className="divide-y divide-neutral-100">
          {[0, 1].map((i) => (
            <div key={i} className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className={`block h-4 w-48 ${pulse}`} />
                <span className={`block h-3 w-36 ${pulse}`} />
              </div>
              <span className={`inline-block h-4 w-24 ${pulse}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectBudgetTab({ data }: { data: ProjectCommandData }) {
  const { financial, financialLoading, financialError } = data;

  const summary = financial?.summary;
  const lines = financial?.lines || [];
  const requests = financial?.requests || [];

  if (financialLoading) {
    return <ProjectBudgetTabSkeleton />;
  }

  if (financialError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700">
        {financialError}
      </div>
    );
  }

  if (!summary || (summary.approvedAmount === 0 && lines.length === 0)) {
    return (
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center shadow-xs font-sans">
        <SectionEmpty illustration="budget"
          icon={<Coins size={36} className="text-neutral-400" />}
          title="No Financial Allocation"
          description="This project operates without a dedicated budget line allocation or financial expenditures."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Financial KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Approved Allocation
          </span>
          <div className="mt-2 text-2xl font-black text-neutral-900 tracking-tight">
            {peso.format(summary.approvedAmount)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Approved funding for this project's tasks
          </div>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Total Expenditures
          </span>
          <div className="mt-2 text-2xl font-black text-rose-600 tracking-tight">
            {peso.format(summary.spentAmount)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Verified spending after receipt settlement
          </div>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Available Balance
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {peso.format(summary.availableAmount)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Task funds not reserved or spent
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      {lines.length > 0 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Budget Allocation Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10.5px]">
                  <th className="py-2.5 px-3">Item / Particular</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Fund Source</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-neutral-900">
                      {item.particular || item.expenseClass || `Line Item #${index + 1}`}
                    </td>
                    <td className="py-3 px-3 text-neutral-600">{item.category || item.expenseClass || "General"}</td>
                    <td className="py-3 px-3 text-right text-neutral-600">
                      {item.fundSource || "General Fund"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-neutral-900">
                      {peso.format(item.amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Petty Cash & Disbursements */}
      {requests.length > 0 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Disbursements &amp; Petty Cash
            </h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {requests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-neutral-900">{req.purpose || req.taskTitle || "Petty Cash"}</div>
                  <div className="text-neutral-500 text-[11px]">
                    Status: <strong className="capitalize">{req.status.replace(/_/g, " ")}</strong> · {formatDate(req.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-neutral-900">{peso.format(req.requestedAmount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
