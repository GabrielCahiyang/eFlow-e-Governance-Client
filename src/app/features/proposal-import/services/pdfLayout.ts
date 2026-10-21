/** Coordinates stay in PDF user space. No OCR or inferred financial values. */
export interface PdfTextPiece {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}
export type PdfRule = readonly [number, number, number, number];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const positioned = (items: PdfTextPiece[]) =>
  items.filter((item) => item.str.trim() && item.transform?.length === 6);
const x = (item: PdfTextPiece) => item.transform![4];
const y = (item: PdfTextPiece) => item.transform![5];

export function workTableText(items: PdfTextPiece[], rules: PdfRule[]): string {
  const pieces = positioned(items);
  const labels = ["ACTION", "DETAILS", "METHODOLOGY", "SCHEDULE"];
  const headers = labels.map((label) =>
    pieces.find((item) => clean(item.str) === label),
  );
  // A continued page may omit the heading; use its ruled columns, never fixed page coordinates.
  const parts = pieces.filter((item) =>
    /^Part\s+\d+\s*:/i.test(clean(item.str)),
  );
  if (!parts.length) return "";
  const horizontal = rules.filter(
    (r) => r[3] - r[1] <= 1.5 && r[2] - r[0] > 15,
  );
  const vertical = rules.filter((r) => r[2] - r[0] <= 1.5 && r[3] - r[1] > 4);
  const rows = [];
  for (const part of parts) {
    const cy = y(part),
      cx = x(part) + 3;
    const edges = [
      ...new Set(
        vertical
          .filter((r) => r[1] <= cy && r[3] >= cy)
          .map((r) => Math.round((r[0] + r[2]) / 2)),
      ),
    ].sort((a, b) => a - b);
    if (edges.length !== 5) return "";
    const heights = horizontal
      .filter((r) => r[0] <= cx && r[2] >= cx)
      .map((r) => (r[1] + r[3]) / 2);
    const top = Math.min(...heights.filter((v) => v > cy)),
      bottom = Math.max(...heights.filter((v) => v < cy));
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return "";
    const cells = edges
      .slice(0, -1)
      .map((left, i) =>
        readingOrderText(
          pieces.filter(
            (item) =>
              x(item) >= left - 1 &&
              x(item) < edges[i + 1] - 1 &&
              y(item) > bottom &&
              y(item) < top,
          ),
        ).replace(/\n/g, " "),
      );
    if (headers.every(Boolean) && cy >= y(headers[0]!)) continue;
    if (!rows.length && headers.some((item) => !item)) {
      const continuation = readingOrderText(
        pieces.filter(
          (item) =>
            x(item) >= edges[2] - 1 && x(item) < edges[3] - 1 && y(item) > top,
        ),
      ).replace(/\n/g, " ");
      if (continuation.trim())
        rows.push(
          JSON.stringify({
            continuation: true,
            methodology: clean(continuation),
          }),
        );
    }
    rows.push(
      JSON.stringify({
        part: Number(part.str.match(/Part\s+(\d+)/i)![1]),
        title: clean(cells[0]),
        details: clean(cells[1]),
        methodology: clean(cells[2]),
        schedule: clean(cells[3]),
      }),
    );
  }
  return rows.length
    ? `\n[PDF WORK TABLE]\n${rows.join("\n")}\n[/PDF WORK TABLE]\n`
    : "";
}

export function readingOrderText(items: PdfTextPiece[]): string {
  const pieces = positioned(items);
  if (pieces.length !== items.filter((item) => item.str.trim()).length)
    return clean(items.map((item) => item.str).join(" "));
  const lines: PdfTextPiece[][] = [];
  for (const item of [...pieces].sort((a, b) => y(b) - y(a) || x(a) - x(b))) {
    const line = lines.find((row) => Math.abs(y(row[0]) - y(item)) < 2);
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) =>
      clean(
        line
          .sort((a, b) => x(a) - x(b))
          .map((item) => item.str)
          .join(" "),
      ),
    )
    .join("\n");
}

/** Read ruled financial tables by their actual cell boundaries, including merged cells. */
export function budgetTableText(
  items: PdfTextPiece[],
  rules: PdfRule[],
  page: number,
): string {
  const pieces = positioned(items);
  const names = ["Category", "Particulars", "Amount", "Subtotal"];
  const headers = names.map((name) =>
    pieces.find((item) => clean(item.str).toLowerCase() === name.toLowerCase()),
  );
  if (
    headers.some((item) => !item) ||
    Math.max(...headers.map((item) => y(item!))) -
      Math.min(...headers.map((item) => y(item!))) >
      4
  )
    return "";
  const headerY = y(headers[0]!);
  const fund = pieces.find(
    (item) =>
      /^Fund$/i.test(clean(item.str)) && Math.abs(y(item) - headerY) < 20,
  );
  if (!fund) return "";
  const centers = [...headers, fund].map(
    (item) => x(item!) + (item!.width || 0) / 2,
  );
  const horizontal = rules.filter(
    (r) => r[3] - r[1] <= 1.5 && r[2] - r[0] > 15,
  );
  const vertical = rules.filter((r) => r[2] - r[0] <= 1.5 && r[3] - r[1] > 4);
  const bounds = (cx: number, cy: number) => {
    const ys = horizontal
      .filter((r) => r[0] <= cx && r[2] >= cx)
      .map((r) => (r[1] + r[3]) / 2);
    const top = Math.min(...ys.filter((v) => v > cy + 1)),
      bottom = Math.max(...ys.filter((v) => v < cy - 1));
    const xs = vertical
      .filter((r) => r[1] <= cy && r[3] >= cy)
      .map((r) => (r[0] + r[2]) / 2);
    return {
      top,
      bottom,
      left: Math.max(...xs.filter((v) => v < cx)),
      right: Math.min(...xs.filter((v) => v > cx)),
    };
  };
  const read = (
    cx: number,
    cy: number,
    span?: { top: number; bottom: number },
  ) => {
    const box = bounds(cx, cy);
    if (span) {
      box.top = span.top;
      box.bottom = span.bottom;
    }
    if (!Object.values(box).every(Number.isFinite)) return "";
    return clean(
      readingOrderText(
        pieces.filter(
          (item) =>
            x(item) >= box.left - 1 &&
            x(item) < box.right - 1 &&
            y(item) > box.bottom &&
            y(item) < box.top,
        ),
      ),
    );
  };
  const amountBox = bounds(centers[2], headerY);
  if (!Number.isFinite(amountBox.left) || !Number.isFinite(amountBox.right))
    return "";
  const amounts = pieces.filter(
    (item) =>
      /^\d[\d,]*(?:\.\d{2})?$/.test(clean(item.str)) &&
      x(item) >= amountBox.left &&
      x(item) < amountBox.right &&
      y(item) < headerY - 10,
  );
  const rows: string[] = [];
  for (const item of amounts.sort((a, b) => y(b) - y(a))) {
    const cy = y(item),
      box = bounds(centers[2], cy);
    const category = read(centers[0], cy),
      particulars = read(centers[1], cy, box);
    if (!category || !Number.isFinite(box.top) || !Number.isFinite(box.bottom))
      return "";
    const section = pieces
      .filter(
        (p) =>
          x(p) < centers[1] &&
          y(p) > cy &&
          y(p) < headerY &&
          /^(?:PROFESSIONAL SERVICES|OTHER EXPENSES)\b/i.test(p.str.trim()),
      )
      .sort((a, b) => y(a) - y(b))[0];
    rows.push(
      JSON.stringify({
        page,
        expenseClass: section?.str.startsWith("PROFESSIONAL")
          ? "Professional Services"
          : "Other Expenses",
        category,
        particular: particulars,
        amount: clean(item.str),
        subtotal: read(centers[3], cy),
        fundSource: read(centers[4], cy),
      }),
    );
  }
  return rows.length
    ? `\n[PDF BUDGET TABLE PAGE ${page}]\n${rows.join("\n")}\n[/PDF BUDGET TABLE]\n`
    : "";
}
