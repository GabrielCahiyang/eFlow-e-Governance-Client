import { useState } from "react";
import { configurationItems, type ConfigurationArea } from "./catalog";
import { StatusPill, WorkspaceHeader } from "../../../components/ui/workspace";
export function ConfigurationMatrix({
  area,
  title,
}: {
  area?: ConfigurationArea;
  title: string;
}) {
  const [search, setSearch] = useState("");
  const rows = configurationItems.filter(
    (item) =>
      (!area || item.area === area) &&
      `${item.title} ${item.behavior} ${item.owner} ${item.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="eflow-admin-configuration">
      <WorkspaceHeader
        title={title}
        description="Implementation contracts and effective consumers. Hosted deployment and provider verification require their own acceptance receipts."
      />
      <label className="eflow-field-label">
        Search configuration
        <input
          aria-label="Search configuration"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div
        className="eflow-analytics-table"
        role="region"
        aria-label="Configuration matrix"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Control</th>
              <th>Status / owner</th>
              <th>Current behavior</th>
              <th>When it takes effect</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  <StatusPill
                    tone={item.status === "Effective" ? "positive" : "neutral"}
                    label={item.status}
                  />
                  <p>{item.owner}</p>
                </td>
                <td>{item.behavior}</td>
                <td>{item.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No configuration items match.</p>}
    </section>
  );
}
