import unittest
import sys
from pathlib import Path
from datetime import datetime
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.deadline_workload import deadline_workload_signal, MANILA


class DeadlineWorkloadTests(unittest.TestCase):
    def test_active_and_overdue_facts_without_duration(self):
        now = datetime(2026, 9, 28, 8, tzinfo=MANILA)
        task = {"assigned_to": "a", "status": "todo", "deadline": "2026-10-02"}
        self.assertEqual(deadline_workload_signal([task], "a", now), 55)
        self.assertEqual(deadline_workload_signal([{**task, "deadline": "2026-09-27"}], "a", now), 100)
        self.assertEqual(deadline_workload_signal([{**task, "deadline": ""}], "a", now), 55)

    def test_supporting_members_and_inactive_work(self):
        now = datetime(2026, 9, 28, 8, tzinfo=MANILA)
        task = {"assigned_to": "a", "team_member_ids": ["a", "b"], "status": "todo", "deadline": "2026-10-02"}
        self.assertEqual(deadline_workload_signal([task], "b", now), 55)
        for status in ["completed", "cancelled", "for_review"]:
            self.assertEqual(deadline_workload_signal([{**task, "status": status}], "a", now), 0)
        self.assertEqual(deadline_workload_signal([task], "unrelated", now), 0)
