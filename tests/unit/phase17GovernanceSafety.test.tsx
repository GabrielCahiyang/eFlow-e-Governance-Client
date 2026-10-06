// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGovernanceSafety } from "../../src/app/features/interdepartment-collaboration/hooks/useGovernanceSafety";
import type {
  CollaborationDraft,
  ProposalGovernanceState,
} from "../../src/app/features/interdepartment-collaboration/types";

afterEach(cleanup);
const draft = {
  id: "plan",
  title: "Community plan",
  status: "committed",
  currentRevisionId: "rev1",
  currentRevisionNumber: 1,
} as CollaborationDraft;
const governance = {
  assignments: [],
  records: [],
  signoffs: [],
  closeoutDecisions: [],
} as unknown as ProposalGovernanceState;
const success = "Proposal closeout requested.";
function Harness({
  operation,
  refresh,
  changed = false,
}: {
  operation: () => Promise<void>;
  refresh: () => Promise<void>;
  changed?: boolean;
}) {
  const { safety, receipts, onAct } = useGovernanceSafety({
    draft: changed ? { ...draft, currentRevisionId: "rev2" } : draft,
    governance,
    organizations: [],
    isOwner: true,
    performAction: async (run) => {
      await run();
      throw new Error("Parent refresh failed");
    },
    onRefresh: refresh,
  });
  return (
    <>
      <button
        onClick={() =>
          void onAct(operation, success, <p>Closeout note: Delivered.</p>)
        }
      >
        Request closeout
      </button>
      {safety.dialog}
      <p role="status">{safety.message}</p>
      <span data-testid="receipt">
        {receipts["Request proposal closeout"] || 0}
      </span>
    </>
  );
}

it("keeps a known governance write receipt when parent and independent refresh fail, and blocks replay", async () => {
  const operation = vi.fn().mockResolvedValue(undefined);
  const refresh = vi.fn().mockRejectedValue(new Error("Read unavailable"));
  render(<Harness operation={operation} refresh={refresh} />);
  fireEvent.click(screen.getByText("Request closeout"));
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "Closeout note: Delivered.",
  );
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Cancel",
      exact: true,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(operation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Request closeout"));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Request proposal closeout",
      exact: true,
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Proposal closeout requested. The view could not refresh",
    ),
  );
  expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();
  fireEvent.click(screen.getByText("Request closeout"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "previous result is saved or requires verification",
  );
  expect(operation).toHaveBeenCalledOnce();
});

it("rejects a changed review revision after confirmation without issuing the operation", async () => {
  const operation = vi.fn().mockResolvedValue(undefined);
  const refresh = vi.fn().mockResolvedValue(undefined);
  const view = render(<Harness operation={operation} refresh={refresh} />);
  fireEvent.click(screen.getByText("Request closeout"));
  view.rerender(<Harness operation={operation} refresh={refresh} changed />);
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Request proposal closeout",
      exact: true,
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "plan or your authority changed",
    ),
  );
  expect(operation).not.toHaveBeenCalled();
});
