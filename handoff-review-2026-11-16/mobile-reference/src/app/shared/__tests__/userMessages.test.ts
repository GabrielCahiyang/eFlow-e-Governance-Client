import { expect, test } from "@jest/globals";
import {
  feedback,
  isDeterministicRejection,
  PublicMessageError,
  userErrorMessage,
} from "../userMessages";
import { loginErrorMessage } from "../../features/authentication/loginError";
import { displayWorkSnapshot } from "../../features/personal-work/displayWorkSnapshot";
import type { WorkSnapshot } from "../../../core/web/app/features/personal-work/types";

test.each([
  [{ message: "gateway connection refused", status: 503 }, feedback.load],
  [{ message: "offline policy", status: 403 }, feedback.access],
  [{ message: "opaque", status: 401 }, feedback.session],
  [{ message: "opaque", status: 404 }, feedback.unavailable],
  [{ name: "AbortError", message: "superseded" }, feedback.load],
  [{ name: "TimeoutError", message: "deadline" }, feedback.timeout],
  [new TypeError("Network request failed"), feedback.connection],
])(
  "classifies read recovery without exposing provider details: %j",
  (error, expected) => {
    expect(userErrorMessage(error)).toBe(expected);
  },
);

test.each([
  new Error(
    "permission denied for table profiles; https://secret.example.test key=private",
  ),
  new Error(
    "PGRST202 function internal_finance_guard missing from schema cache",
  ),
  { message: "invalid input syntax SQL user_table secret", code: "XX000" },
  new Error(
    "an arbitrary internal detail that contains no detectable technical keyword",
  ),
])("untrusted errors cannot expose provider messages: %j", (failure) => {
  const text = userErrorMessage(failure);
  expect(Object.values(feedback)).toContain(text);
  expect(text).not.toMatch(
    /profiles|PGRST|internal_finance|user_table|private|arbitrary/,
  );
});

test("login uses plain offline/timeout/account guidance, never the supplied account-error detail", () => {
  expect(loginErrorMessage(new TypeError("Network request failed"))).toBe(
    feedback.connection,
  );
  expect(
    loginErrorMessage(
      Object.assign(new Error("internal error"), { name: "TimeoutError" }),
    ),
  ).toMatch(/timed out/);
  for (const status of [401, 403, 423, 429, 500]) {
    const text = loginErrorMessage(
      Object.assign(new Error("sql private signing key"), {
        name: "AccountSignInError",
        status,
      }),
    );
    expect(text).not.toMatch(/sql|private|signing key|secure sign-in|service/i);
  }
  expect(userErrorMessage(new Error("Enter a work note."), "action")).toBe(
    "Enter a work note.",
  );
  expect(userErrorMessage(new Error("Network request failed"), "action")).toBe(
    "The connection was lost. Reconnect and check whether your changes were saved before trying again.",
  );
});

test.each([
  [{ code: "22023", message: "Complete earlier subtasks before starting this subtask" }, /Cancelled work does not count as completed/],
  [{ code: "23514", message: "Complete every selected prerequisite before starting this subtask." }, /Complete every selected prerequisite/],
  [{ code: "22023", message: "Complete earlier ordered steps first" }, /earlier ordered subtasks before completing/],
  [{ code: "22023", message: "Add subtasks directly to their task." }, /Open the parent task/],
  [{ code: "42501", message: "Only the appointed Task Lead can start this task" }, /appointed Task Lead/],
  [{ code: "22023", message: "Choose a start date within the parent schedule, or reschedule the parent first" }, /parent schedule/],
  [{ code: "P0001", message: "Project is on hold" }, /project is on hold/],
  [{ code: "22023", message: "Only 1,234.50 is available to protect on this budget line" }, /₱1,234\.50/],
  [{ code: "22023", message: "Choose today or a future start date." }, /^Choose today or a future start date\.$/],
  [{ code: "22023", message: "Choose today or a future due date." }, /^Choose today or a future due date\.$/],
  [{ code: "23514", message: "Set the task start and due dates before allocating funding" }, /^Set the task start and due dates before allocating funding\.$/],
  [{ code: "23514", message: "Selected FY 2026 funding does not overlap this task timeline" }, /^Selected FY 2026 funding does not overlap this task's start and due dates\.$/],
  [{ code: "22023", message: "Funding requires a locked annual budget" }, /^Lock the Office Budget for this fiscal year before allocating funding\.$/],
  [{ code: "23514", message: "Project source has ₱4,000.00 available; allocation requests ₱5,000.00" }, /^The selected project account has ₱4,000\.00 available; allocation requests ₱5,000\.00\.$/],
  [{ code: "23514", message: "Complete project setup and choose open work before allocating funding" }, /^Complete project setup and choose an open task before allocating funding\.$/],
  [{ code: "22007", message: 'invalid input syntax for type date: ""' }, /^Enter a valid date\.$/],
  [{ code: "40001", message: "unrecognized database detail" }, /item has changed/],
  [{ code: "XX000", message: "unexpected private implementation detail" }, /couldn't confirm/],
])("uses an actionable reason before the generic fallback: %j", (error, message) => {
  expect(userErrorMessage(error, "action")).toMatch(message);
});

test("PublicMessageError surfaces clean form guidance while still blocking internal details", () => {
  expect(userErrorMessage(new PublicMessageError("Choose today or a future start date."), "action")).toBe(
    "Choose today or a future start date.",
  );
  expect(userErrorMessage(new PublicMessageError("postgres schema rpc failed"), "action")).toBe(
    feedback.action,
  );
});

test("the work display projection strips every source record and capability while retaining destination labels", () => {
  const snapshot = {
    rows: [
      {
        key: "row",
        id: "node",
        rootId: "root",
        title: "Task",
        kind: "personal-node",
        projectId: "project",
        projectTitle: "Project",
        workspaceName: "Office",
        timezone: "Asia/Manila",
        status: "todo",
        progress: 0,
        mine: true,
        leading: true,
        history: false,
        relation: "Lead",
        actionable: true,
        tree: { capabilities: { approve: true } },
        task: {},
        subtask: {},
        node: {},
        personal: {},
        personalTask: {},
      },
    ],
    projects: [],
    workspaces: [],
    issues: [],
    unavailable: [],
    loadedAt: 1,
  } as unknown as WorkSnapshot;
  const result = displayWorkSnapshot(snapshot).rows[0];
  expect(result).toMatchObject({
    id: "node",
    rootId: "root",
    projectId: "project",
    title: "Task",
    actionable: false,
  });
  for (const key of [
    "tree",
    "task",
    "subtask",
    "node",
    "personal",
    "personalTask",
  ])
    expect(result).not.toHaveProperty(key);
  expect(snapshot.rows[0].actionable).toBe(true);
});

test.each([
  [
    new Error("Appoint an independent project reviewer before requesting cash"),
    "Appoint an independent project reviewer before requesting cash.",
  ],
  [
    new Error("Needed-by date cannot be earlier than today"),
    "Needed-by date cannot be earlier than today.",
  ],
  [
    new Error(
      "Funding source Supplies: requested PHP 500.00, available PHP 200.00",
    ),
    "Funding source Supplies: requested PHP 500.00, only PHP 200.00 available.",
  ],
  [
    new Error("Apply the office budget migration, then refresh this page"),
    "Office budgets aren't available yet because a budget service update is missing.",
  ],
  [
    {
      code: "P0001",
      message: "Project closeout is blocked: Pending liquidations exist",
    },
    "Project closeout is blocked: Pending liquidations exist.",
  ],
  [
    {
      code: "57014",
      message: "canceling statement due to statement timeout",
    },
    "The request timed out. Check whether your changes were saved before trying again.",
  ],
])(
  "surfaces domain and gateway errors before generic action fallback: %j",
  (error, expected) => {
    expect(userErrorMessage(error, "action")).toBe(expected);
  },
);

test("pattern-matched domain messages still fail closed when captures look internal", () => {
  const unsafe = new Error(
    "Funding source Supplies https://secret.example.test: requested PHP 500, available PHP 200",
  );
  expect(userErrorMessage(unsafe, "action")).toBe(feedback.action);
});

test.each([
  new Error("Appoint an independent project reviewer before requesting cash"),
  new Error("Needed-by date cannot be earlier than today"),
  new Error(
    "Funding source Supplies: requested PHP 500.00, available PHP 200.00",
  ),
  new PublicMessageError("Choose a valid date."),
  { status: 400, message: "Bad request" },
  { status: 403, message: "Forbidden" },
  { status: 409, message: "Conflict" },
  { status: 422, message: "Unprocessable" },
  { code: "P0001", message: "Custom guard rejection" },
  { code: "23505", message: "duplicate key" },
  { code: "42501", message: "Access changed" },
  { code: "40001", message: "serialization failure" },
])("identifies deterministic rejections for retry unlock: %j", (error) => {
  expect(isDeterministicRejection(error)).toBe(true);
});

test.each([
  null,
  undefined,
  { status: 408, message: "Timeout" },
  { status: 500, message: "Internal error" },
  { status: 503, message: "Unavailable" },
  { name: "TimeoutError", message: "deadline" },
  { code: "57014", message: "canceling statement due to statement timeout" },
  new TypeError("Network request failed"),
  { code: "XX000", message: "opaque backend error" },
  new Error("an arbitrary internal detail that contains no detectable technical keyword"),
  new Error("Upload interrupted"),
  new PublicMessageError(
    "The result could not be confirmed. Verify this saved request before submitting again.",
  ),
  new Error("A work operation is already pending"),
  new PublicMessageError(feedback.saved),
])("keeps recovery locked on ambiguous, transient, or unknown errors: %j", (error) => {
  expect(isDeterministicRejection(error)).toBe(false);
});


test("timeline validation directs the user to the appointed Task Lead",()=>{
 expect(userErrorMessage({code:"22023",message:'Reschedule subtask "Create the meeting sign-in sheet" before changing this timeline.'},"action"))
 .toMatch(/Ask the appointed Task Lead to reschedule .*Create the meeting sign-in sheet.* first\./);
});

test.each([
  "Task start date is earlier than a prerequisite due date. Adjust the schedule first",
  "The subtask starts before a prerequisite is due. Adjust the schedule first.",
])("an older server's date-only linking rejection clearly identifies the backend dependency: %s", message => {
  expect(userErrorMessage({ code: "23514", message }, "action"))
    .toBe("Prerequisite linking needs a backend update. Contact your Office Head.");
});
