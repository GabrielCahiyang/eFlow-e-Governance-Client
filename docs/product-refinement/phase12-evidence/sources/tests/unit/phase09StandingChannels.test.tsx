// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAncestorOrgIds } from "../../src/lib/supabaseService";
import { escapeTableCellHtml, SimpleTableEditor } from "../../src/app/components/ui/SimpleTableEditor";
import type { Organization } from "../../src/app/types";

const migration = readFileSync(
  "supabase/migrations/20260926000000_phase09_standing_org_channels.sql",
  "utf8",
);
const chatList = readFileSync(
  "src/app/features/chat-calls/components/ChatChannelList.tsx",
  "utf8",
);
const taskDrawer = readFileSync(
  "src/app/features/task-inspector/components/InspectorEvidence.tsx",
  "utf8",
);
const taskEditor = readFileSync(
  "src/app/features/tasks/components/board/TaskEditorModal.tsx",
  "utf8",
);
const submissionModal = readFileSync(
  "src/app/features/tasks/components/board/TaskSubmissionModals.tsx",
  "utf8",
);
const topBar = readFileSync(
  "src/app/features/app-shell/components/EflowTopBar.tsx",
  "utf8",
);

function organization(id: string, path: string): Organization {
  return {
    id,
    name: id,
    slug: id,
    parent_id: null,
    path,
    org_type: "department",
    description: "",
    head_user_id: null,
    assistant_head_user_id: null,
    is_active: true,
    created_at: "2026-09-26T00:00:00.000Z",
    updated_at: "2026-09-26T00:00:00.000Z",
  };
}

describe("Phase 9 standing channels and rich submissions", () => {
  it("shows only the current organization and its ancestors as standing-channel candidates", () => {
    const orgs = [
      organization("city", "city"),
      organization("planning", "city.planning"),
      organization("delivery", "city.planning.delivery"),
      organization("other", "city.other"),
    ];

    expect(getAncestorOrgIds(orgs, "delivery")).toEqual([
      "city",
      "planning",
      "delivery",
    ]);
  });

  it("keeps organization-channel access on the ancestor-to-descendant path and backfills one channel per organization", () => {
    expect(migration).toContain("chat_channels_org_unique");
    expect(migration).toContain("where org_id is not null and channel_type = 'org'");
    expect(migration).toContain("organizations_create_chat_channel");
    expect(migration).toContain("from public.organizations as organization");
    expect(migration).toContain("pg_catalog.starts_with(user_org.path::text, channel_org.path::text || '.')");
  });

  it("keeps standing channels visually separate from direct and task conversations", () => {
    expect(chatList).toContain("Direct Messages");
    expect(chatList).toContain("Standing Channels");
    expect(chatList).toContain("Task Chats");
  });

  it("passes the user organization to the global chat drawer and keeps task chat embedded in the task editor", () => {
    expect(topBar).toContain("userOrgId={userProfile?.departmentId}");
    expect(taskEditor).toContain("<TaskChatSection");
    expect(taskEditor).toContain("currentUserId={currentUserId}");
  });

  it("escapes table cell input before it becomes a stored submission-note HTML string", () => {
    expect(escapeTableCellHtml(`<img src=x onerror="alert('x')"> & report`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; report",
    );

    const onChange = vi.fn();
    render(<SimpleTableEditor onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Row 1, column 1"), {
      target: { value: "<strong>Delivered</strong>" },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining("&lt;strong&gt;Delivered&lt;/strong&gt;"),
    );
  });

  it("uses the same sanitized rich-note display in the task inspector", () => {
    expect(taskDrawer).toContain('import DOMPurify from "dompurify"');
    expect(taskDrawer).toContain("DOMPurify.sanitize(task.latestSubmission.note)");
    expect(submissionModal).toContain("<RichTextEditor");
    expect(submissionModal).toContain("<SimpleTableEditor");
  });
});
