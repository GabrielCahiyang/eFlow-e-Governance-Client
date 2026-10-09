import { Button } from "../../../components/ui/button";
import { DEFAULT_ACTIVITY_FILTERS, type ActivityFilters } from "./types";
export function ActivityFilterControls({
  filters,
  size,
  onChange,
  onSize,
}: {
  filters: ActivityFilters;
  size: number;
  onChange: (patch: Partial<ActivityFilters>) => void;
  onSize: (size: number) => void;
}) {
  return (
    <div className="eflow-analytics-filters">
      <label>
        Search activity
        <input
          type="search"
          className="eflow-control"
          value={filters.search}
          maxLength={500}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </label>
      <label>
        Activity type
        <select
          className="eflow-control"
          aria-label="Filter activity type"
          value={filters.kind}
          onChange={(e) =>
            onChange({ kind: e.target.value as ActivityFilters["kind"] })
          }
        >
          <option value="all">All activity</option>
          <option value="project">Project & delegation</option>
          <option value="status">Status</option>
          <option value="progress">Progress</option>
          <option value="submission">Reviews</option>
        </select>
      </label>
      <label>
        From
        <input
          type="date"
          className="eflow-control"
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          className="eflow-control"
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </label>
      <label>
        Events per page
        <select
          className="eflow-control"
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="ghost"
        onClick={() => onChange(DEFAULT_ACTIVITY_FILTERS)}
      >
        Clear activity filters
      </Button>
    </div>
  );
}
