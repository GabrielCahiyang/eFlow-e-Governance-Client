import { ArrowRight, History, ShieldCheck } from "lucide-react";
import { formatManilaDateTime } from "../../../shared/calendarDisplay";
import type { DepartmentBudgetBundle } from "../types";
import { budgetVersionChanges } from "../selectors/budgetVersions";
import { peso } from "./budgetUi";
import "./budgetVersions.css";

export function BudgetVersionBanner({ data }: { data: DepartmentBudgetBundle }) {
  const versions = data.budgetVersions || [];
  const current = versions[versions.length - 1];
  if (!data.summary || data.summary.status === "draft") return null;

  return (
    <section className="budget-version" aria-label="Office Budget version">
      <div className="budget-version__header">
        <div className="budget-version__badge">
          {current ? `V${current.version}` : "Locked"}
        </div>
        <div className="budget-version__title">
          <div className="budget-version__heading">
            <strong>Office Budget · FY {data.summary.fiscalYear}</strong>
            <span className="budget-version__meta">
              <ShieldCheck size={13} aria-hidden="true" />
              {current
                ? `${current.actorName} · ${formatManilaDateTime(current.createdAt, "—")}`
                : "Locked budget"}
            </span>
          </div>
          {current && <p className="budget-version__reason">{current.reason}</p>}
        </div>
        <div className="budget-version__amount">
          <span>Current total</span>
          <strong>{peso.format(data.summary.approvedAmount)}</strong>
        </div>
      </div>
      {!!versions.length && (
        <details>
          <summary>
            <History size={14} aria-hidden="true" /> Version history · {versions.length}{" "}
            {versions.length === 1 ? "version" : "versions"}
          </summary>
          <ol>
            {[...versions].reverse().map((version) => {
              const prior = versions.find((row) => row.version === version.version - 1);
              const changes = prior ? budgetVersionChanges(prior, version) : [];
              return (
                <li key={version.version}>
                  <header>
                    <strong>
                      V{version.version} · {peso.format(version.total)}
                    </strong>
                    <span>
                      {version.actorName} · {formatManilaDateTime(version.createdAt, "—")}
                    </span>
                  </header>
                  <p>{version.reason}</p>
                  {prior ? (
                    <div className="budget-version__changes">
                      {changes.map((change, index) => (
                        <div key={index}>
                          <strong>
                            {change.account}
                            <small>{change.field}</small>
                          </strong>
                          <span>{change.before}</span>
                          <ArrowRight size={14} aria-hidden="true" />
                          <span>{change.after}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Initial locked budget · {version.accounts.length} accounts</p>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}
