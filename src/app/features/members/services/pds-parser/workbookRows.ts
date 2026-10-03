import * as XLSX from 'xlsx';
import type { SheetRows } from './types';
import { isMeaningful, normalizeWhitespace } from './valueUtils';

export const readRows = (workbook: XLSX.WorkBook, sheetName: string): SheetRows => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`PDS sheet "${sheetName}" is missing.`);
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as SheetRows;
};

export const findRowIndex = (
  rows: SheetRows,
  matcher: RegExp,
  maxRow = rows.length,
) =>
  rows.findIndex(
    (row, index) =>
      index < maxRow && row.some((value) => matcher.test(normalizeWhitespace(value))),
  );

export const findValueRightOfLabel = (
  rows: SheetRows,
  matcher: RegExp,
  maxRow: number,
) => {
  for (let rowIndex = 0; rowIndex < Math.min(maxRow, rows.length); rowIndex += 1) {
    const row = rows[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (!matcher.test(normalizeWhitespace(row[columnIndex]))) continue;

      for (
        let valueColumn = columnIndex + 1;
        valueColumn < Math.min(row.length, columnIndex + 8);
        valueColumn += 1
      ) {
        const value = normalizeWhitespace(row[valueColumn]);
        if (isMeaningful(value) && !matcher.test(value)) return value;
      }
    }
  }

  return "";
};

export const validatePdsWorkbook = (workbook: XLSX.WorkBook, rowsBySheet: Record<string, SheetRows>) => {
  const missing = ["C1", "C2", "C3"].filter((sheetName) => !workbook.Sheets[sheetName]);
  if (missing.length) {
    throw new Error(`Invalid PDS file. Missing sheet(s): ${missing.join(", ")}.`);
  }

  const c1Text = rowsBySheet.C1.flat().map(normalizeWhitespace).join(" ");
  const c2Text = rowsBySheet.C2.flat().map(normalizeWhitespace).join(" ");
  const c3Text = rowsBySheet.C3.flat().map(normalizeWhitespace).join(" ");

  if (
    !/PERSONAL DATA SHEET/i.test(c1Text) ||
    !/CIVIL SERVICE ELIGIBILITY/i.test(c2Text) ||
    !/LEARNING AND DEVELOPMENT/i.test(c3Text)
  ) {
    throw new Error("Invalid PDS file. Please upload a CSC Personal Data Sheet workbook.");
  }
};
