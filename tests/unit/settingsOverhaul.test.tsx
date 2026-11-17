// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LockKeyhole, Database } from "lucide-react";
import { getEflowNavigationIcon } from "../../src/app/features/app-shell/eflowNavigationIcons";
import { SettingsContent } from "../../src/app/features/settings/components/SettingsContent";
import { readPersonalSettings } from "../../src/app/features/settings/personalSettingsStore";

const profileState = vi.hoisted(() => ({
  profile: {
    id: "user-1",
    full_name: "Gabriel Cahiyang",
    email: "gabriel@ormoc.gov.ph",
    role: "accounting_staff",
    employee_id: "EMP-102",
    org_id: "org-1",
    org_name: "LEDIPO",
    avatar_path: null as string | null,
    email_notifications_enabled: true,
  },
  updateUserProfile: vi.fn(),
  theme: "light" as const,
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: profileState.profile.id, email: profileState.profile.email },
    userProfile: profileState.profile,
    updateUserProfile: profileState.updateUserProfile,
  }),
}));

vi.mock("../../src/app/contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    theme: profileState.theme,
    loading: false,
    error: null,
    setTheme: profileState.setTheme,
  }),
}));

vi.mock("../../src/app/services/userSettingsService", () => ({
  getProfileAvatarUrl: vi.fn().mockResolvedValue(null),
  updateOwnProfile: vi.fn().mockResolvedValue({ full_name: "Gabriel Cahiyang" }),
  replaceProfileAvatar: vi.fn().mockResolvedValue({ avatar_path: null }),
  clearProfileAvatar: vi.fn().mockResolvedValue(undefined),
  updateEmailPreference: vi.fn().mockResolvedValue({ email_notifications_enabled: false }),
}));

vi.mock("../../src/lib/supabaseService", () => ({
  fetchAllOrgs: vi.fn().mockResolvedValue([{ id: "org-1", name: "LEDIPO" }]),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("Profile & Settings UI/UX overhaul and personalization", () => {
  it("uses honest LockKeyhole icon for Security and Database for Storage & cache", () => {
    expect(getEflowNavigationIcon("settings", "Security")).toBe(LockKeyhole);
    expect(getEflowNavigationIcon("settings", "Storage & cache")).toBe(Database);
  });

  it("renders loaded Profile identity immediately without duplicate avatar preview card and saves regional config", () => {
    render(<SettingsContent activePage="Profile" />);

    expect(screen.getByText("Gabriel Cahiyang")).toBeTruthy();
    expect(screen.getByText("gabriel@ormoc.gov.ph")).toBeTruthy();
    expect(screen.getByText("EMP-102")).toBeTruthy();
    expect(screen.queryByText("A recognizable account")).toBeNull();
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Date format"), { target: { value: "iso" } });
    fireEvent.change(screen.getByLabelText("Time format"), { target: { value: "24h" } });
    fireEvent.change(screen.getByLabelText("Week starts on"), { target: { value: "sunday" } });

    expect(readPersonalSettings("user-1")).toMatchObject({
      dateFormat: "iso",
      timeFormat: "24h",
      weekStartsOn: "sunday",
    });
  });

  it("saves Appearance density & motion comfort and Inbox notification defaults per user", () => {
    const view = render(<SettingsContent activePage="Appearance" />);

    fireEvent.change(screen.getByLabelText("Table and list density"), { target: { value: "compact" } });
    fireEvent.change(screen.getByLabelText("Animations and transitions"), { target: { value: "reduced" } });

    expect(document.documentElement.dataset.density).toBe("compact");
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(readPersonalSettings("user-1")).toMatchObject({
      density: "compact",
      motion: "reduced",
    });

    view.rerender(<SettingsContent activePage="Notifications" />);
    fireEvent.change(screen.getByLabelText("Default notifications tab"), { target: { value: "unread" } });
    fireEvent.change(screen.getByLabelText("Default activity filter"), { target: { value: "finance" } });

    expect(readPersonalSettings("user-1")).toMatchObject({
      defaultNotificationTab: "unread",
      defaultNotificationCategory: "finance",
    });
  });
});
