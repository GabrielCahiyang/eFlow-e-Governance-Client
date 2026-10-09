/** Exhaust a server query instead of treating the Data API row limit as history. */
export async function readAllRows<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
    count?: number | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  let total: number | undefined;
  for (let from = 0; ;) {
    const result = await read(from, from + size - 1);
    if (result.error) throw new Error(result.error.message);
    if (!Array.isArray(result.data))
      throw new Error("Could not verify complete report facts.");
    if (typeof result.count === "number") {
      if (total !== undefined && total !== result.count)
        throw new Error(
          "Report facts changed during loading. Retry the report.",
        );
      total = result.count;
    }
    rows.push(...result.data);
    from += result.data.length;
    if (total !== undefined) {
      if (from === total) return rows;
      if (!result.data.length || from > total)
        throw new Error("Report facts are incomplete. Retry the report.");
    } else if (result.data.length < size) return rows;
  }
}
