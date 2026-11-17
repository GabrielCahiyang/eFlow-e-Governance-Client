import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import type { ReactNode } from "react";
import { Button } from "@vibe/core";
import { FileText, X } from "lucide-react";
import type {
  BudgetLedgerEntry,
  DepartmentBudgetBundle,
  GeneralJournalEntry,
} from "../types";
import { peso } from "./budgetUi";

const words = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, "$1 $2").split("_").join(" ").trim();

const sentence = (value: string) => {
  const text = words(value).toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value);

const FIELD_LABELS: Record<string, string> = {
  projectId: "Project",
  commitmentId: "Commitment",
  proposalDraftId: "Proposal",
  partitionId: "Budget account",
  budgetPartitionId: "Budget account",
  sectionId: "Budget account",
  allocationId: "Task allocation",
  requestId: "Funding request",
  releaseId: "Cash release",
  liquidationId: "Liquidation",
  voucherNumber: "Voucher no.",
  liquidationNumber: "Liquidation no.",
  requestNumber: "Request no.",
};

function formatScalar(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return /amount|total|balance|cash|cost|spent|returned|cap/i.test(key)
      ? peso.format(value)
      : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00`).toLocaleDateString();
    }
    return value;
  }
  return JSON.stringify(value);
}

function resolveEntityName(
  key: string,
  value: unknown,
  bundle?: DepartmentBudgetBundle,
  projectNames?: Record<string, string>,
): string | null {
  if (typeof value !== "string") return null;
  if (key === "projectId") {
    const projectName = projectNames?.[value];
    if (projectName) return projectName.replace(/^Project:\s*/i, "");
  }
  if (!bundle) return null;
  if (key === "proposalDraftId") {
    const match = bundle.commitments.find((c) => c.proposalDraftId === value);
    if (match?.title) return match.title.replace(/^Project:\s*/i, "");
  }
  if (key === "commitmentId") {
    const match = bundle.commitments.find((c) => c.id === value);
    if (match?.title) return match.title.replace(/^Project:\s*/i, "");
  }
  if (key === "partitionId" || key === "budgetPartitionId" || key === "sectionId") {
    const match = (bundle.sections || []).find((s) => s.id === value);
    if (match) return match.accountCode ? `${match.name} (${match.accountCode})` : match.name;
  }
  if (key === "requestId") {
    const match = bundle.requests.find((r) => r.id === value);
    if (match) {
      const code = `FR-${String(match.requestNumber).padStart(5, "0")}`;
      return match.purpose ? `${code} · ${match.purpose}` : code;
    }
  }
  if (key === "allocationId") {
    const match = bundle.allocations.find((a) => a.id === value);
    if (match) {
      const commitment = bundle.commitments.find((c) => c.id === match.commitmentId);
      return match.subtaskTitle || commitment?.title || "Task allocation";
    }
  }
  if (key === "releaseId") {
    const match = bundle.releases.find((r) => r.id === value);
    if (match) {
      return `${match.voucherNumber || "Cash release"} · ${peso.format(match.amount)}`;
    }
  }
  if (key === "liquidationId") {
    const match = bundle.liquidations.find((l) => l.id === value);
    if (match) return match.liquidationNumber || `Liquidation v${match.version}`;
  }
  return null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] items-baseline gap-3 px-3.5 py-2.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetadataRows({
  data,
  bundle,
  projectNames,
}: {
  data: Record<string, unknown>;
  bundle?: DepartmentBudgetBundle;
  projectNames?: Record<string, string>;
}) {
  const entries = Object.entries(data).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === "") return [];
    const resolved = resolveEntityName(key, value, bundle, projectNames);
    if (!resolved && typeof value === "string" && isId(value)) {
      return [];
    }
    return [{ key, label: FIELD_LABELS[key] || sentence(key), value, resolved }];
  });

  if (!entries.length) return null;

  return (
    <Section title="Affected records">
      <dl className="divide-y divide-border/70 rounded-[8px] border border-border bg-card">
        {entries.map(({ key, label, value, resolved }) => (
          <Row key={key} label={label}>
            {resolved ? (
              <span>{resolved}</span>
            ) : Array.isArray(value) ? (
              <ul className="space-y-1.5">
                {value.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-[6px] border border-border bg-subtle px-2.5 py-1.5 text-[12px]"
                  >
                    {item && typeof item === "object"
                      ? Object.entries(item as Record<string, unknown>)
                          .filter(([, v]) => !(typeof v === "string" && isId(v)))
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                {FIELD_LABELS[k] || sentence(k)}
                              </span>
                              <span className="text-right tabular-nums">
                                {resolveEntityName(k, v, bundle, projectNames) ||
                                  formatScalar(k, v)}
                              </span>
                            </div>
                          ))
                      : formatScalar(key, item)}
                  </li>
                ))}
              </ul>
            ) : (
              <span>{formatScalar(key, value)}</span>
            )}
          </Row>
        ))}
      </dl>
    </Section>
  );
}

export function AuditEventDetails({
  entry,
  bundle,
  projectNames,
  linkedJournal,
  onClose,
}: {
  entry: BudgetLedgerEntry;
  bundle?: DepartmentBudgetBundle;
  projectNames?: Record<string, string>;
  linkedJournal: GeneralJournalEntry[];
  onClose: () => void;
}) {
  const actor = entry.actorRole ? sentence(entry.actorRole) : "System";
  const metadata = (entry.metadata || {}) as Record<string, unknown>;
  const hasStateChange = Boolean(entry.previousState || entry.newState);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            <FileText size={13} aria-hidden="true" /> Financial audit event
          </div>
          <h2 className="mt-1 text-[17px] font-semibold text-foreground">
            {sentence(entry.entryType)}
          </h2>
          {entry.description && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {entry.description}
            </p>
          )}
        </div>
        <WorkspaceTooltip content="Close audit details"><Button
          kind="tertiary"
          size="small"
          aria-label="Close audit details"
          onClick={onClose}
        >
          <X size={15} />
        </Button></WorkspaceTooltip>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <Section title="Summary">
          <dl className="divide-y divide-border/70 rounded-[8px] border border-border bg-card">
            <Row label="Recorded">
              {new Date(entry.createdAt).toLocaleString()}
            </Row>
            <Row label="Performed by">{actor}</Row>
            {typeof entry.amount === "number" && entry.amount > 0 && (
              <Row label="Amount">
                <span className="tabular-nums">{peso.format(entry.amount)}</span>
              </Row>
            )}
            {hasStateChange && (
              <Row label="State change">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="rounded-[5px] border border-border bg-subtle px-2 py-0.5 text-[11px]">
                    {entry.previousState ? sentence(entry.previousState) : "None"}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                  <span className="rounded-[5px] border border-border bg-subtle px-2 py-0.5 text-[11px]">
                    {entry.newState ? sentence(entry.newState) : "None"}
                  </span>
                </span>
              </Row>
            )}
            {entry.reason && <Row label="Reason">{entry.reason}</Row>}
          </dl>
        </Section>

        <MetadataRows data={metadata} bundle={bundle} projectNames={projectNames} />

        {linkedJournal.length > 0 && (
          <Section title="Linked journal rows">
            <div className="space-y-2">
              {linkedJournal.map((journal) => (
                <div
                  key={journal.id}
                  className="rounded-[8px] border border-border bg-card p-3"
                >
                  <div className="font-mono text-[12px] text-muted-foreground">
                    {journal.referenceNumber}
                  </div>
                  {journal.lines.map((line) => (
                    <div
                      key={line.id}
                      className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[12px]"
                    >
                      <span className="min-w-0">
                        {line.accountCode} · {line.accountTitle}
                      </span>
                      <span className="whitespace-nowrap text-right tabular-nums">
                        {line.debit
                          ? `Dr ${peso.format(line.debit)}`
                          : `Cr ${peso.format(line.credit)}`}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
