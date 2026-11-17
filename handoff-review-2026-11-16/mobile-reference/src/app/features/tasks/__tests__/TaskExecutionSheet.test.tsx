import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { TaskExecutionSheet } from "../TaskExecutionSheet";
import { clearAllFormDrafts } from "../../../shared/formDraftMemory";
import { chooseFiles, asServiceFile } from "../../../../platform/files";
import { submitProgressUpdate } from "../../../../core/web/app/services/taskDiscussionService";

jest.mock("../../authentication", () => ({
  useAuth: () => ({
    profile: { id: "lead-1", full_name: "Andres Manili" },
  }),
}));

jest.mock("../../../../platform/files", () => ({
  chooseFiles: jest.fn(),
  asServiceFile: jest.fn(),
}));

jest.mock("../../../../core/web/app/services/taskDiscussionService", () => ({
  submitProgressUpdate: jest.fn(),
}));

beforeEach(() => {
  clearAllFormDrafts();
  jest.clearAllMocks();
});

test("TaskExecutionSheet renders unified Work state, Work note, Next step, and optional evidence without blocker initially", async () => {
  await render(
    <TaskExecutionSheet
      taskId="task-1"
      onClose={jest.fn()}
      verifyAccess={jest.fn(async () => {})}
      onSaved={jest.fn(async () => {})}
    />,
  );

  expect(screen.getByText("Work state")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Work state" })).toHaveTextContent(
    "In progress",
  );
  expect(screen.getByLabelText("Work note")).toBeOnTheScreen();
  expect(screen.getByLabelText("Next step")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "Attach evidence (optional)" }),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText("Blocker")).toBeNull();
  expect(screen.queryByText("Blocker category")).toBeNull();
});

test("TaskExecutionSheet requires Blocker when Blocked and maps payload plus optional evidence cleanly", async () => {
  const picked = {
    uri: "file:///tmp/memo.pdf",
    name: "memo.pdf",
    type: "application/pdf",
    size: 2048,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  const attachment = { name: "memo.pdf" } as unknown as File;
  jest.mocked(chooseFiles).mockResolvedValueOnce([picked]);
  jest.mocked(asServiceFile).mockResolvedValueOnce(attachment);
  jest.mocked(submitProgressUpdate).mockResolvedValueOnce(undefined as never);

  const onClose = jest.fn();
  const onSaved = jest.fn(async () => {});
  const verifyAccess = jest.fn(async () => {});

  await render(
    <TaskExecutionSheet
      taskId="task-2"
      onClose={onClose}
      verifyAccess={verifyAccess}
      onSaved={onSaved}
    />,
  );

  await fireEvent.press(screen.getByRole("button", { name: "Work state" }));
  await fireEvent.press(await screen.findByRole("radio", { name: "Blocked" }));
  expect(await screen.findByLabelText("Blocker")).toBeOnTheScreen();

  // Submitting without blocker fails client-side validation
  await fireEvent.press(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => {
    expect(screen.getByText("Describe what is blocking the work.")).toBeOnTheScreen();
  });
  expect(submitProgressUpdate).not.toHaveBeenCalled();

  await fireEvent.changeText(
    screen.getByLabelText("Blocker"),
    "Waiting on signed permit",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Work note"),
    "Prepared endorsement packet",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Next step"),
    "Follow up Monday",
  );

  await fireEvent.press(
    screen.getByRole("button", { name: "Attach evidence (optional)" }),
  );
  await waitFor(() => {
    expect(screen.getByText("memo.pdf (2 KB)")).toBeOnTheScreen();
  });

  await fireEvent.press(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => {
    expect(submitProgressUpdate).toHaveBeenCalledTimes(1);
  });

  expect(verifyAccess).toHaveBeenCalledTimes(1);
  expect(submitProgressUpdate).toHaveBeenCalledWith({
    taskId: "task-2",
    author: { id: "lead-1", name: "Andres Manili" },
    blockerCategory: "Other",
    blocker: "Waiting on signed permit",
    nextStep: "Follow up Monday",
    note: "Prepared endorsement packet",
    attachment,
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("TaskExecutionSheet reopens with saved blocker state, discards abandoned edits and still clears blockers explicitly", async () => {
  jest.mocked(submitProgressUpdate).mockResolvedValue(undefined as never);

  const onClose = jest.fn();
  const view = await render(
    <TaskExecutionSheet
      taskId="task-3"
      initialBlocker="Missing vendor quote"
      onClose={onClose}
      verifyAccess={jest.fn(async () => {})}
      onSaved={jest.fn(async () => {})}
    />,
  );

  expect(screen.getByRole("button", { name: "Work state" })).toHaveTextContent(
    "Blocked",
  );
  expect(screen.getByDisplayValue("Missing vendor quote")).toBeOnTheScreen();

  // Switching back to In progress clears the blocker on submit
  await fireEvent.press(screen.getByRole("button", { name: "Work state" }));
  await fireEvent.press(await screen.findByRole("radio", { name: "In progress" }));
  expect(screen.queryByLabelText("Blocker")).toBeNull();

  await fireEvent.changeText(screen.getByLabelText("Work note"), "Quote received");
  await fireEvent.changeText(screen.getByLabelText("Next step"), "Proceed with PO");

  // Close without submitting preserves draft values
  await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await view.unmount();

  const reopened = await render(
    <TaskExecutionSheet
      taskId="task-3"
      initialBlocker="Missing vendor quote"
      onClose={jest.fn()}
      verifyAccess={jest.fn(async () => {})}
      onSaved={jest.fn(async () => {})}
    />,
  );
  expect(screen.getByRole("button", { name: "Work state" })).toHaveTextContent(
    "Blocked",
  );
  expect(screen.getByDisplayValue("Missing vendor quote")).toBeOnTheScreen();
  expect(screen.queryByDisplayValue("Quote received")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Work state" }));
  await fireEvent.press(await screen.findByRole("radio", { name: "In progress" }));
  await fireEvent.changeText(screen.getByLabelText("Work note"), "Quote received");
  await fireEvent.changeText(screen.getByLabelText("Next step"), "Proceed with PO");

  await fireEvent.press(screen.getByRole("button", { name: "Post update" }));
  await waitFor(() => {
    expect(submitProgressUpdate).toHaveBeenCalledWith({
      taskId: "task-3",
      author: { id: "lead-1", name: "Andres Manili" },
      blockerCategory: "None",
      blocker: undefined,
      nextStep: "Proceed with PO",
      note: "Quote received",
      attachment: null,
    });
  });
  await reopened.unmount();

  // untouched blocker state clears automatically when active blocker is cleared remotely
  clearAllFormDrafts();
  const blockedUntouched = await render(
    <TaskExecutionSheet
      taskId="task-4"
      initialBlocker="Remote blocker"
      onClose={jest.fn()}
      verifyAccess={jest.fn(async () => {})}
      onSaved={jest.fn(async () => {})}
    />,
  );
  expect(screen.getByDisplayValue("Remote blocker")).toBeOnTheScreen();
  await blockedUntouched.rerender(
    <TaskExecutionSheet
      taskId="task-4"
      initialBlocker={null}
      onClose={jest.fn()}
      verifyAccess={jest.fn(async () => {})}
      onSaved={jest.fn(async () => {})}
    />,
  );
  expect(screen.getByRole("button", { name: "Work state" })).toHaveTextContent(
    "In progress",
  );
  expect(screen.queryByLabelText("Blocker")).toBeNull();
});
