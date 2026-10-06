import DOMPurify from "dompurify";
import type { Task } from '../../tasks';
import { InitialsAvatar } from '../../../components/workflow/StatusBadges';
import { formatDate } from '../../../components/workflow/primitives';
export function InspectorEvidence({ task }: { task: Task }) { return <section aria-label="Task evidence">              {task.latestSubmission && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <InitialsAvatar name={task.latestSubmission.submitterName} size={20} />
                    <span className="text-[12px] font-medium text-neutral-900">
                      {task.latestSubmission.submitterName}
                    </span>
                    <span className="text-[10.5px] text-neutral-400">submitted {formatDate(task.latestSubmission.submittedAt)}</span>
                  </div>
                  <div
                    className="text-[12px] font-normal text-neutral-600 whitespace-pre-wrap [&_p]:m-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:p-1.5 [&_ul]:pl-4 [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(task.latestSubmission.note),
                    }}
                  />
                </div>
              )}{!task.latestSubmission && <p className="text-sm text-neutral-500">No submission evidence yet.</p>}</section>; }
