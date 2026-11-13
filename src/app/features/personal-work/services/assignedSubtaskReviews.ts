import { supabase } from '../../../../lib/supabase';
import { readAllRows } from '../../../shared/readAllRows';

export interface AssignedSubtaskReview {
  id: string;
  root_id: string;
  node_id: string;
  task_title: string;
  subtask_title: string;
  kind: 'completion' | 'progress';
  submitted_at: string;
  cash_blocked: boolean;
}

export function fetchAssignedSubtaskReviews() {
  return readAllRows<AssignedSubtaskReview>((from, to) => supabase
    .rpc('m7_assigned_subtask_reviews', {}, { count: 'exact' })
    .order('submitted_at').order('id').range(from, to));
}
