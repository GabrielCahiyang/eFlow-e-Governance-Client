import type { DepartmentOption } from './types';

export const NOTE_TAG_LIMIT = 8;

export const normalizeWhitespace = (value: unknown) =>
  String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isMeaningful = (value: unknown) => {
  const text = normalizeWhitespace(value);
  return text.length > 0 && !/^N\/?A$/i.test(text);
};

export const titleCase = (value: string) => {
  const preserve = new Set([
    "BPLO",
    "CSE",
    "CSE-PPT",
    "IT",
    "LGU",
    "PDS",
    "PPP",
    "PPT",
  ]);

  return normalizeWhitespace(value)
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const stripped = word.replace(/[^a-z0-9-]/gi, "").toUpperCase();
      if (preserve.has(stripped)) return stripped;
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    })
    .join(" ");
};

export const normalizeNamePart = (value: string) =>
  titleCase(value).replace(/\s+(Jr|Sr)\.?$/i, " $1.");

export const middleInitial = (middleName: string) => {
  const first = normalizeNamePart(middleName).charAt(0);
  return first ? `${first}.` : "";
};

export const unique = <T,>(values: T[]) => Array.from(new Set(values));

export const formatList = (values: string[]) => {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
};

export const normalizeEligibilityTitle = (value: string) =>
  titleCase(value.replace(/\bCSE\s*-\s*PPT\b/i, "CSE-PPT"));

export const normalizeDegree = (value: string) => {
  const text = normalizeWhitespace(value).replace(/\.$/, "");
  if (/BS\s+COMPUTER\s+SCIENCE/i.test(text)) return "BS Computer Science";
  if (/BS\s+COMPUTER\s+ENG/i.test(text)) return "BS Computer Engineering";
  return titleCase(text);
};

export const graduateFocus = (degree: string) => {
  if (/PUBLIC\s+ADMINISTRATION/i.test(degree)) return "Public Administration";
  if (/PUBLIC\s+MANAGEMENT/i.test(degree)) return "Public Management";

  return titleCase(
    degree
      .replace(/^MASTERS?\s+(IN|OF\s+ARTS\s+IN)\s+/i, "")
      .replace(/^MASTER\s+OF\s+ARTS\s+IN\s+/i, ""),
  );
};

export const departmentLabelFromOffice = (office: string) => {
  if (/business\s+permits?.*licen[cs]ing|licen[cs]ing.*business\s+permits?/i.test(office)) {
    return "BPLO";
  }
  return titleCase(office);
};

export const resolveDepartmentId = (
  office: string,
  departments: DepartmentOption[],
) => {
  const officeText = normalizeWhitespace(office);
  if (!officeText) return "";

  if (departmentLabelFromOffice(officeText) === "BPLO") {
    const bplo = departments.find(
      (department) =>
        /^BPLO$/i.test(department.value) ||
        /^BPLO$/i.test(department.label) ||
        /business\s+permits?.*licen[cs]ing/i.test(department.label),
    );
    return bplo?.value || "BPLO";
  }

  const officeLower = officeText.toLowerCase();
  const exact = departments.find(
    (department) =>
      department.value.toLowerCase() === officeLower ||
      department.label.toLowerCase() === officeLower,
  );
  if (exact) return exact.value;

  const fuzzy = departments.find((department) => {
    const label = department.label.toLowerCase();
    return officeLower.includes(label) || label.includes(officeLower);
  });
  return fuzzy?.value || "";
};
