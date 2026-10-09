import { supabase } from "../../../../lib/supabase";
const PAGE = 500;
/** Stable ID order and explicit coverage failure, rather than silently keeping the REST row ceiling. */
export async function readWorkTable(table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 40; page++) {
    let query = supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true });
    if (table === "tasks") query = query.is("deleted_at", null);
    const { data, error } = await query.range(
      page * PAGE,
      (page + 1) * PAGE - 1,
    );
    if (error) throw new Error(error.message);
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
    Array.from({ length: Math.min(4, items.length) }, async () => {
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
  error instanceof Error ? error.message : String(error);
