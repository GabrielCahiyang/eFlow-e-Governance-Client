import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("../../src/app/features/interdepartment-collaboration/services/collaborationDraftService.ts", import.meta.url), "utf8");
const header = readFileSync(new URL("../../src/app/features/interdepartment-collaboration/components/CollaborationWorkspaceHeader.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260826000003_dynamic_task_funding.sql", import.meta.url), "utf8");
const sourcePanel = readFileSync(new URL("../../src/app/features/interdepartment-collaboration/components/CollaborationSourcePanel.tsx", import.meta.url), "utf8");

describe("collaboration Source & governance access", () => {
  it("does not misdiagnose a primary-key visibility miss as a single-row cardinality failure", () => {
    expect(service).toContain('.eq("id", draftId).maybeSingle()');
    expect(service).toContain("could not be found or your account does not have access");
  });

  it("keeps working tabs visible to department collaborators", () => {
    expect(header).toContain('label: "Source PDF"');
    expect(header).toContain('label: "Collaboration"');
    expect(header).toContain('label: "Requested changes"');
    expect(header).toContain('label: "Plan update history"');
    expect(header).toContain('item.id !== "approvals" && item.id !== "governance"');
    expect(header).not.toContain('item.id !== "discussion"');
  });

  it("makes the source document a view-only workspace tool", () => {
    expect(sourcePanel).toContain('"View source PDF"');
    expect(sourcePanel).not.toContain('"Replace PDF"');
    expect(sourcePanel).toContain("!draft.sourceFilePath");
  });

  it("recognizes home-organization, proposal, project, task, and subtask participation", () => {
    expect(migration).toContain("profile.org_id = target_organization");
    expect(migration).toContain("from public.proposal_collaboration_orgs");
    expect(migration).toContain("join public.project_members");
    expect(migration).toContain("project.owner_id = caller_id");
    expect(migration).toContain("task.assigned_to = caller_id");
    expect(migration).toContain("coalesce(to_jsonb(task.team_member_ids)");
    expect(migration).toContain("coalesce(subtask.assigned_to_ids");
  });
});
