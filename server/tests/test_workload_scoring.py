"""Unit tests for unified AI workload & overload scoring."""

from datetime import datetime
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.workload_scoring import (
    DEFAULT_WORKLOAD_THRESHOLDS,
    MANILA,
    add_business_days,
    compute_member_workload,
)

import supabase  # pre-import once so PyO3 cryptography stays initialized across unittest modules

config = ModuleType("gateway_config")
config.settings = SimpleNamespace(
    supabase_url="https://example.test",
    supabase_service_role_key="test-only",
    internal_ai_base_url="http://localhost/test",
    ai_timeout_seconds=30,
)
with patch.dict(sys.modules, {"gateway_config": config}), patch.object(
    supabase, "create_client", return_value=MagicMock()
):
    collab = importlib.import_module("services.collaboration_ai")


class WorkloadScoringTests(unittest.TestCase):
    def test_add_business_days_skips_weekend(self):
        # 2026-11-20 is Friday -> +1 biz day is Monday 2026-11-23
        fri = datetime(2026, 11, 20, 9, 0, tzinfo=MANILA).date()
        self.assertEqual(add_business_days(fri, 1).isoformat(), "2026-11-23")
        self.assertEqual(add_business_days(fri, 3).isoformat(), "2026-11-25")

    def test_projects_tasks_subtasks_overdue_and_for_review_exclusion(self):
        now = datetime(2026, 11, 22, 10, 0, tzinfo=MANILA)
        projects = [
            {"id": "p1", "project_lead_id": "u1", "status": "active"},  # 3.0
            {"id": "p2", "project_lead_id": "u1", "status": "planning"},  # 1.5
            {"id": "p3", "project_lead_id": "u1", "status": "completed"},  # ignored
        ]
        tasks = [
            {"id": "t1", "assigned_to": "u1", "status": "in_progress", "due_date": "2026-11-20"},  # 2.0 + 1.5 overdue
            {"id": "t2", "assigned_to": "u1", "status": "todo", "due_date": "2026-11-24"},  # 2.0 + 0.5 due soon
            {"id": "t3", "assigned_to": "u1", "status": "for_review", "due_date": "2026-11-18"},  # 2.0 (NOT overdue!)
            {"id": "t4", "assigned_to": "u2", "linked_project_id": "p1", "status": "for_review"},  # +0.5 pending review for u1
        ]
        subtasks = [
            {"id": "s1", "lead_id": "u1", "status": "in_progress", "due_date": "2026-12-10"},  # 1.0
        ]
        out = compute_member_workload(
            "u1",
            tasks=tasks,
            projects=projects,
            subtasks=subtasks,
            thresholds=DEFAULT_WORKLOAD_THRESHOLDS,
            now_manila=now,
        )
        # 3.0 + 1.5 + 2.0*3 + 1.0 + 0.5 (review) + 1.5 (overdue) + 0.5 (due soon) = 14.0
        self.assertEqual(out["loadPoints"], 14.0)
        self.assertEqual(out["overdueCount"], 1)
        self.assertEqual(out["dueSoonCount"], 1)
        self.assertEqual(out["pendingReviewsCount"], 1)
        self.assertEqual(out["workloadTier"], "overloaded")
        self.assertTrue(out["isOverloaded"])

    def test_planned_pdf_batch_assignments_accumulate_and_tip_overload(self):
        now = datetime(2026, 11, 22, 10, 0, tzinfo=MANILA)
        out = compute_member_workload(
            "u2",
            tasks=[{"id": "t1", "assigned_to": "u2", "status": "todo"}],  # 2.0
            planned_task_leads=5,  # +10.0 => 12.0 & 6 task leads >= 5 cap
            now_manila=now,
        )
        self.assertEqual(out["loadPoints"], 12.0)
        self.assertEqual(out["tasksLed"], 6)
        self.assertTrue(out["isOverloaded"])

    def test_collaboration_deterministic_ranking_prefers_non_overloaded(self):
        tasks = [{"key": "k1", "requiredSkills": ["engineering"]}]
        candidates = [
            {
                "employee_id": "heavy-1",
                "name": "Overloaded Lead",
                "organization_id": "org-1",
                "skills": ["engineering"],
                "tags": [],
                "workload": 30,
                "load_points": 15.0,
                "workload_tier": "overloaded",
                "is_overloaded": True,
            },
            {
                "employee_id": "light-1",
                "name": "Balanced Engineer",
                "organization_id": "org-1",
                "skills": ["engineering"],
                "tags": [],
                "workload": 20,
                "load_points": 3.0,
                "workload_tier": "balanced",
                "is_overloaded": False,
            },
        ]
        recs = collab._deterministic_recommendations(tasks, candidates)
        self.assertEqual(recs[0]["employeeId"], "light-1")
        self.assertEqual(recs[0]["recommendedRole"], "lead")


if __name__ == "__main__":
    unittest.main()
