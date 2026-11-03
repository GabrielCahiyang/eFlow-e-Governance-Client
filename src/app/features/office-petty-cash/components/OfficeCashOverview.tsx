import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { loadOfficeCash } from "../services/officeCash";
import type { OfficeCashSnapshot } from "../types";
import { OfficePettyCashLauncher } from "./OfficePettyCash";
const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount,
  );
export function OfficeCashOverview() {
  const { userProfile } = useAuth();
  return (
    <OfficeCashSummary
      key={`${userProfile?.id}:${userProfile?.org_id}`}
      office={userProfile?.org_id || ""}
    />
  );
}
function OfficeCashSummary({ office }: { office: string }) {
  const [state, setState] = useState<OfficeCashSnapshot>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => {
      if (office)
        void loadOfficeCash(office)
          .then((next) => {
            if (
              !next ||
              ![next.available, next.outstanding, next.replenishable].every(
                Number.isFinite,
              )
            )
              throw new Error(
                "Petty cash totals could not be loaded. Open the fund to check its balance.",
              );
            if (active) {
              setState(next);
              setError("");
            }
          })
          .catch((e) => {
            if (active) {
              setState(undefined);
              setError(e.message);
            }
          });
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    window.addEventListener("eflow:office-petty", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("eflow:office-petty", load);
    };
  }, [office]);
  return (
    <section className="ea-panel">
      <h2>Office petty cash</h2>
      <p className="ea-help">
        Shared revolving fund. Separate from project budgets and task
        allocations.
      </p>
      {error ? (
        <p role="alert" className="ea-warning ea-error">
          {error}
        </p>
      ) : (
        <div className="ea-metrics">
          {[
            { label: "Available", value: state?.available },
            { label: "Outstanding", value: state?.outstanding },
            { label: "Can be replenished", value: state?.replenishable },
          ].map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>
                {item.value === undefined ? "—" : money(item.value)}
              </strong>
            </div>
          ))}
        </div>
      )}
      <OfficePettyCashLauncher />
    </section>
  );
}
