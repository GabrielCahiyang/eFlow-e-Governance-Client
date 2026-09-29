import unittest
import sys
from pathlib import Path
from datetime import datetime
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.deadline_workload import deadline_workload_signal, working_hours, MANILA


class DeadlineWorkloadTests(unittest.TestCase):
    def test_urgent_tasks_score_higher_than_three_tasks_due_in_a_week(self):
        now = datetime(2026, 9, 28, 8, tzinfo=MANILA)
        task = lambda due: {"assigned_to": "a", "status": "todo", "estimated_hours": 8, "deadline": due}
        week = [task("2026-10-02") for _ in range(3)]
        urgent = [task("2026-09-28T18:00:00+08:00"), task("2026-09-29T08:00:00+08:00")]
        self.assertEqual(deadline_workload_signal(week, "a", now), 62)
        self.assertEqual(deadline_workload_signal(urgent, "a", now), 100)

    def test_unknown_details_and_shared_remaining_effort(self):
        now = datetime(2026, 9, 28, 8, tzinfo=MANILA)
        task = {"assigned_to": "a", "team_member_ids": ["a", "b"], "status": "todo", "estimated_hours": 16, "percent_complete": 50, "deadline": "2026-10-02"}
        self.assertEqual(deadline_workload_signal([task], "a", now), 11)
        self.assertEqual(deadline_workload_signal([{**task, "estimated_hours": 0}], "a", now), 55)
        self.assertEqual(deadline_workload_signal([{**task, "status": "for_review"}], "a", now), 0)
        self.assertEqual(deadline_workload_signal([task], "unrelated", now), 0)
        self.assertEqual(working_hours(datetime(2026, 10, 2, 8, tzinfo=MANILA), datetime(2026, 10, 5, 17, tzinfo=MANILA)), 16)
