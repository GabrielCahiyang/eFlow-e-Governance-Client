"""Path, redaction, classification, and archive-security helpers for database exports."""

from __future__ import annotations

from pathlib import Path
import os
import re
import shutil
from typing import Any, Iterable


SAFE_TABLE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SENSITIVE_PUBLIC_TABLES = frozenset({"app_config", "system_config"})
SENSITIVE_COLUMN_NAMES = frozenset(
    {
        "token_hash",
        "acceptance_claim",
        "password_hash",
        "secret",
        "secret_key",
        "api_key",
        "private_key",
    }
)

BACKUP_DOMAINS: tuple[tuple[str, str, str], ...] = (
    (
        "projects_work",
        "Projects & Work",
        "Projects, milestones, tasks, subtasks, templates, files, and work activity",
    ),
    (
        "finance_budget",
        "Budget & Accounting",
        "Fiscal budgets, petty cash requests, liquidations, receipts, and journal entries",
    ),
    (
        "people_offices",
        "Offices, People & Access",
        "Organizations, user profiles, roles, permissions, and office memberships",
    ),
    (
        "proposals_governance",
        "Proposals & Governance",
        "Collaboration drafts, governance records, signoffs, closeouts, and PDF imports",
    ),
    (
        "audit_comms",
        "Audit & Communications",
        "Audit trail events, announcements, notifications, calls, and chat channels",
    ),
    (
        "system_legacy",
        "System & Migration Archives",
        "System configuration tables and historical phase migration snapshots",
    ),
)

_DOMAIN_LABELS = {domain_id: label for domain_id, label, _ in BACKUP_DOMAINS}

IMPORTANT_EFLOW_TABLES: frozenset[str] = frozenset(
    {
        # Projects & Work
        "projects",
        "project_groups",
        "milestones",
        "tasks",
        "subtasks",
        "task_submissions",
        "subtask_submissions",
        "task_progress_updates",
        "subtask_progress_updates",
        "task_activities",
        "task_comments",
        "task_status_history",
        "project_library_files",
        "project_library_links",
        "project_readiness_reviews",
        "project_seal_certificates",
        "workspaces",
        "workspace_members",
        "work_tree_events",
        # Budget & Accounting
        "department_fiscal_budgets",
        "department_budget_lines",
        "department_budget_adjustments",
        "office_budget_sections",
        "budget_commitments",
        "budget_ledger_entries",
        "work_budget_allocations",
        "work_budget_allocation_lines",
        "petty_cash_requests",
        "petty_cash_request_lines",
        "petty_cash_releases",
        "petty_cash_liquidations",
        "petty_cash_receipts",
        "petty_cash_receipt_items",
        "liquidation_independent_reviews",
        "general_journal_entries",
        "general_journal_lines",
        "accounting_accounts",
        "department_accounting_settings",
        "department_budget_account_mappings",
        # Offices, People & Access
        "organizations",
        "organization_memberships",
        "profiles",
        "project_members",
        "project_organizations",
        "project_offices",
        "project_office_identities",
        "project_office_members",
        "custom_roles",
        "role_permissions",
        "user_permission_overrides",
        "user_org_scope_grants",
        "user_invitations",
        "skill_tag_definitions",
        "work_status_definitions",
        # Proposals & Governance
        "proposal_collaboration_drafts",
        "proposal_collaboration_revisions",
        "proposal_collaboration_approvals",
        "proposal_governance_records",
        "proposal_governance_assignments",
        "proposal_governance_signoffs",
        "proposal_delivery_closeouts",
        "project_pdf_import_sessions",
        "project_import_batches",
        # Audit & Communications
        "audit_events",
        "announcements",
        "announcement_recipients",
        "notifications",
    }
)

_EXPLICIT_TABLE_DOMAINS: dict[str, str] = {
    "accounting_accounts": "finance_budget",
    "announcements": "audit_comms",
    "announcement_recipients": "audit_comms",
    "app_config": "system_legacy",
    "audit_events": "audit_comms",
    "budget_commitments": "finance_budget",
    "budget_ledger_entries": "finance_budget",
    "calls": "audit_comms",
    "chat_channel_members": "audit_comms",
    "chat_channels": "audit_comms",
    "chat_messages": "audit_comms",
    "custom_roles": "people_offices",
    "department_accounting_settings": "finance_budget",
    "department_budget_account_mappings": "finance_budget",
    "department_budget_adjustments": "finance_budget",
    "department_budget_lines": "finance_budget",
    "department_fiscal_budgets": "finance_budget",
    "employee_notes": "projects_work",
    "general_journal_entries": "finance_budget",
    "general_journal_lines": "finance_budget",
    "hierarchy_deadline_reminders": "projects_work",
    "liquidation_independent_reviews": "finance_budget",
    "managed_account_invite_details": "people_offices",
    "milestone_organizations": "people_offices",
    "milestones": "projects_work",
    "monthly_productivity_snapshots": "projects_work",
    "notifications": "audit_comms",
    "office_budget_sections": "finance_budget",
    "office_project_homes": "projects_work",
    "organization_memberships": "people_offices",
    "organizations": "people_offices",
    "personal_project_members": "projects_work",
    "personal_project_shortcuts": "projects_work",
    "personal_projects": "projects_work",
    "personal_subtasks": "projects_work",
    "personal_tasks": "projects_work",
    "personal_work_events": "projects_work",
    "petty_cash_liquidations": "finance_budget",
    "petty_cash_receipt_items": "finance_budget",
    "petty_cash_receipts": "finance_budget",
    "petty_cash_releases": "finance_budget",
    "petty_cash_request_attachments": "finance_budget",
    "petty_cash_request_lines": "finance_budget",
    "petty_cash_requests": "finance_budget",
    "profiles": "people_offices",
    "project_access_grants": "people_offices",
    "project_field_history": "projects_work",
    "project_groups": "projects_work",
    "project_guest_account_events": "people_offices",
    "project_guest_accounts": "people_offices",
    "project_guest_members": "people_offices",
    "project_import_batches": "proposals_governance",
    "project_invitation_events": "people_offices",
    "project_invitation_requests": "people_offices",
    "project_library_events": "projects_work",
    "project_library_files": "projects_work",
    "project_library_links": "projects_work",
    "project_members": "people_offices",
    "project_office_identities": "people_offices",
    "project_office_members": "people_offices",
    "project_office_people": "people_offices",
    "project_office_work": "projects_work",
    "project_offices": "people_offices",
    "project_organizations": "people_offices",
    "project_pdf_import_sessions": "proposals_governance",
    "project_readiness_reviews": "projects_work",
    "project_seal_certificates": "projects_work",
    "project_task_templates": "projects_work",
    "projects": "projects_work",
    "proposal_collaboration_approvals": "proposals_governance",
    "proposal_collaboration_change_requests": "proposals_governance",
    "proposal_collaboration_commit_projects": "proposals_governance",
    "proposal_collaboration_drafts": "proposals_governance",
    "proposal_collaboration_messages": "proposals_governance",
    "proposal_collaboration_orgs": "proposals_governance",
    "proposal_collaboration_revisions": "proposals_governance",
    "proposal_delivery_closeout_decisions": "proposals_governance",
    "proposal_delivery_closeouts": "proposals_governance",
    "proposal_governance_assignments": "proposals_governance",
    "proposal_governance_records": "proposals_governance",
    "proposal_governance_signoffs": "proposals_governance",
    "role_permissions": "people_offices",
    "server_logs": "audit_comms",
    "skill_tag_definitions": "people_offices",
    "subtask_progress_updates": "projects_work",
    "subtask_submission_attachments": "projects_work",
    "subtask_submissions": "projects_work",
    "subtask_template_items": "projects_work",
    "subtask_templates": "projects_work",
    "subtasks": "projects_work",
    "system_config": "system_legacy",
    "task_activities": "projects_work",
    "task_attachments": "projects_work",
    "task_comment_attachments": "projects_work",
    "task_comments": "projects_work",
    "task_organizations": "people_offices",
    "task_progress_updates": "projects_work",
    "task_reminders": "projects_work",
    "task_status_history": "projects_work",
    "task_submissions": "projects_work",
    "task_template_runs": "projects_work",
    "task_templates": "projects_work",
    "tasks": "projects_work",
    "user_invitations": "people_offices",
    "user_onboarding": "people_offices",
    "user_org_scope_grants": "people_offices",
    "user_pds_documents": "people_offices",
    "user_permission_overrides": "people_offices",
    "user_preferences": "people_offices",
    "user_professional_profiles": "people_offices",
    "work_budget_allocation_lines": "finance_budget",
    "work_budget_allocations": "finance_budget",
    "work_status_definitions": "people_offices",
    "work_tree_events": "projects_work",
    "workspace_members": "projects_work",
    "workspaces": "projects_work",
}


def resolve_table_domain(table_name: str) -> str:
    """Return the logical eFlow domain ID for a discovered public table."""
    if table_name in _EXPLICIT_TABLE_DOMAINS:
        return _EXPLICIT_TABLE_DOMAINS[table_name]
    if table_name in SENSITIVE_PUBLIC_TABLES or table_name.endswith("_backup") or "rollback" in table_name:
        return "system_legacy"
    if table_name.startswith(("petty_cash_", "budget_", "department_budget", "department_fiscal", "general_journal", "accounting_", "work_budget", "liquidation_")):
        return "finance_budget"
    if table_name.startswith("proposal_"):
        return "proposals_governance"
    if table_name.startswith(("task_", "subtask_", "project_", "personal_", "milestone", "workspace")):
        return "projects_work"
    if table_name.startswith(("user_", "organization", "profile", "role_")):
        return "people_offices"
    if table_name.startswith(("audit_", "chat_", "notification", "announcement")):
        return "audit_comms"
    return "system_legacy"


def classify_table(table_name: str) -> dict[str, Any]:
    """Classify a public table by domain, importance, and sensitivity."""
    domain = resolve_table_domain(table_name)
    return {
        "name": table_name,
        "domain": domain,
        "domain_label": _DOMAIN_LABELS.get(domain, "System & Migration Archives"),
        "important": table_name in IMPORTANT_EFLOW_TABLES,
        "sensitive": table_name in SENSITIVE_PUBLIC_TABLES,
    }


def redact_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mask sensitive credential/token fields before returning operational row previews or exports."""
    redacted: dict[str, Any] = {}
    for key, value in row.items():
        lowered = key.lower()
        if (
            lowered in SENSITIVE_COLUMN_NAMES
            or lowered.endswith("_secret")
            or lowered.endswith("_token_hash")
        ) and value is not None:
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = value
    return redacted


def find_windows_pg_dump(program_roots: Iterable[Path] | None = None) -> str | None:
    """Find PostgreSQL tools installed by PostgreSQL or pgAdmin on Windows."""
    if program_roots is None:
        roots = {
            Path(value)
            for value in (
                os.getenv("ProgramFiles", ""),
                os.getenv("ProgramFiles(x86)", ""),
            )
            if value
        }
    else:
        roots = {Path(root) for root in program_roots}

    candidates: list[Path] = []
    for root in roots:
        candidates.extend(root.glob("PostgreSQL/*/bin/pg_dump.exe"))
        candidates.append(root / "PostgreSQL" / "pgAdmin 4" / "runtime" / "pg_dump.exe")
    available = [candidate for candidate in candidates if candidate.is_file()]
    if not available:
        return None
    return str(sorted(available, key=lambda path: path.as_posix(), reverse=True)[0])


def resolve_pg_dump(executable: str) -> str | None:
    candidate = Path(executable)
    if candidate.is_absolute():
        return str(candidate) if candidate.is_file() else None
    discovered = shutil.which(executable)
    if discovered:
        return discovered
    if os.name == "nt" and executable.lower() in {"pg_dump", "pg_dump.exe"}:
        return find_windows_pg_dump()
    return None


def validate_table_name(table_name: str) -> str:
    if not SAFE_TABLE_NAME.fullmatch(table_name):
        raise ValueError(f"Unsafe public table name: {table_name!r}")
    return table_name


def ensure_within(root: Path, target: Path) -> Path:
    resolved_root = root.resolve()
    resolved_target = target.resolve()
    if resolved_target != resolved_root and resolved_root not in resolved_target.parents:
        raise ValueError("Backup path escaped the configured backup directory")
    return resolved_target


def remove_backup_path(root: Path, target: Path) -> None:
    resolved = ensure_within(root, target)
    if resolved.is_dir():
        shutil.rmtree(resolved, ignore_errors=True)
    elif resolved.exists():
        resolved.unlink(missing_ok=True)
