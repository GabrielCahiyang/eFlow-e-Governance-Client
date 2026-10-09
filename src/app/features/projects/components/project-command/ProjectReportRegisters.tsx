import { Button, EmptyState, Label } from "@vibe/core";
import { Open } from "@vibe/icons";
import { Eye, ReceiptText } from "lucide-react";
import { createReceiptSignedUrl, peso } from "../../../budget";
import { getSubtaskEvidenceUrl } from "../../../subtasks";
import type { ProjectExecutionFinancialRow } from "../../selectors/projectFinancialReportSelectors";
import { financialOfficeUnavailable } from "../../selectors/projectReportAvailability";
import type { ProjectCommandData } from "./types";
export function ExecutionRow({
  row,
  data,
  onOpenTask,
}: {
  onOpenTask?: (id: string) => void;
  row: ProjectExecutionFinancialRow;
  data: ProjectCommandData;
}) {
  const unavailable =
    !!data.error ||
    data.financialLoading ||
    !!data.financialError ||
    financialOfficeUnavailable(data, row.parentTaskId || row.id);
  const money = (value: number) =>
    unavailable ? "Unavailable" : peso.format(value);
  const requestIds = new Set(
    data.financial.requests
      .filter((request) =>
        row.level === "task"
          ? request.taskId === row.id
          : request.subtaskId === row.id,
      )
      .map((request) => request.id),
  );
  const receipts = data.financial.liquidations
    .filter((item) => requestIds.has(item.requestId))
    .flatMap((item) => item.receipts);
  const submissionIds = new Set(
    data.facts.submissions
      .filter((item) =>
        row.level === "task"
          ? item.kind === "task" && item.taskId === row.id
          : item.kind === "subtask" && item.subtaskId === row.id,
      )
      .map((item) => item.id),
  );
  const evidence = data.facts.evidence.filter(
    (item) =>
      item.taskId === (row.parentTaskId || row.id) &&
      (row.level === "task"
        ? item.kind === "task"
        : Boolean(item.submissionId && submissionIds.has(item.submissionId))),
  );

  const scheduleColor =
    row.schedule === "overdue"
      ? "negative"
      : row.schedule === "due_soon"
        ? "working_orange"
        : row.schedule === "completed"
          ? "positive"
          : "dark";

  return (
    <tr
      className={`text-xs ${row.level === "task" ? "bg-card font-medium" : "bg-muted/40"}`}
    >
      <td className="px-4 py-3">
        <div
          className={`${row.level === "task" ? "font-semibold text-foreground" : "pl-4 text-foreground"}`}
        >
          {row.level === "subtask" && (
            <span className="mr-1.5 text-muted-foreground">↳</span>
          )}
          {onOpenTask ? (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onOpenTask(row.parentTaskId || row.id)}
            >
              {row.workItem}
            </button>
          ) : (
            row.workItem
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{row.accountability}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="capitalize text-foreground">
            {row.status.replace(/_/g, " ")}
          </span>
          <strong className="text-foreground">
            {data.error ? "Unavailable" : `${row.progress}%`}
          </strong>
        </div>
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: data.error ? "0%" : `${row.progress}%` }}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <Label text={row.schedule.replace(/_/g, " ")} color={scheduleColor} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          {row.deadline || "No deadline"}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-foreground">
          {unavailable
            ? "Unavailable"
            : row.budgetMode === "shared"
              ? "Shared task pool"
              : row.budgetMode === "cap"
                ? `Cap ${money(row.budgetAmount)}`
                : money(row.budgetAmount)}
        </div>
        {!unavailable && row.budgetMode !== "shared" && (
          <div className="mt-0.5 text-[11px] text-emerald-700 font-medium">
            {money(row.availableAmount)} remaining
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <div>{money(row.reservedAmount)} reserved</div>
        <div className="font-medium text-foreground">
          {money(row.spentAmount)} spent
        </div>
        <div>{money(row.returnedAmount)} returned</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {receipts.map((receipt) => (
            <button
              key={receipt.id}
              type="button"
              title={receipt.fileName}
              onClick={async () =>
                window.open(
                  await createReceiptSignedUrl(receipt.filePath),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <ReceiptText size={11} /> {receipt.vendor} ·{" "}
              {peso.format(receipt.amount)}
            </button>
          ))}
          {evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={async () => {
                const url = await getSubtaskEvidenceUrl(item.filePath);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100"
            >
              <Eye size={11} /> {item.fileName}
            </button>
          ))}
          {(unavailable || data.error) && <span>Files unavailable</span>}
          {!unavailable &&
            !data.financialLoading &&
            !data.error &&
            !receipts.length &&
            !evidence.length && (
              <span className="text-muted-foreground text-[11px]">
                No files attached
              </span>
            )}
        </div>
      </td>
    </tr>
  );
}

export function ReceiptRegister({ data }: { data: ProjectCommandData }) {
  const requestById = new Map(
    data.financial.requests.map((request) => [request.id, request]),
  );
  const commitmentById = new Map(
    data.financial.commitments.map((commitment) => [commitment.id, commitment]),
  );
  const receipts = data.financial.liquidations.flatMap((liquidation) =>
    liquidation.receipts.map((receipt) => ({
      liquidation,
      receipt,
      request: requestById.get(liquidation.requestId),
    })),
  );
  return (
    <section className="eflow-section-card">
      <header>
        <h3>Financial and liquidation register</h3>
        <p className="m-0 mt-0.5 text-xs text-muted-foreground">
          Every receipt remains linked to its proposal, task, subtask,
          requester, and liquidation record.
        </p>
      </header>
      {data.financialLoading || data.financialError ? (
        <p className="p-4">
          Receipt register unavailable until financial facts load.
        </p>
      ) : receipts.length ? (
        <div className="divide-y divide-neutral-100">
          {receipts.map(({ liquidation, receipt, request }) => (
            <div
              key={receipt.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {[
                    request
                      ? commitmentById.get(request.commitmentId)?.title
                      : undefined,
                    request?.taskTitle,
                    request?.subtaskTitle,
                  ]
                    .filter(Boolean)
                    .join(" → ") || "Funded work item"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {request?.cashRecipientName || request?.requesterName} ·{" "}
                  {request?.purpose} · liquidation attempt {liquidation.version}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">
                    {peso.format(receipt.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {receipt.vendor} · {receipt.receiptDate}
                  </div>
                </div>
                <Button
                  kind="tertiary"
                  size="small"
                  leftIcon={Open}
                  onClick={async () =>
                    window.open(
                      await createReceiptSignedUrl(receipt.filePath),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  View receipt
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No receipt packages yet"
          description="Receipt packages appear here after they are submitted and liquidated for this project."
        />
      )}
    </section>
  );
}
