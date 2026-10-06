import { InspectorPanel } from "../../../shared/motion";
import { Button } from "../../../components/ui/button";
import type { GeneralJournalEntry } from "../types";
import { peso } from "./budgetUi";
export function JournalEntryInspector({
  entry,
  onClose,
}: {
  entry: GeneralJournalEntry;
  onClose: () => void;
}) {
  const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0),
    credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
  return (
    <InspectorPanel
      open
      onClose={onClose}
      ariaLabel={`Journal entry ${entry.referenceNumber}`}
      className="w-full bg-card sm:w-[680px]"
    >
      <header className="flex items-start justify-between border-b p-5">
        <div>
          <p className="text-xs text-muted-foreground">
            Immutable financial history
          </p>
          <h2 className="text-xl font-semibold">{entry.referenceNumber}</h2>
          <p className="text-sm">
            {entry.entryDate} · {entry.sourceType.replace(/_/g, " ")}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="break-words">{entry.memo}</p>
        <p className="text-sm">
          Posted by {entry.postedByName || "Automated posting"} · Office{" "}
          {entry.orgId}
        </p>
        <div
          role="region"
          aria-label="Complete journal entry lines"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Account</th>
                <th className="p-2 text-right">Debit</th>
                <th className="p-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id}>
                  <td className="p-2">
                    {line.accountCode} · {line.accountTitle}
                  </td>
                  <td className="p-2 text-right">{peso.format(line.debit)}</td>
                  <td className="p-2 text-right">{peso.format(line.credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="p-2 text-left">Full entry totals</th>
                <td className="p-2 text-right">{peso.format(debit)}</td>
                <td className="p-2 text-right">{peso.format(credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          All lines are shown, including lines excluded by the workspace filter.
          Posted entries cannot be edited; use an authorized balanced
          correction.
        </p>
        <p className="break-all text-xs">Journal reference: {entry.id}</p>
      </div>
    </InspectorPanel>
  );
}
