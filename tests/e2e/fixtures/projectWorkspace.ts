import { expect, type Page, type WebSocketRoute } from "@playwright/test";

// Synthetic browser records; every backend request is intercepted.
export async function projectWorkspaceFixture(
  page: Page,
  role: "head" | "member" | "admin" | "accounting_staff",
  phase4 = false,
  options: {
    taskChanges?: boolean;
    actorId?: string;
    landingOnly?: boolean;
    leading?: boolean;
    unassigned?: boolean;
    overrides?: Record<string, boolean>;
    shared?: boolean;
    empty?: boolean;
    compactLayout?: boolean;
    theme?: 'light' | 'dark';
  } = {},
) {
  const id = options.actorId || "00000000-0000-4000-8000-000000000001",
    org = "10000000-0000-4000-8000-000000000001";
  const project = "20000000-0000-4000-8000-000000000001",
    group = "30000000-0000-4000-8000-000000000001",
    now = new Date().toISOString();
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "workspace@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: now,
  };
  const profile = {
    id,
    full_name: "Alex Rivera",
    email: user.email,
    role,
    org_id: options.unassigned ? null : org,
    is_active: true,
    employee_id: "TEST",
    skills: {},
    created_at: now,
    updated_at: now,
  };
  const office = {
    id: org,
    name: "Planning Office",
    slug: "planning_office",
    path: "planning_office",
    org_type: "department",
    is_active: true,
    head_user_id: role === "head" ? id : null,
  };
  const profiles: Record<string, unknown>[] = [profile],
    organizations: Record<string, unknown>[] = [office];
  const projectOffices: Record<string, unknown>[] = [],
    officeMembers: Record<string, unknown>[] = [];
  const projects: Record<string, unknown>[] = [
    {
      id: project,
      title: "Community outreach",
      org_id: org,
      owner_id: id,
      created_by: id,
      status: "planning",
      priority: "medium",
      created_at: now,
      updated_at: now,
    },
  ];
  const groups: Record<string, unknown>[] = [
    {
      id: group,
      project_id: project,
      title: "To do",
      color: "#579bfc",
      position: 0,
      is_default: true,
      created_at: now,
    },
  ];
  const tasks: Record<string, unknown>[] = [
    "Prepare community assessment",
    "Coordinate Office briefing",
    "Confirm participants",
  ].map((title, i) => ({
    id: "40000000-0000-4000-8000-00000000000" + (i + 1),
    title,
    org_id: org,
    linked_project_id: project,
    project_id: project,
    group_id: group,
    workspace_position: i,
    status: ["in_progress", "todo", "completed"][i],
    assigned_to: id,
    team_member_ids: [id],
    priority: ["high", "medium", "low"][i],
    estimated_hours: [8, 4, 2][i],
    budget_impact: [1200, 300, 0][i],
    deadline: "2026-10-" + [9, 12, 5][i].toString().padStart(2, "0"),
    percent_complete: [40, 0, 100][i],
    created_at: now,
    updated_at: now,
    created_by: id,
  }));
  if (options.leading === false)
    tasks.forEach((task) => {
      task.assigned_to = "00000000-0000-4000-8000-000000000099";
    });
  if (options.shared) {
    const partner = "10000000-0000-4000-8000-000000000002";
    Object.assign(projects[0], { org_id: partner });
    organizations.push({ ...office, id: partner, name: "Partner Office" });
    projectOffices.push({
      id: "60000000-0000-4000-8000-000000000001",
      project_id: project,
      office_id: org,
      relationship_type: "observer",
      invitation_status: "joined",
      status: "active",
      is_active: true,
      created_at: now,
    });
  }
  if (phase4) {
    Object.assign(projects[0], {
      start_date: "2026-10-01",
      target_date: "2026-10-20",
    });
    tasks.forEach((task, i) =>
      Object.assign(task, {
        start_date: ["2026-10-03", "2026-10-10", "2026-10-01"][i],
        dependency_ids: i === 1 ? [tasks[0].id] : [],
      }),
    );
    tasks.push({
      ...tasks[2],
      id: "40000000-0000-4000-8000-000000000004",
      title: "Cancelled duplicate",
      status: "cancelled",
    });
  }
  if (options.empty) {
    projects.length = 0;
    tasks.length = 0;
    groups.length = 0;
  }
  const subtasks: Record<string, unknown>[] = [
    {
      id: "50000000-0000-4000-8000-000000000001",
      task_id: tasks[0]?.id || "40000000-0000-4000-8000-000000000001",
      title: "Gather supporting evidence",
      status: "todo",
      percent_complete: 0,
      source: "manual",
      position: 0,
      created_by: id,
      created_at: now,
      updated_at: now,
    },
  ];
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    Buffer.from("synthetic-signature").toString("base64url"),
  ].join(".");
  await page.addInitScript(
    ({ id, role }) =>
      localStorage.setItem(
        `eflow:guided-tour:2026.08-v1:${id}:${role}`,
        JSON.stringify({
          welcomed: true,
          systemCompleted: false,
          completedPages: [],
          voiceEnabled: false,
        }),
      ),
    { id, role },
  );
  // Existing-user scenarios retain their explicit all-visible layout. R5 also tests absent preferences.
  await page.addInitScript(({ project, compact }) => {
    const key = 'eflow_project_columns_' + project;
    if (!compact && localStorage.getItem(key) === null) localStorage.setItem(key, '[]');
  }, { project, compact: !!options.compactLayout });
  const taskSockets = new Map<WebSocketRoute, Map<string, number[]>>();
  await page.routeWebSocket(/\/realtime\/v1\//, (socket) => {
    if (!options.taskChanges) return;
    const topics = new Map<string, number[]>();
    taskSockets.set(socket, topics);
    socket.onMessage((raw) => {
      if (typeof raw !== "string") return;
      const decoded = JSON.parse(raw);
      const message = Array.isArray(decoded)
        ? {
            join_ref: decoded[0],
            ref: decoded[1],
            topic: decoded[2],
            event: decoded[3],
            payload: decoded[4],
          }
        : decoded;
      if (message.event !== "phx_join" && message.event !== "heartbeat") return;
      const changes = (message.payload?.config?.postgres_changes || []).map(
        (binding: any, index: number) => ({ ...binding, id: index + 1 }),
      );
      topics.set(
        message.topic,
        changes
          .filter((binding: any) => binding.table === "tasks")
          .map((binding: any) => binding.id),
      );
      socket.send(
        JSON.stringify([
          message.join_ref,
          message.ref,
          message.topic,
          "phx_reply",
          { status: "ok", response: { postgres_changes: changes } },
        ]),
      );
    });
  });
  const emitTaskDelete = (taskId: string) => {
    for (const [socket, topics] of taskSockets)
      for (const [topic, ids] of topics)
        if (ids.length)
          socket.send(
            JSON.stringify([
              null,
              null,
              topic,
              "postgres_changes",
              {
                ids,
                data: {
                  schema: "public",
                  table: "tasks",
                  type: "DELETE",
                  commit_timestamp: new Date().toISOString(),
                  columns: [{ name: "id", type: "uuid" }],
                  record: {},
                  old_record: { id: taskId },
                  errors: null,
                },
              },
            ]),
          );
  };
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/token")
        ? {
            access_token: token,
            refresh_token: "synthetic",
            token_type: "bearer",
            expires_in: 3600,
            user,
          }
        : user,
    }),
  );
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      table = url.pathname.split("/").at(-1),
      single = req.headers().accept?.includes("vnd.pgrst.object");
    let body: unknown = [];
    const payload = req.postData() ? req.postDataJSON() : {};
    if(table?.startsWith('r9_'))return route.fulfill({status:404,json:{code:'PGRST202',message:'R9 migration not installed in this legacy fixture'}});
    if(table?.startsWith('r8_'))return route.fulfill({status:404,json:{code:'PGRST202',message:'R8 migration not installed in this legacy fixture'}});
    if(table?.startsWith('r7_'))return route.fulfill({status:404,json:{code:'PGRST202',message:'R7 migration not installed in this legacy fixture'}});
    if (table === 'r6_list_project_files') body = {can_write:role!=='admin'&&!options.shared&&!['completed','archived'].includes(String(projects[0]?.status)),files:[]};
    if (table === 'r3_list_workspaces') body = options.unassigned ? [] : organizations.map(o=>({id:o.id,name:o.name,kind:'office',office_id:o.id,owner_id:null,state:'active',timezone:'Asia/Singapore'}));
    if (table === 'r3_select_workspace') body = {workspace:{id:payload.p_workspace,name:organizations.find(o=>o.id===payload.p_workspace)?.name || office.name,kind:'office',office_id:payload.p_workspace,owner_id:null,state:'active',timezone:'Asia/Singapore'},projects:projects.map(p=>({...p,kind:'office',home_workspace_id:p.org_id}))};
    if (table === "profiles") body = single ? profile : profiles;
    if (table === "organizations") body = single ? office : organizations;
    if (table === "project_offices") body = projectOffices;
    if (table === "project_office_members") body = officeMembers;
    if (table === "phase7_project_readiness")
      body = {
        projectId: project,
        stage: "Planning",
        governed: false,
        ready: false,
        canActivate: false,
        checks: [
          {
            key: "structure",
            label: "Project structure",
            ok: false,
            detail: "Review the plan.",
          },
          {
            key: "office_identity",
            label: "Office identity",
            ok: true,
            detail: "Planning Office.",
          },
          {
            key: "dates",
            label: "Schedule",
            ok: false,
            detail: "Review dates.",
          },
        ],
      };
    if (table === "organization_approver_ids")
      body = role === "head" ? [id] : [];
    if (table === "user_preferences")
      body = { user_id: id, theme: options.theme || "light", created_at: now, updated_at: now };
    if (table === "user_permission_overrides")
      body = Object.entries(options.overrides || {}).map(
        ([permission, allowed]) => ({ user_id: id, permission, allowed }),
      );
    if(table==="department_budget_summary")body=null;
    if (table === "projects") body = single ? projects[0] : projects;
    if (table === "tasks") body = tasks;
    if (table === "subtasks") {
      if (req.method() === "POST") {
        const row = {
          ...payload,
          id: crypto.randomUUID(),
          status: "todo",
          percent_complete: 0,
          created_at: now,
          updated_at: now,
        };
        subtasks.push(row);
        body = single ? row : [row];
      } else body = subtasks;
    }
    if (table === "project_groups") {
      if (req.method() === "POST") {
        const row = {
          ...payload,
          id: crypto.randomUUID(),
          is_default: false,
          created_at: now,
        };
        groups.push(row);
        body = single ? row : [row];
      } else
        body = groups.filter(
          (g) =>
            !url.searchParams.has("project_id") ||
            url.searchParams.get("project_id") === "eq." + g.project_id,
        );
    }
    if (table === "phase3_patch_task") {
      const row = tasks.find((t) => t.id === payload.p_task_id)!;
      Object.assign(row, payload.p_patch);
      body = row;
    }
    if (table === "transition_task_status") {
      const row = tasks.find((t) => t.id === payload.p_task_id)!;
      Object.assign(row, { status: payload.p_to_status });
      body = null;
    }
    if (table === "phase3_create_task") {
      const row = {
        id: crypto.randomUUID(),
        title: payload.p_title,
        org_id: org,
        linked_project_id: payload.p_project_id,
        project_id: payload.p_project_id,
        group_id: payload.p_group_id,
        status: "pending_assignment",
        priority: "medium",
        created_by: id,
        workspace_position: tasks.length,
        created_at: now,
        updated_at: now,
      };
      tasks.push(row);
      body = row;
    }
    if (table === "create_project_with_details") {
      const row = {
        ...payload.p_payload,
        id: crypto.randomUUID(),
        created_by: id,
        created_at: now,
        updated_at: now,
      };
      projects.push(row);
      groups.push({
        id: crypto.randomUUID(),
        project_id: row.id,
        title: "To do",
        color: "#087f8c",
        position: 0,
        is_default: true,
        created_at: now,
      });
      body = row;
    }
    const full=Array.isArray(body)?body:undefined;
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||full?.length||0);
    if(full&&req.method()==='GET')body=full.slice(offset,offset+limit);
    await route.fulfill({json:body,headers:full?{"access-control-expose-headers":"content-range","content-range":`${offset}-${Math.max(offset,offset+(body as unknown[]).length-1)}/${full.length}`}:{}});
  });
  await page.route(/\/controlpanelEflow\//, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/office-team")
      ? { office_name: "Planning Office", members: profiles }
      : path.endsWith("/invitations")
        ? { invitations: [] }
        : path.endsWith("/admin/backups")
          ? {
              jobs: [],
              preflight: {
                configured: false,
                database_url_configured: false,
                pg_dump_available: false,
                encryption_available: false,
                retention_hours: 24,
                tables: [],
                table_count: 0,
                safe_excluded_data_tables: [],
              },
            }
          : path.includes("/onboarding/me")
            ? {
                user_id: id,
                tour_key: role + "-v1",
                tour_version: 1,
                status: "dismissed",
                state: {},
                current_step: "welcome",
              }
            : { success: true };
    return route.fulfill({ json: body });
  });
  await page.route('**/controlpanelEflow/api/auth/login', route => route.fulfill({json:{access_token:token,refresh_token:'synthetic'}}));
  await page.goto("/");
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill("synthetic-password");
  await page.locator("#login-submit").click();
  await expect(page.locator(".eflow-app-shell")).toBeVisible({
    timeout: 30_000,
  });
  const later = page.getByRole("button", { name: "Maybe later", exact: true });
  await later
    .waitFor({ timeout: 2000 })
    .then(() => later.click())
    .catch(() => {});
  const sidebar = page.locator(".eflow-productivity-sidebar").first();
  if (options.landingOnly)
    return {
      emitTaskDelete,
      tasks,
      projects,
      groups,
      subtasks,
      id,
      org,
      project,
      profiles,
      organizations,
      projectOffices,
      officeMembers,
      profile,
    };
  if (role === "admin") {
    for (let i = 0; i < 40; i++)
      profiles.push({
        ...profile,
        id: "00000000-0000-4000-8000-" + String(i + 2).padStart(12, "0"),
        role: "member",
        full_name: `Directory colleague ${i + 1}`,
        email: `colleague${i + 1}@example.test`,
      });
    await page.goto("/users?page=All%20Users");
    await expect(
      page.getByText("Account directory", { exact: true }),
    ).toBeVisible();
    return {
      emitTaskDelete,
      tasks,
      projects,
      groups,
      subtasks,
      id,
      org,
      project,
      profiles,
      organizations,
      projectOffices,
      officeMembers,
      profile,
    };
  }
  if ((page.viewportSize()?.width || 1280) >= 1024) {
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    await sidebar
      .getByRole("button", { name: "Workspaces", exact: true })
      .press("Enter");
  } else
    await page
      .getByRole("navigation", { name: "Mobile primary navigation" })
      .getByRole("button", { name: "Projects", exact: true })
      .click();
  await expect(
    page.getByRole("region", { name: "Project main table" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", {
      name: "Edit task Prepare community assessment",
    }),
  ).toBeVisible();
  return {
    emitTaskDelete,
    tasks,
    projects,
    groups,
    subtasks,
    id,
    org,
    project,
    profiles,
    organizations,
    projectOffices,
    officeMembers,
    profile,
  };
}
