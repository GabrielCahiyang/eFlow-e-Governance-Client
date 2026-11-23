// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  confirmProfile: vi.fn(),
  getMyPds: vi.fn(),
  uploadPds: vi.fn(),
  runPersonal: vi.fn(),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    userProfile: { id: "user-1", full_name: "Ana Reyes", role: "head", org_id: "org-1", is_active: true },
  }),
}));

vi.mock("../../src/app/shared/skillTags", () => ({
  useSkillTags: () => ({ activeLabels: ["Budgeting", "Procurement"], loading: false }),
}));

vi.mock("../../src/app/features/professional-profile/services/professionalProfileService", () => ({
  getProfessionalProfile: mocks.getProfile,
  updateProfessionalProfile: mocks.updateProfile,
  confirmProfessionalProfile: mocks.confirmProfile,
  getMyPds: mocks.getMyPds,
  uploadPds: mocks.uploadPds,
  getPdsDraft: vi.fn(),
  getPdsDownload: vi.fn(),
  retryPds: vi.fn(),
}));

vi.mock("../../src/app/features/project-files", () => ({
  ProjectFileLibrary: ({ taskId }: { taskId: string }) => <div>Files library for {taskId}</div>,
}));

vi.mock("../../src/app/features/nested-work", () => ({
  WorkTree: () => <div>WorkTree</div>,
  fetchPersonalWorkRoots: vi.fn().mockResolvedValue([]),
  supportsNestedWork: (t: { linkedProjectId?: string; proposedOfficeIdentityId?: string; sourceCollaborationDraftId?: string }) =>
    Boolean(t.linkedProjectId) && !t.proposedOfficeIdentityId && !t.sourceCollaborationDraftId,
  useWorkTree: () => ({
    rootId: "task-1",
    actorId: "user-1",
    data: undefined,
    loading: false,
    error: "",
    unavailable: false,
    authorityFresh: false,
    refreshPending: false,
    pending: false,
    reload: vi.fn(),
    save: vi.fn(),
  }),
  WorkRootStaffingDialog: () => <div role="dialog">Canonical Staffing Dialog</div>,
}));

import { OfficeMemberInspector } from "../../src/app/features/office-team/components/OfficeMemberInspector";
import { AccountInspector } from "../../src/app/features/administration/components/user-management/AccountInspector";
import { PersonalTaskCreate, PersonalTaskList } from "../../src/app/features/workspaces/components/PersonalTaskList";
import { ProfessionalProfilePanel } from "../../src/app/features/professional-profile/components/ProfessionalProfilePanel";
import { SubtaskWorkDrawer } from "../../src/app/features/subtasks/components/SubtaskWorkDrawer";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfile.mockResolvedValue({
    profile: {
      skills: ["Budgeting"],
      education: ["BS Accountancy"],
      trainings: [],
      certifications: [],
      work_experience: [],
      specializations: [],
      competency_summary: "Public finance specialist",
      confirmed_by_user: false,
    },
  });
  mocks.getMyPds.mockResolvedValue({ documents: [] });
  mocks.updateProfile.mockResolvedValue({
    profile: {
      skills: ["Budgeting"],
      education: ["BS Accountancy"],
      trainings: [],
      certifications: [],
      work_experience: [],
      specializations: [],
      competency_summary: "Updated summary",
      confirmed_by_user: false,
    },
  });
  mocks.confirmProfile.mockResolvedValue({
    profile: {
      skills: ["Budgeting"],
      education: ["BS Accountancy"],
      trainings: [],
      certifications: [],
      work_experience: [],
      specializations: [],
      competency_summary: "Updated summary",
      confirmed_by_user: true,
    },
  });
  mocks.runPersonal.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe("Right-side drawer elimination & Sir Nonel QA standard", () => {
  it("keeps zero live right-side InspectorPanel or legacy drawer CSS across converted features", () => {
    const convertedFiles = [
      "src/app/features/office-team/components/OfficeMemberInspector.tsx",
      "src/app/features/onboarding/components/OnboardingWorkspace.tsx",
      "src/app/features/administration/components/user-management/AccountInspector.tsx",
      "src/app/features/announcements/components/center/AnnouncementCenter.tsx",
      "src/app/features/workspaces/components/PersonalTaskList.tsx",
      "src/app/features/interdepartment-collaboration/components/CollaborationDraftWorkspace.tsx",
      "src/app/features/subtasks/components/SubtaskWorkDrawer.tsx",
      "src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx",
    ];
    for (const file of convertedFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("InspectorPanel");
      expect(source, file).not.toContain("eflow-member-panel");
      expect(source, file).not.toContain("eflow-collaboration-inspector");
      expect(source, file).not.toContain("LegacySubtaskWorkDrawer");
      expect(source, file).not.toContain("LegacyTaskTeamEditorDialog");
    }

    const profileCss = readFileSync("src/app/features/professional-profile/professionalProfile.css", "utf8");
    expect(profileCss).not.toContain("eflow-member-panel");

    const projectsCss = readFileSync("src/app/features/projects/components/projectsVibe.css", "utf8");
    expect(projectsCss).not.toContain("eflow-project-tools-inspector");
    expect(projectsCss).not.toContain("eflow-collaboration-inspector");
  });

  it("renders OfficeMemberInspector in a centered Modal with clean Overview and direct Professional Profile switch", async () => {
    const onClose = vi.fn();
    render(
      <OfficeMemberInspector
        member={{
          id: "m-1",
          full_name: "Juan Dela Cruz",
          email: "juan@lgu.gov.ph",
          role: "member",
          is_active: true,
        }}
        office="LEDIPO"
        onClose={onClose}
        onReturnFocus={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThan(0);
    expect(screen.getByText("LEDIPO")).toBeTruthy();
    expect(screen.queryByText(/Not loaded/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Open Professional Profile/i }));
    expect(await screen.findByText("BS Accountancy")).toBeTruthy();
  });

  it("renders AccountInspector in a centered Modal and disables password reset for inactive accounts", () => {
    render(
      <AccountInspector
        profile={{
          id: "acct-1",
          full_name: "Maria Santos",
          email: "maria@lgu.gov.ph",
          role: "member",
          is_active: false,
        } as any}
        protection="Protected system owner"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onAccess={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Protected system owner")).toBeTruthy();
    const resetBtn = screen.getByRole("button", { name: /Send password reset/i }) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(true);
  });

  it("enforces bounded input validation on PersonalTaskCreate, disables no-op 99% progress button, and opens Task files in centered Modal", async () => {
    render(
      <>
        <PersonalTaskCreate
          members={[{ user_id: "user-1", name: "Ana Reyes", state: "active", eligible: true } as any]}
          userId="user-1"
          busy={false}
          run={mocks.runPersonal}
        />
        <PersonalTaskList
          data={{
            owner: "user-1",
            project: { id: "p-1", title: "Personal", status: "active" },
            members: [{ user_id: "user-1", name: "Ana Reyes", state: "active", eligible: true }],
            tasks: [
              {
                id: "t-99",
                title: "Finalize memo",
                lead_id: "user-1",
                reviewer_id: null,
                status: "in_progress",
                progress: 99,
                revision: 2,
                note: "",
                review_note: "",
              },
            ],
          } as any}
          userId="user-1"
          busy={false}
          run={mocks.runPersonal}
        />
      </>,
    );

    // Bottom-right live character counter rendered by BoundedTextInput
    expect(screen.getByText("0 / 200")).toBeTruthy();

    // Anti-BS flow: Record progress is disabled once task is already at 99%
    const progressBtn = screen.getByRole("button", { name: "Record progress" }) as HTMLButtonElement;
    expect(progressBtn.disabled).toBe(true);

    // Opening Files uses centered Modal (no right-side InspectorPanel)
    fireEvent.click(screen.getByRole("button", { name: "Files for Finalize memo" }));
    expect(await screen.findByText("Files library for t-99")).toBeTruthy();
  });

  it("renders live counters and single-step Save & confirm on ProfessionalProfilePanel", async () => {
    render(<ProfessionalProfilePanel />);
    const editBtn = await screen.findByRole("button", { name: "Edit profile" });
    fireEvent.click(editBtn);

    // Live bottom-right counters for bounded textareas
    expect(screen.getByText(/\/ 1,500/)).toBeTruthy();
    expect(screen.getAllByText(/\/ 4,000/).length).toBeGreaterThanOrEqual(5);

    // No-op save blocked when untouched
    const saveBtn = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const summary = screen.getByLabelText("Professional summary");
    fireEvent.change(summary, { target: { value: "  Updated summary  " } });
    expect(saveBtn.disabled).toBe(false);

    const saveAndConfirm = screen.getByRole("button", { name: /Save & confirm/i });
    fireEvent.click(saveAndConfirm);

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    expect(mocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ competency_summary: "Updated summary" }),
    );
    await waitFor(() => expect(mocks.confirmProfile).toHaveBeenCalledOnce());
  });

  it("renders a clean centered Modal unavailable notice in SubtaskWorkDrawer when parentTask is missing (no legacy fallback)", () => {
    render(
      <SubtaskWorkDrawer
        subtask={{ id: "s-1", taskId: "t-1", title: "Orphan step" } as any}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Open from the parent task")).toBeTruthy();
  });
});
