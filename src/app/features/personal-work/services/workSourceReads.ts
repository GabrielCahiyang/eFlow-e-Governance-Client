import { supabase } from "../../../../lib/supabase";
import { isNetworkError, readableUiError } from "../../../shared/userFacingError";
const PAGE = 500;

export function isTransientWorkSourceError(reason: unknown): boolean {
  if (isNetworkError(reason)) return true;
  if (!reason || typeof reason !== "object") return false;
  const record = reason as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(record.code || "");
  const status = Number(record.status || 0);
  const text = reason instanceof Error ? reason.message : String(record.message || "");
  return (
    code === "57014" ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /canceling statement due to statement timeout|statement timeout|upstream request timeout|request timeout|gateway timeout|timed out|connection reset|connection refused/i.test(text)
  );
}

/** Retry transient timeouts/network glitches silently before letting a work source defer. */
export async function retryTransientWorkRead<T>(
  run: () => Promise<T>,
  delaysMs: readonly number[] = [350, 900],
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (reason) {
      if (attempt >= delaysMs.length || !isTransientWorkSourceError(reason)) {
        throw reason;
      }
      const delay = delaysMs[attempt++];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Stable ID order and explicit coverage failure, rather than silently keeping the REST row ceiling. */
export async function readWorkTable(table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 40; page++) {
    let query = supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true });
    if (table === "tasks") query = query.is("deleted_at", null);
    const { data, error, status } = await query.range(
      page * PAGE,
      (page + 1) * PAGE - 1,
    );
    if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
    if (!Array.isArray(data)) throw new Error(`Invalid ${table} response`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
  throw new Error(
    `${table} exceeds 20,000 rows. This summary is unavailable; open its source workspace.`,
  );
}
export async function settledMap<T, R>(
  items: T[],
  run: (item: T) => Promise<R>,
) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        try {
          results[current] = {
            status: "fulfilled",
            value: await run(items[current]),
          };
        } catch (reason) {
          results[current] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}
export const message = (error: unknown) =>
  readableUiError(error, "Could not load this work source right now.", "read");
