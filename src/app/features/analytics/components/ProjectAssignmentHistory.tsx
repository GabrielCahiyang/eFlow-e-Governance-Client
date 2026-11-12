import { useEffect, useState } from "react";
import { fetchWorkEvents, presentWorkEvent, type WorkEvent } from "../../nested-work";

const dateTime = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function ProjectAssignmentHistory({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [pages, setPages] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ events: WorkEvent[]; more: boolean; pages: number }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (result?.pages === pages) return;
    let current = true;
    const cursor = result?.events[result.events.length - 1];
    setError(false);
    fetchWorkEvents([taskId], cursor && { time: cursor.occurred_at, id: cursor.id })
      .then(next => {
        if (current) setResult({ events: [...(result?.events ?? []), ...next.events], more: next.more, pages });
      })
      .catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [taskId, pages, retry, result]);

  const transfers = result?.events.filter(event => event.command === "root_lead" && [event.before_data, event.after_data]
    .every(snapshot => snapshot?.root?.id === taskId && snapshot.root.project === projectId)) ?? [];
  return (
    <div className="ea-assignment-history">
      {!!transfers.length && <ul>{transfers.map(event => (
        <li key={event.id}>
          {presentWorkEvent(event).entries.find(entry => entry.startsWith("Lead: ")) || "Task lead transferred"}
          <small>{dateTime.format(new Date(event.occurred_at))} · {event.actor_name}</small>
        </li>
      ))}</ul>}
      {!error && result?.pages !== pages && <small role="status">Loading assignment history…</small>}
      {!error && result?.pages === pages && !transfers.length && <small>No lead transfers found{result.more ? " in these records" : ""}.</small>}
      {error && <small role="alert">Assignment history is unavailable. <button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button></small>}
      {!error && result?.more && result.pages === pages && <button type="button" onClick={() => setPages(n => n + 1)}>Show older activity</button>}
    </div>
  );
}
