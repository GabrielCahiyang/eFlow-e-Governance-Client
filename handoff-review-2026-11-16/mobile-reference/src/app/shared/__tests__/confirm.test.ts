import { expect, jest, test } from "@jest/globals";
import { Alert } from "react-native";
import { confirmAction } from "../confirm";

test("Cancel and dismissal do not proceed, rapid taps cannot stack confirmations", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const first = confirmAction("Start this task?", "Ready?", "Start work");
  expect(await confirmAction("Start this task?", "Ready?", "Start work")).toBe(
    false,
  );
  expect(alert).toHaveBeenCalledTimes(1);
  const buttons = alert.mock.calls[0][2]!;
  buttons[0].onPress?.();
  expect(await first).toBe(false);
  const next = confirmAction("Start this subtask?", "Ready?", "Start work");
  alert.mock.calls[1][3]?.onDismiss?.();
  expect(await next).toBe(false);
  const accepted = confirmAction("Start this subtask?", "Ready?", "Start work");
  alert.mock.calls[2][2]![1].onPress?.();
  expect(await accepted).toBe(true);
  alert.mockRestore();
});
