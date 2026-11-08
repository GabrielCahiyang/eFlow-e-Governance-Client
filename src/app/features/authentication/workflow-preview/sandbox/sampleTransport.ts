import { ids, type Row, type SampleRecords } from "./sampleRecords";

function json(value: unknown, single = false) {
  const data = single && Array.isArray(value) ? value[0] ?? null : value;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (Array.isArray(value)) headers["Content-Range"] = `0-${Math.max(0, value.length - 1)}/${value.length}`;
  return new Response(JSON.stringify(data ?? null), { status: 200, headers });
}
function userFor(records: SampleRecords) {
  const profile = records.profiles.find(p => p.id === records.actor)!;
  return { id: records.actor, aud: "authenticated", role: "authenticated", email: profile.email,
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: profile.created_at };
}

export function initializeSampleSession(records: SampleRecords) {
  if (records.scene === "accept-invite") return;
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: records.actor, aud: "authenticated", role: "authenticated", exp }) + ".sample";
  const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
  localStorage.setItem("sb-" + ref + "-auth-token", JSON.stringify({ access_token: token, refresh_token: "sample", expires_in: 3600, expires_at: exp, token_type: "bearer", user: userFor(records) }));
  localStorage.setItem(`eflow:guided-tour:2026.08-v1:${records.actor}:${records.role}`, JSON.stringify({ welcomed: true, systemCompleted: false, completedPages: [], voiceEnabled: false }));
  localStorage.setItem("eflow_project_columns_" + ids.project, "[]");
}

export function installSampleTransport(records: SampleRecords) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    // Build manifests and local assets may be requested by lazyFeature.
    if (request.method === "GET" && url.origin === location.origin && /\.(json|js|css|svg|woff2)$/.test(url.pathname) && !url.pathname.includes("/api/")) {
      return nativeFetch(request);
    }
    const payload: Row = request.method === "GET" || request.method === "HEAD" ? {} : await request.clone().json().catch(() => ({}));
    if (url.pathname.includes("/auth/v1/")) return json(userFor(records));
    if (url.pathname.includes("/rest/v1/")) {
      const operation = url.pathname.split("/").pop()!;
      const single = request.headers.get("Accept")?.includes("vnd.pgrst.object");
      let result = url.pathname.includes("/rpc/") ? rpc(records, operation, payload) : records.tables[operation] || [];
      if (operation === "user_preferences") result = { user_id: records.actor, theme: "light" };
      if (Array.isArray(result)) {
        const rows = result.filter((row: Row) => [...url.searchParams].every(([key, value]) => {
          if (value === "is.null") return row[key] == null;
          if (value.startsWith("eq.") && key in row) return String(row[key]) === value.slice(3);
          if (value.startsWith("not.is.null") && key in row) return row[key] != null;
          return true;
        }));
        const offset = Number(url.searchParams.get("offset") || 0);
        const limit = Number(url.searchParams.get("limit") || rows.length);
        result = rows.slice(offset, offset + limit);
      }
      return json(result, single);
    }
    if (url.pathname.includes("/controlpanelEflow/") || url.pathname.startsWith("/api/")) return json(gateway(records, url.pathname));
    // No data, authentication or mutation can fall through to a real service.
    return new Response(JSON.stringify({ message: "This is a walkthrough preview." }), { status: 403, headers: { "Content-Type": "application/json" } });
  };
}

function rpc(r: SampleRecords, operation: string, payload: Row): unknown {
  const unfunded = r.scene === "project-funding";
  const closed = ["complete", "archived"].includes(r.scene);
  const settled = ["task-review", "return-funding", "complete", "archived"].includes(r.scene);
  const cashReleased = ["receipts", "settlement", "task-review", "return-funding", "complete", "archived"].includes(r.scene);
  const members = r.profiles.map(p => ({ id: p.id, name: p.full_name, eligible: true, user_id: p.id, can_read: true, office: ids.office, engagement: "Permanent", access_end: null, access_ended_at: null }));
  const cap = { allowed: true, reason_code: null };
  switch (operation) {
    case "r3_list_workspaces": return [{ id: ids.office, name: r.office.name, kind: "office", office_id: ids.office, owner_id: null, state: "active", timezone: "Asia/Manila" }];
    case "r3_select_workspace": return { workspace: { id: ids.office, name: r.office.name, kind: "office", office_id: ids.office, owner_id: null, state: "active", timezone: "Asia/Manila" }, projects: [{ ...r.project, kind: "office", home_workspace_id: ids.office }] };
    case "organization_approver_ids": return [ids.head];
    case "project_flow_snapshot": return {
      project: r.project, ready: true, canAuthorize: r.role === "head", canAllocate: r.role === "head", canExtendTaskFunding: true,
      funds: unfunded ? [] : [{ id: ids.source, name: "Supplies", fiscal_year: 2026, amount: closed ? 3500 : 40000, available: closed ? 0 : r.scene === "allocate-task" ? 40000 : 30000 }],
      sources: [{ id: ids.source, name: "Supplies", year: 2026, available: unfunded ? 100000 : closed ? 96500 : 60000 }], total: unfunded ? 0 : closed ? 3500 : 40000,
      allocated: unfunded || r.scene === "allocate-task" ? 0 : closed ? 3500 : 10000, unallocated: unfunded || closed ? 0 : r.scene === "allocate-task" ? 40000 : 30000,
      released: cashReleased ? 4000 : 0, spent: settled ? 3500 : 0, returned: settled ? 500 : 0, outstanding: cashReleased && !settled ? 4000 : 0,
      requests: [], fundingRequests: [], liquidations: [],
      taskFunding: unfunded || r.scene === "allocate-task" ? [] : [{ id: ids.line, sourceId: ids.source, fiscalYear: 2026, taskId: ids.task, task: r.task.title, source: "Supplies", amount: closed ? 3500 : 10000, available: closed ? 0 : settled ? 6500 : cashReleased ? 6000 : 10000 }],
    };
    case "save_project_definition": {
      const details = payload.p_details as Row;
      Object.assign(r.project, { title: details.title, description: details.description, scope: details.scope, project_lead_id: details.lead, start_date: details.start, target_date: details.end, funding_not_required: details.noFunding });
      return r.project;
    }
    case "phase7_project_readiness": return { projectId: ids.project, stage: r.project.status === "planning" ? "Planning" : "Active", ready: true, canActivate: true, governed: false,
      checks: [{ key: "structure", label: "Project structure reviewed", ok: true, detail: "Project tasks and groups confirmed." }, { key: "dates", label: "Project dates confirmed", ok: true, detail: "Nov 9–27, 2026" }, { key: "budget", label: "Budget information reviewed", ok: true, detail: "₱40,000 reserved for this project." }] };
    case "get_project_completion_readiness": return { projectId: ids.project, title: r.project.title, status: "active", canComplete: true, blockers: [] };
    case "get_office_budget_sections": return { version: 1, sections: [{ id: ids.source, name: "Supplies", amount: 100000, heldAmount: 0, position: 0 }] };
    case "department_budget_summary": return { id: ids.budget, orgId: ids.office, fiscalYear: 2026, status: "locked", approvedAmount: 100000, heldAmount: 0, committedAmount: 40000, spentAmount: 0, availableAmount: 60000, dailyPettyCashReleaseLimit: 20000, perReceiptLimit: 5000, liquidationDueDays: 15, allowReceiptLimitOverride: false, underutilizationThreshold: 80, dailyReleaseRemaining: 20000 };
    case "get_task_funding_context": return { funded: true, supportsItemizedCash: true, fiscalYear: 2026, fundingOrgId: ids.office, taskId: ids.task, taskAllocationId: ids.allocation, taskLeaderId: ids.lead, taskBudget: 10000, available: r.scene === "request-cash" ? 10000 : 6000,
      lines: [{ id: ids.line, expenseClass: "Operating expenses", category: "Supplies", particular: "Registration materials", fundSource: "Project budget", amount: 10000, available: r.scene === "request-cash" ? 10000 : 6000 }] };
    case "get_liquidation_independent_review": return { liquidationId: ids.liquidation, version: 1, required: false, current: false, canReview: false, canSettle: r.role === "accounting_staff", review: null, candidates: [], eligibleSettlers: 1, escalationRequired: false };
    case "r8_list_requests": return { kind: "office", office_id: ids.office, requests: [], can_request: true };
    case "r8_office_people": return [];
    case "r6_list_project_files": return { can_write: false, files: [] };
    case "r7_project_members": return { kind: "office", members };
    case "r7_work_activity": return { events: [], more: false };
    case "r7_work_tree": return { root: { id: ids.task, project: ids.project, office: ids.office, kind: "office", open: true, lead: ids.lead, people: [ids.lead, ids.member], due: "2026-11-19",
      capabilities: { manage_contributors: cap, appoint_lead: cap, create_child: cap, order_children: cap } }, people: members,
      nodes: [{ ...r.subtask, depth: 1, can_manage: true, can_appoint: true, can_order: true, can_work: true, can_review: false,
        capabilities: { manage_contributors: cap, appoint_lead: cap, create_child: cap, order_children: cap, edit_details: cap, execute: cap, submit: cap } }],
      revision: 1, can_manage: true, can_transfer: true, leaf_total: 1, leaf_completed: 0 };
    default: return [];
  }
}

function gateway(r: SampleRecords, path: string): unknown {
  if (path.endsWith("/office-team")) return { office_name: r.office.name, members: r.profiles };
  if (path.includes("onboarding/me")) return { user_id: r.actor, tour_key: r.role + "-v1", tour_version: 1, status: "dismissed", state: {}, current_step: "welcome" };
  if (path.endsWith("/project-invitations/validate")) return { id: ids.identity, email: "lia@example.test", office_name: "Community Training Center", project_title: r.project.title, project_id: ids.project, existing_account: false, engagement: "Other", until_close: true, project_participation_role: "employee" };
  if (path.includes("/invitations")) return { invitations: [] };
  if (path.includes("/professional-profile")) return { profile: null };
  if (path.includes("/pds/")) return { documents: [] };
  if (path.includes("/public/")) return {};
  return { success: true };
}

