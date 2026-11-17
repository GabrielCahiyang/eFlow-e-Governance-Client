import { afterEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  beginOperation,
  isPermissionRead,
  operationMessage,
} from "../operationActivity";
import { clearDisplayCache } from "../displayCache";
import { useAction } from "../useAction";
import { useFacts } from "../useFacts";

afterEach(() => {
  clearDisplayCache("identity");
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test("overlapping updates retain feedback until the last operation settles", () => {
  const permission = beginOperation("permissions"),
    first = beginOperation("update"),
    second = beginOperation("update");
  expect(operationMessage()).toBe("Updating…");
  first();
  expect(operationMessage()).toBe("Updating…");
  second();
  expect(operationMessage()).toBe("Checking actions…");
  permission();
  expect(operationMessage()).toBe("");
  first();
  expect(operationMessage()).toBe("");
});
test("account changes clear old activity and a late completion cannot clear the new actor's work", () => {
  const old = beginOperation("update");
  clearDisplayCache("identity");
  expect(operationMessage()).toBe("");
  const current = beginOperation("permissions");
  old();
  expect(operationMessage()).toBe("Checking actions…");
  current();
});
test("shared actions show feedback through refresh, prevent duplicates and clear feedback after failure", async () => {
  const pending = deferred<void>(),
    refresh = deferred<void>();
  const hook = await renderHook(() => useAction({ requireAccess: false }));
  const operation = jest.fn(async () => {
    await pending.promise;
    await refresh.promise;
  });
  let result!: Promise<boolean>;
  await act(async () => {
    result = hook.result.current.run(operation);
  });
  expect(operationMessage()).toBe("Updating…");
  await act(async () => {
    expect(await hook.result.current.run(operation)).toBe(false);
  });
  expect(operation).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve());
  expect(operationMessage()).toBe("Updating…");
  await act(async () => refresh.resolve());
  expect(await result).toBe(true);
  expect(operationMessage()).toBe("");
  await act(async () => {
    await hook.result.current.run(async () => {
      throw new Error("Denied");
    });
  });
  expect(hook.result.current.error?.message).toBe("Denied");
  expect(operationMessage()).toBe("");
});
test("permission refresh keeps the last snapshot while checking and publishes a denial when returned", async () => {
  const next = deferred<boolean>();
  let calls = 0;
  const hook = await renderHook(() =>
    useFacts("task-structure:actor:task", () =>
      ++calls === 1 ? Promise.resolve(true) : next.promise,
    ),
  );
  await waitFor(() => expect(hook.result.current.data).toBe(true));
  let request!: Promise<void>;
  await act(async () => {
    request = hook.result.current.refresh();
  });
  expect(hook.result.current.data).toBe(true);
  expect(hook.result.current.loading).toBe(true);
  expect(operationMessage()).toBe("Checking actions…");
  await act(async () => next.resolve(false));
  await request;
  expect(hook.result.current.data).toBe(false);
  expect(operationMessage()).toBe("");
});
test("only permission reads receive the shared action-checking feedback", () => {
  for (const key of [
    "task-structure:a",
    "task-detail-edit:a",
    "member-access:a",
  ])
    expect(isPermissionRead(key)).toBe(true);
  expect(isPermissionRead("task-activity:a")).toBe(false);
});
