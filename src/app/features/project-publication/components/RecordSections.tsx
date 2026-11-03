import { useState } from "react";
import { sectionLabel } from "../presentation";
function FieldList({ record }: { record: Record<string, unknown> }) {
  return (
    <dl className="project-seal-field-list">
      {Object.entries(record).map(([key, value]) => (
        <div key={key}>
          <dt>{sectionLabel(key)}</dt>
          <dd>
            {value == null ? (
              "—"
            ) : typeof value === "object" ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : typeof value === "boolean" ? (
              value ? (
                "Yes"
              ) : (
                "No"
              )
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function RecordSections({
  records,
}: {
  records: Record<string, unknown>;
}) {
  return (
    <div className="project-seal-records">
      {Object.entries(records).map(([key, value]) => (
        <RecordSection key={key} name={key} value={value} />
      ))}
    </div>
  );
}
function RecordSection({ name, value }: { name: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {sectionLabel(name)}
        <span>
          {Array.isArray(value) ? `${value.length} records` : "Details"}
        </span>
      </summary>
      {open &&
        (Array.isArray(value) ? (
          <div className="project-seal-record-list">
            {value.length ? (
              value.map((record, i) => (
                <details key={i}>
                  <summary>
                    {String(
                      record.title ||
                        record.full_name ||
                        record.file_name ||
                        record.request_number ||
                        record.action ||
                        record.particular ||
                        `Record ${i + 1}`,
                    )}
                    {record.status && (
                      <span>{sectionLabel(String(record.status))}</span>
                    )}
                  </summary>
                  <FieldList record={record} />
                </details>
              ))
            ) : (
              <p>No records in this section.</p>
            )}
          </div>
        ) : value && typeof value === "object" ? (
          <FieldList record={value as Record<string, unknown>} />
        ) : (
          <p>{String(value)}</p>
        ))}
    </details>
  );
}
