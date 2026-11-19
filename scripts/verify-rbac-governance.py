"""Live transactional verification for Slice 1 & 2 RBAC engine + project creation + Accounting countersign.

All checks execute inside rolled-back transactions against ixnfphgjyelhckjwjkdv, leaving zero test data behind.
"""
import json
import socket
import uuid
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
import psycopg2

root = Path(__file__).resolve().parent.parent
uri = dotenv_values(root / ".env")["EFLOW_DATABASE_URL"]
u = urlparse(uri)
assert "ixnfphgjyelhckjwjkdv" in (u.username or ""), "Target must be ixnfphgjyelhckjwjkdv"

conn = psycopg2.connect(
    uri,
    sslmode="require",
    connect_timeout=15,
    hostaddr=socket.getaddrinfo(u.hostname, u.port, socket.AF_INET, socket.SOCK_STREAM)[0][4][0],
)
conn.autocommit = False


def set_actor(cur, uid: str):
    cur.execute(
        "SELECT set_config('request.jwt.claims', %s, true), set_config('request.jwt.claim.sub', %s, true)",
        (json.dumps({"sub": uid, "role": "authenticated"}), uid),
    )


def expect_sql_error(cur, sql_text, params, expected_code):
    cur.execute("SAVEPOINT sp_expect")
    try:
        cur.execute(sql_text, params)
    except psycopg2.Error as exc:
        cur.execute("ROLLBACK TO SAVEPOINT sp_expect")
        assert exc.pgcode == expected_code, f"Expected SQLSTATE {expected_code}, got {exc.pgcode}: {exc.pgerror}"
        return exc.pgerror or ""
    cur.execute("ROLLBACK TO SAVEPOINT sp_expect")
    raise AssertionError(f"Expected SQLSTATE {expected_code} but query succeeded: {sql_text}")


with conn.cursor() as cur:
    # Lookup live actors in LEDIPO + Admin
    cur.execute("SELECT id::text FROM public.organizations WHERE name = 'LEDIPO' AND is_active LIMIT 1")
    org_id = cur.fetchone()[0]
    cur.execute("SELECT id::text FROM public.profiles WHERE role = 'admin' AND is_active LIMIT 1")
    admin_id = cur.fetchone()[0]
    cur.execute("SELECT id::text FROM public.profiles WHERE role = 'head' AND org_id = %s AND is_active LIMIT 1", (org_id,))
    head_id = cur.fetchone()[0]
    cur.execute("SELECT id::text FROM public.profiles WHERE role = 'member' AND org_id = %s AND is_active LIMIT 1", (org_id,))
    member_id = cur.fetchone()[0]
    cur.execute("SELECT id::text FROM public.profiles WHERE role = 'accounting_staff' AND org_id = %s AND is_active LIMIT 1", (org_id,))
    acct_id = cur.fetchone()[0]

    # Pick an active leaf funding section with positive balance for Option 1 funding tests
    cur.execute(
        """
        SELECT s.id::text, s.name, (s.amount - s.held_amount - eflow_budget.partition_committed(s.id)) AS avail
        FROM public.office_budget_sections s
        JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
        WHERE b.org_id = %s AND b.status = 'locked' AND NOT s.retired
          AND NOT EXISTS (SELECT 1 FROM public.office_budget_sections c WHERE c.parent_id = s.id AND NOT c.retired)
          AND (s.amount - s.held_amount - eflow_budget.partition_committed(s.id)) >= 100
        ORDER BY avail DESC
        LIMIT 1
        """,
        (org_id,),
    )
    funding_row = cur.fetchone()
    assert funding_row is not None, "Need at least one locked leaf funding source with >= 100 available"
    partition_id = funding_row[0]

    # ------------------------------------------------------------------
    # TEST 1: Custom role resolution + prerequisite enforcement + Admin RPCs
    # ------------------------------------------------------------------
    cur.execute("SELECT public.has_permission(%s, 'projects.create')", (member_id,))
    assert cur.fetchone()[0] is False, "Plain member should not have projects.create"

    # Assign existing live custom role `bagong_role` to member inside rolled-back tx
    cur.execute("UPDATE public.profiles SET custom_role_key = 'bagong_role' WHERE id = %s", (member_id,))
    cur.execute("SELECT public.has_permission(%s, 'projects.create'), public.can_create_project_in_office(%s, %s)", (member_id, org_id, member_id))
    assert cur.fetchone() == (True, True), "Custom role bagong_role must grant projects.create on backend"

    # Admin RPC blocks contradictory permission state (denying navigation.projects while projects.create stays true)
    set_actor(cur, admin_id)
    expect_sql_error(
        cur,
        "SELECT public.admin_set_role_permissions('bagong_role', %s::jsonb)",
        (json.dumps({"navigation.projects": False}),),
        "22023",
    )
    # Admin RPC blocks granting Admin-only permissions to non-Admin roles
    expect_sql_error(
        cur,
        "SELECT public.admin_set_role_permissions('bagong_role', %s::jsonb)",
        (json.dumps({"users.manage": True}),),
        "42501",
    )
    # Atomic paired disable succeeds (disabling both projects.create and navigation.projects)
    cur.execute("SELECT public.admin_set_role_permissions('bagong_role', %s::jsonb)", (json.dumps({"projects.create": False, "navigation.projects": False}),))
    cur.execute("SELECT public.has_permission(%s, 'projects.create')", (member_id,))
    assert cur.fetchone()[0] is False
    # Re-enable both atomically
    cur.execute("SELECT public.admin_set_role_permissions('bagong_role', %s::jsonb)", (json.dumps({"navigation.projects": True, "projects.create": True}),))
    cur.execute("SELECT public.has_permission(%s, 'projects.create')", (member_id,))
    assert cur.fetchone()[0] is True

    # ------------------------------------------------------------------
    # TEST 2: Delegated non-Head creator creates, sets up & publishes an UNFUNDED project
    # ------------------------------------------------------------------
    set_actor(cur, member_id)
    draft_key = str(uuid.uuid4())
    cur.execute(
        "SELECT id::text, project_lead_id::text, publication_state FROM public.create_project_draft_once(%s::jsonb, %s)",
        (json.dumps({"title": "Delegated Unfunded Pilot", "org_id": org_id, "owner_id": member_id, "status": "planning", "source_type": "manual", "member_ids": []}), draft_key),
    )
    del_proj_id, del_lead_id, del_pub = cur.fetchone()
    assert del_lead_id == member_id and del_pub == "draft", "Creator should become initial project_lead_id on draft"

    cur.execute("SELECT updated_at::text FROM public.projects WHERE id = %s", (del_proj_id,))
    ver = cur.fetchone()[0]
    cur.execute(
        "SELECT id::text FROM public.save_project_definition(%s, %s::jsonb)",
        (del_proj_id, json.dumps({
            "title": "Delegated Unfunded Pilot",
            "description": "Created by delegated member with bagong_role",
            "scope": "LEDIPO pilot scope",
            "lead": member_id,
            "start": "2026-11-20",
            "end": "2026-12-20",
            "noFunding": True,
            "version": ver,
        })),
    )
    cur.execute("SELECT public.finish_project_setup(%s)", (del_proj_id,))

    # Add a task, assign it, confirm readiness reviews, and publish/activate!
    cur.execute("SELECT id::text FROM public.project_groups WHERE project_id = %s LIMIT 1", (del_proj_id,))
    grp_id = cur.fetchone()[0]
    cur.execute("SELECT id::text FROM public.phase3_create_task(%s, %s, 'Draft pilot deliverable')", (del_proj_id, grp_id))
    del_task_id = cur.fetchone()[0]
    cur.execute("SELECT public.r7_work_tree(%s)->>'revision'", (del_task_id,))
    rev = int(cur.fetchone()[0])
    cur.execute(
        "SELECT public.auto_assign_project_task(%s, %s, %s, %s, %s::uuid[])",
        (del_task_id, rev, str(uuid.uuid4()), member_id, [member_id]),
    )
    for kind in ("structure", "dates", "budget"):
        cur.execute("SELECT public.phase7_review_project(%s, %s)", (del_proj_id, kind))
    cur.execute("SELECT public.publish_project(%s)", (del_proj_id,))
    cur.execute("SELECT status, publication_state FROM public.projects WHERE id = %s", (del_proj_id,))
    assert cur.fetchone() == ("active", "published"), "Delegated creator must be able to publish unfunded project"

    # ------------------------------------------------------------------
    # TEST 3: Option 1 Anti-Corruption — Head-created funded project requires Accounting certification
    # ------------------------------------------------------------------
    set_actor(cur, head_id)
    head_proj_key = str(uuid.uuid4())
    cur.execute(
        "SELECT id::text FROM public.create_project_draft_once(%s::jsonb, %s)",
        (json.dumps({"title": "Head Funded Project", "org_id": org_id, "owner_id": head_id, "status": "planning", "source_type": "manual", "member_ids": []}), head_proj_key),
    )
    head_proj_id = cur.fetchone()[0]
    cur.execute("SELECT updated_at::text FROM public.projects WHERE id = %s", (head_proj_id,))
    hver = cur.fetchone()[0]
    cur.execute(
        "SELECT id::text FROM public.save_project_definition(%s, %s::jsonb)",
        (head_proj_id, json.dumps({
            "title": "Head Funded Project",
            "description": "Needs Accounting certification",
            "scope": "LEDIPO funded scope",
            "lead": head_id,
            "start": "2026-11-20",
            "end": "2026-12-20",
            "noFunding": False,
            "version": hver,
        })),
    )

    # Ownership isolation (A2): delegated member CANNOT edit Head's project!
    set_actor(cur, member_id)
    expect_sql_error(cur, "SELECT public.finish_project_setup(%s)", (head_proj_id,), "42501")

    # Head submits funding -> routes to pending_accounting (does NOT commit funds yet!)
    set_actor(cur, head_id)
    fund_req_id = str(uuid.uuid4())
    cur.execute(
        "SELECT public.authorize_project_funding(%s, %s::jsonb, %s, %s)",
        (head_proj_id, json.dumps([{"partitionId": partition_id, "amount": 100}]), "Q4 program materials", fund_req_id),
    )
    fund_res = cur.fetchone()[0]
    assert fund_res["status"] == "pending_accounting" and fund_res["authorized"] == 0 and fund_res["requested"] == 100

    # Head CANNOT finish_setup before Accounting certifies!
    expect_sql_error(cur, "SELECT public.finish_project_setup(%s)", (head_proj_id,), "23514")
    # Head CANNOT self-certify!
    expect_sql_error(cur, "SELECT public.certify_project_funding(%s, true, 'self')", (fund_req_id,), "42501")

    # Accounting Staff sees the pending certification even for a draft project & certifies it!
    set_actor(cur, acct_id)
    cur.execute("SELECT public.list_pending_project_funding_certifications(%s)", (org_id,))
    queue = cur.fetchone()[0]
    matched = [item for item in queue if item["id"] == fund_req_id]
    assert len(matched) == 1 and matched[0]["canCertify"] is True, f"Accounting queue missing request: {queue}"

    cur.execute("SELECT public.certify_project_funding(%s, true, 'Verified balance available')", (fund_req_id,))
    cert_res = cur.fetchone()[0]
    assert cert_res["status"] == "approved" and cert_res["authorized"] == 100

    # Now Head CAN finish setup!
    set_actor(cur, head_id)
    cur.execute("SELECT public.finish_project_setup(%s)", (head_proj_id,))
    cur.execute("SELECT (public.project_flow_snapshot(%s)->>'total')::numeric", (head_proj_id,))
    assert float(cur.fetchone()[0]) == 100.0

    # ------------------------------------------------------------------
    # TEST 4: Delegated non-Head requests funding -> Head endorses -> Accounting certifies
    # ------------------------------------------------------------------
    set_actor(cur, member_id)
    del_funded_key = str(uuid.uuid4())
    cur.execute(
        "SELECT id::text FROM public.create_project_draft_once(%s::jsonb, %s)",
        (json.dumps({"title": "Delegated Funded Project", "org_id": org_id, "owner_id": member_id, "status": "planning", "source_type": "manual", "member_ids": []}), del_funded_key),
    )
    df_id = cur.fetchone()[0]
    cur.execute("SELECT updated_at::text FROM public.projects WHERE id = %s", (df_id,))
    dver = cur.fetchone()[0]
    cur.execute(
        "SELECT id::text FROM public.save_project_definition(%s, %s::jsonb)",
        (df_id, json.dumps({
            "title": "Delegated Funded Project",
            "description": "Delegated funded work",
            "scope": "LEDIPO delegated scope",
            "lead": member_id,
            "start": "2026-11-20",
            "end": "2026-12-20",
            "noFunding": False,
            "version": dver,
        })),
    )
    req2_id = str(uuid.uuid4())
    cur.execute(
        "SELECT public.request_project_funding(%s, %s::jsonb, %s, %s)",
        (df_id, json.dumps([{"partitionId": partition_id, "amount": 50}]), "Supplies for delegated project", req2_id),
    )
    # Accounting cannot certify before Head endorses
    set_actor(cur, acct_id)
    expect_sql_error(cur, "SELECT public.certify_project_funding(%s, true, 'too early')", (req2_id,), "23514")
    # Head endorses -> forwards to pending_accounting
    set_actor(cur, head_id)
    cur.execute("SELECT public.decide_project_funding(%s, true, 'Head endorses')", (req2_id,))
    # Accounting certifies -> funds committed!
    set_actor(cur, acct_id)
    cur.execute("SELECT public.certify_project_funding(%s, true, 'Accounting certifies')", (req2_id,))
    assert cur.fetchone()[0]["authorized"] == 50
    # Delegated creator finishes setup!
    set_actor(cur, member_id)
    cur.execute("SELECT public.finish_project_setup(%s)", (df_id,))

    # Roll back everything cleanly so live DB stays spotless.
    conn.rollback()

conn.close()
print(json.dumps({
    "verified": True,
    "tests": [
        "custom_role_resolution_and_admin_rpc_dependencies",
        "delegated_unfunded_project_create_setup_publish",
        "ownership_isolation_blocks_other_office_projects",
        "head_funded_project_accounting_countersign_anti_corruption",
        "delegated_funded_project_head_endorse_accounting_certify",
    ],
}))
