import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { DepartmentBudgetBundle } from "../../../core/web/app/features/budget/types";
import type { WorkTreeSnapshot } from "../../../core/web/app/features/nested-work/types";
import { rememberWorkCapabilityContext } from "../../../core/web/app/features/nested-work/selectors/capabilities";
import type { Employee } from "../../../core/web/app/services/employeeService";
import { draftStore } from "../../../platform/draftStore";
import { AnnualBudgetSheet } from "../../features/budget/AnnualBudgetSheet";
import { PasswordSheet } from "../../features/settings/PasswordSheet";
import { WorkEditorSheet } from "../../features/tasks/WorkEditorSheet";
import { CoachingSheet } from "../../features/team-management/CoachingSheet";
import { confirmAction } from "../confirm";
import { clearAllFormDrafts } from "../formDraftMemory";

jest.mock("../../features/authentication", () => ({
  useAuth: () => ({
    profile: { id: "actor-1", org_id: "office-1", email: "user@eflow.test" },
    user: { id: "actor-1", email: "user@eflow.test" },
  }),
}));
jest.mock("../../features/authentication/mobileSignIn", () => ({
  signInOnMobile: jest.fn(),
}));
jest.mock("../../../platform/draftStore", () => ({
  draftStore: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  },
}));
jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      updateUser: jest.fn(),
    },
  },
}));
jest.mock("../confirm", () => ({
  confirmAction: jest.fn(async () => false),
}));
jest.mock("../../../core/web/app/features/budget/services/budgetSectionService", () => ({
  saveBudgetSections: jest.fn(),
  fetchBudgetSections: jest.fn(),
}));
jest.mock("../../../core/web/app/features/budget/services/budgetService", () => ({
  lockDepartmentFiscalBudget: jest.fn(),
  closeDepartmentFiscalBudget: jest.fn(),
  fetchDepartmentBudgetBundle: jest.fn(),
}));
jest.mock("../../../core/web/app/services/employeeNotesService", () => ({
  updateEmployeeNotes: jest.fn(),
}));
jest.mock("../../../core/web/app/features/nested-work/services/workTreeService", () => ({
  fetchWorkTree: jest.fn(),
  saveWorkTree: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearAllFormDrafts();
  jest.mocked(draftStore.get).mockResolvedValue(null);
});

test("AnnualBudgetSheet reopens from saved budget values instead of abandoned edits", async () => {
  const onClose = jest.fn();
  const bundle = {
    summary: {
      id: "budget-1",
      status: "draft",
      allocatedBudget: 50000,
      approvedAmount: 50000,
      notes: "Saved budget notes",
    },
    lines: [],
    sections: [],
  } as unknown as DepartmentBudgetBundle;

  const first = await render(
    <AnnualBudgetSheet
      orgId="office-1"
      year={2026}
      data={bundle}
      onSaved={async () => {}}
      onClose={onClose}
    />,
  );

  await fireEvent.changeText(
    screen.getByLabelText("Budget notes"),
    "Hold Q4 printing contingency",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  expect(confirmAction).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  await first.unmount();

  await render(
    <AnnualBudgetSheet
      orgId="office-1"
      year={2026}
      data={bundle}
      onSaved={async () => {}}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("Budget notes").props.value).toBe(
    "Saved budget notes",
  );
});

test("PasswordSheet reopens with empty password fields", async () => {
  const onClose = jest.fn();
  const first = await render(
    <PasswordSheet onClose={onClose} onSaved={() => {}} />,
  );

  await fireEvent.changeText(screen.getByLabelText("Current password"), "OldPass1!");
  await fireEvent.changeText(screen.getByLabelText("New password"), "NewPass123!");
  await fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "NewPass123!",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  expect(confirmAction).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  await first.unmount();

  await render(<PasswordSheet onClose={jest.fn()} onSaved={() => {}} />);
  expect(screen.getByLabelText("Current password").props.value).toBe("");
  expect(screen.getByLabelText("New password").props.value).toBe("");
  expect(screen.getByLabelText("Confirm new password").props.value).toBe(
    "",
  );
});

test("CoachingSheet reopens from saved member context instead of an abandoned draft", async () => {
  const onClose = jest.fn();
  const employee = {
    id: "emp-1",
    full_name: "Maria Santos",
    jobDescription: "Current job scope",
    role: "member",
  } as unknown as Employee;

  const first = await render(
    <CoachingSheet
      employee={employee}
      actor="actor-1"
      onClose={onClose}
      onSaved={async () => {}}
    />,
  );

  await fireEvent.changeText(
    screen.getByLabelText("Strengths"),
    "Clear financial documentation",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Manager notes"),
    "Follow up next Monday",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  expect(confirmAction).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  await first.unmount();

  await render(
    <CoachingSheet
      employee={employee}
      actor="actor-1"
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  expect(screen.getByLabelText("Strengths").props.value).toBe(
    "Current job scope",
  );
  expect(screen.getByLabelText("Manager notes").props.value).toBe(
    "",
  );
});

test("WorkEditorSheet closes immediately without alert and restores typed subtask fields on reopen", async () => {
  const onClose = jest.fn();
  const data = {
    root: {
      id: "task-1",
      kind: "office",
      office: "office-1",
      project: "project-1",
      open: true,
      people: [],
      capabilities: { create_child: { allowed: true, reason_code: null } },
    },
    revision: 3,
    nodes: [],
    people: [],
  } as unknown as WorkTreeSnapshot;
  rememberWorkCapabilityContext(data, "actor-1");

  const first = await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      onClose={onClose}
      onSaved={async () => {}}
    />,
  );

  await fireEvent.changeText(
    await screen.findByLabelText("Subtask name"),
    "Draft venue checklist",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  expect(confirmAction).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  await first.unmount();

  await render(
    <WorkEditorSheet
      data={data}
      edit={{ command: "create" }}
      onClose={jest.fn()}
      onSaved={async () => {}}
    />,
  );
  expect((await screen.findByLabelText("Subtask name")).props.value).toBe(
    "Draft venue checklist",
  );
});
