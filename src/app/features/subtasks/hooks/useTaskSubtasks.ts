import { useEffect, useState, type SetStateAction } from "react";
import { getCachedSubtasks, subscribeToSubtasks, type Subtask } from "../../../services/subtaskService";

export function useTaskSubtasks(taskId?: string | null, actorId?:string|null) {
  const identity=JSON.stringify([taskId,actorId]);
  const cached=()=>taskId&&typeof getCachedSubtasks==='function'?getCachedSubtasks(taskId)||[]:[];
  const [state,setState]=useState(()=>({identity,rows:cached()}));
  // Hide the preceding actor/task in the switching render, before effects.
  const subtasks=state.identity===identity?state.rows:[];
  const setSubtasks=(next:SetStateAction<Subtask[]>)=>setState(previous=>({identity,rows:typeof next==='function'?next(previous.identity===identity?previous.rows:[]):next}));

  useEffect(() => {
    if (!taskId) {
      setSubtasks([]);
      return;
    }
    const cached = typeof getCachedSubtasks === "function" ? getCachedSubtasks(taskId) : undefined;
    setSubtasks(cached || []);
    let active = true;
    const unsubscribe = subscribeToSubtasks(taskId, rows => { if (active) setSubtasks(rows); });
    return () => { active = false; unsubscribe(); };
  }, [taskId,actorId]);

  return { subtasks: subtasks.filter(row => row.taskId === taskId), setSubtasks };
}
