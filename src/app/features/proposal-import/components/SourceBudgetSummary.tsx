import { useMemo } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { matchesSourceLine, type SourceBudget } from "../services/sourceBudget";
import type { DraftTask } from "./draftModel";

const money = (value: number) =>
  "₱" +
  value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function SourceBudgetSummary({
  source,
  tasks,
  onMove,
}: {
  source: SourceBudget;
  tasks: DraftTask[];
  onMove: (id: string, destination: string) => void;
}) {
  const total =
    tasks
      .filter((task) => task.enabled && task.budgetDecision === "funded")
      .flatMap((task) => task.budgetLines || [])
      .reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;
  const funds = useMemo(
    () =>
      [...new Set(source.lines.map((line) => line.fundSource))].map((name) => ({
        name,
        total:
          source.lines
            .filter((line) => line.fundSource === name)
            .reduce((sum, line) => sum + Math.round(line.amount * 100), 0) /
          100,
      })),
    [source],
  );
  const matches = Math.round(total * 100) === Math.round(source.total * 100);
  return (
    <section
      aria-label="Source PDF budget"
      className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Budget from your PDF</h3>
        <span className="inline-flex items-center gap-2">
          {matches ? <CircleCheck size={17} /> : <TriangleAlert size={17} />}{" "}
          {matches ? "Total matches the PDF" : "Draft differs from the PDF"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <p>
          Source total <strong>{money(source.total)}</strong>
        </p>
        <p>
          Included task budgets <strong>{money(total)}</strong>
        </p>
        <p>{source.lines.length} source detail lines</p>
      </div>
      <p className="text-sm text-neutral-600">
        Amounts come from the source table. Review which task holds each shared
        cost. Source fund names do not approve or release money.
      </p>
      <details>
        <summary className="cursor-pointer text-sm">
          View source amounts and funds
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {funds.map((fund) => (
            <li key={fund.name}>
              {fund.name}: <strong>{money(fund.total)}</strong>
            </li>
          ))}
        </ul>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Source particular</th>
                <th className="p-2">Fund</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Suggested task — review this</th>
              </tr>
            </thead>
            <tbody>
              {source.lines.map((line) => (
                <tr className="border-t" key={line.sourceId}>
                  <td className="p-2">
                    {line.particular}
                    <small className="block">
                      Page {line.page} · {line.category}
                    </small>
                  </td>
                  <td className="p-2">{line.fundSource}</td>
                  <td className="p-2 whitespace-nowrap">
                    {money(line.amount)}
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full min-w-40 max-w-72 rounded border p-2"
                      aria-label={`Task for ${line.particular}`}
                      value={
                        tasks.find((task) =>
                          task.budgetLines?.some((item) =>
                            matchesSourceLine(item, line),
                          ),
                        )?.key || ""
                      }
                      onChange={(event) =>
                        onMove(line.sourceId, event.target.value)
                      }
                    >
                      <option value="" disabled>
                        Review edited source line
                      </option>
                      {tasks
                        .filter((task) => task.enabled)
                        .map((task) => (
                          <option key={task.key} value={task.key}>
                            {task.title}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
