import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const supervision = read("src/app/features/team-management/components/supervision/TeamSupervisionWorkspace.tsx");
const intelligence = read("src/app/features/team-management/components/intelligence/TeamIntelligenceWorkspace.tsx");
const identity = read("src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx");
const peopleShell = read("src/app/features/team-management/components/PeopleWorkspaceShell.tsx");
const reports = read("src/app/features/reports/components/HeadReportsWorkspace.tsx");
const reportTable = read("src/app/features/reports/components/DepartmentReportTable.tsx");
const announcementCenter = read("src/app/features/announcements/components/center/AnnouncementCenter.tsx");
const adminAnnouncements = read("src/app/features/announcements/components/admin/AdminAnnouncements.tsx");
const chatDrawer = read("src/app/features/chat-calls/components/ChatListDrawer.tsx");
const chatChannels = read("src/app/features/chat-calls/components/ChatChannelList.tsx");

describe("Phase 8 people, reports, and communications presentation", () => {
  it("uses layout-matched skeletons instead of blocking spinner surfaces", () => {
    for (const source of [supervision, intelligence, reports, announcementCenter, adminAnnouncements]) {
      expect(source).toContain("WorkspaceLoadingSkeleton");
      expect(source).not.toContain("LoadingState");
    }
  });

  it("keeps the report library rail, sticky filters, and task drill-down contract", () => {
    expect(reports).toContain('title="Report library"');
    expect(reports).toContain("sticky top-3");
    expect(reports).toContain("setSelectedTaskId");
    expect(reports).toContain("ExportMenu");
    expect(reports).toContain('"border-primary/25 bg-primary/10 text-primary shadow-sm"');
    expect(reports).not.toContain('"bg-neutral-900 text-white"');
  });

  it("constrains long report fields so work-item text wraps inside the table", () => {
    expect(reportTable).toContain("table-fixed");
    expect(reportTable).toContain("break-words");
    expect(reportTable).toContain("whitespace-normal");
    expect(reportTable).toContain("expandedRowId");
    expect(reportTable).toContain("aria-expanded={expanded}");
    expect(reportTable).toContain("Full work item");
  });

  it("uses one People shell and makes supervision a three-panel operational workspace", () => {
    expect(peopleShell).toContain('aria-label="People workspace"');
    for (const source of [supervision, intelligence, identity]) {
      expect(source).toContain("PeopleWorkspaceShell");
    }
    expect(supervision).toContain("TeamMemberWorkPanel");
    expect(supervision).toContain("xl:grid-cols-[250px_minmax(0,1fr)_390px]");
    expect(supervision).toContain("Add member");
  });

  it("keeps access management oriented around accountable current access", () => {
    expect(identity).toContain("Available staff");
    expect(identity).toContain("Current access");
    expect(identity).toContain("Protected leadership");
    expect(identity).toContain("audit consequence");
  });

  it("keeps communication unread affordances keyboard-labelled and viewport-safe", () => {
    expect(chatDrawer).toContain("ChatUnreadBadge");
    expect(chatDrawer).toContain('role="dialog"');
    expect(chatDrawer).toContain("max-w-[calc(100vw-16px)]");
    expect(chatChannels).toContain("focus-visible:ring-2");
    expect(chatChannels).toContain("aria-current={activeChannelId === c.channelId");
    expect(announcementCenter).toContain("bg-red-500");
  });
});
