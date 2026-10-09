import { readAllRows } from "../../../shared/readAllRows";
type Row = Record<string, unknown>;
type Result = {
  data: Row[] | null;
  error: { message: string } | null;
  count?: number | null;
};
/** Keep existing budget return contracts while exhausting authorized source pages. */
export async function budgetReportRead(
  read: (ids: string[]) => {
    range: (from: number, to: number) => PromiseLike<Result>;
  },
  ids?: string[],
  order?: string,
  ascending = false,
): Promise<Result> {
  try {
    const batches = ids
      ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          ids.slice(i * 100, i * 100 + 100),
        )
      : [[]];
    const data: Row[] = [];
    for (const batch of batches)
      data.push(
        ...(await readAllRows<Row>((from, to) => read(batch).range(from, to))),
      );
    if (order)
      data.sort((a, b) => {
        const left = a[order],
          right = b[order];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left || "").localeCompare(String(right || ""));
        return (
          (ascending ? result : -result) ||
          String(a.id).localeCompare(String(b.id))
        );
      });
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Budget report facts unavailable.",
      },
    };
  }
}
