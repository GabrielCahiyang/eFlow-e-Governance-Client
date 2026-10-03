import type { Education, Eligibility, PdsPersonalDetails, SheetRows, Training, WorkExperience } from './types';
import { findRowIndex, findValueRightOfLabel } from './workbookRows';
import { isMeaningful, middleInitial, normalizeEligibilityTitle, normalizeNamePart, normalizeWhitespace, titleCase } from './valueUtils';

export const parseFullName = (c1Rows: SheetRows) => {
  const surname = findValueRightOfLabel(c1Rows, /^SURNAME$/i, 15);
  const firstName = findValueRightOfLabel(c1Rows, /^FIRST NAME$/i, 15);
  const middleName = findValueRightOfLabel(c1Rows, /^MIDDLE NAME$/i, 15);
  return [normalizeNamePart(firstName), middleInitial(middleName), normalizeNamePart(surname)]
    .filter(Boolean)
    .join(" ");
};

export const parseEmail = (c1Rows: SheetRows) => {
  const flattened = c1Rows.flatMap((row) =>
    row.map((value) => normalizeWhitespace(value)),
  );
  const email = flattened.find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return email || "";
};

export const parsePersonalDetails = (c1Rows: SheetRows): PdsPersonalDetails => ({
  surname: normalizeNamePart(findValueRightOfLabel(c1Rows, /^SURNAME$/i, 15)),
  firstName: normalizeNamePart(findValueRightOfLabel(c1Rows, /^FIRST NAME$/i, 15)),
  middleName: normalizeNamePart(findValueRightOfLabel(c1Rows, /^MIDDLE NAME$/i, 15)),
  birthDate: findValueRightOfLabel(c1Rows, /DATE OF BIRTH/i, 20),
  placeOfBirth: findValueRightOfLabel(c1Rows, /PLACE OF BIRTH/i, 20),
  telephone: findValueRightOfLabel(c1Rows, /TELEPHONE NO/i, 35),
  mobile: findValueRightOfLabel(c1Rows, /MOBILE NO/i, 35),
  email: parseEmail(c1Rows),
  employeeNumber: findValueRightOfLabel(c1Rows, /AGENCY EMPLOYEE NO/i, 35),
});

export const parseEducation = (c1Rows: SheetRows): Education[] => {
  const start = findRowIndex(c1Rows, /EDUCATIONAL BACKGROUND/i);
  if (start < 0) return [];

  const education: Education[] = [];
  let currentLevel = "";

  c1Rows.slice(start + 1).forEach((row) => {
    const level = normalizeWhitespace(row[1] || row[0]);
    if (isMeaningful(level)) currentLevel = level;
    if (/continue|signature|date|cs form/i.test(currentLevel)) return;

    const degree = normalizeWhitespace(row[6]);
    if (!isMeaningful(currentLevel) || !isMeaningful(degree)) return;
    if (/^LEVEL$/i.test(currentLevel) || /BASIC EDUCATION.*DEGREE.*COURSE/i.test(degree)) return;

    education.push({
      level: currentLevel,
      school: normalizeWhitespace(row[3]),
      degree,
      from: normalizeWhitespace(row[9]),
      to: normalizeWhitespace(row[10]),
      highestLevel: normalizeWhitespace(row[11]),
      yearGraduated: normalizeWhitespace(row[12]),
    });
  });

  return education;
};

export const parseEligibility = (c2Rows: SheetRows): Eligibility | null => {
  const workStart = findRowIndex(c2Rows, /WORK EXPERIENCE/i);
  const rows = workStart >= 0 ? c2Rows.slice(0, workStart) : c2Rows.slice(0, 8);
  const eligibilityRow = rows.find((row) => {
    const title = normalizeWhitespace(row[0]);
    return (
      isMeaningful(title) &&
      !/^\d+\.?$/.test(title) &&
      !/civil service|career service|continue|license/i.test(title)
    );
  });

  if (!eligibilityRow) return null;

  return {
    title: normalizeEligibilityTitle(normalizeWhitespace(eligibilityRow[0])),
    rating: normalizeWhitespace(eligibilityRow[5]),
    examinationDate: normalizeWhitespace(eligibilityRow[6]),
    examinationPlace: normalizeWhitespace(eligibilityRow[8]),
    licenseNumber: normalizeWhitespace(eligibilityRow[11]),
    licenseValidity: normalizeWhitespace(eligibilityRow[12]),
  };
};

export const parseWorkExperience = (c2Rows: SheetRows): WorkExperience[] => {
  const workStart = findRowIndex(c2Rows, /WORK EXPERIENCE/i);
  if (workStart < 0) return [];

  return c2Rows
    .slice(workStart + 1)
    .map((row): WorkExperience => ({
      from: normalizeWhitespace(row[0]),
      to: normalizeWhitespace(row[2]),
      position: titleCase(normalizeWhitespace(row[3])),
      office: normalizeWhitespace(row[6]),
      monthlySalary: normalizeWhitespace(row[9]),
      salaryGrade: normalizeWhitespace(row[10]),
      appointmentStatus: titleCase(normalizeWhitespace(row[11])),
      governmentService: normalizeWhitespace(row[12]),
    }))
    .filter((experience) => isMeaningful(experience.position) && isMeaningful(experience.office))
    .filter((experience) => !/position title|continue|signature|date/i.test(experience.position));
};

export const parseTrainings = (c3Rows: SheetRows): Training[] => {
  const start = findRowIndex(c3Rows, /LEARNING AND DEVELOPMENT/i);
  const end = findRowIndex(c3Rows, /OTHER INFORMATION/i);
  if (start < 0) return [];

  return c3Rows
    .slice(start + 1, end > start ? end : undefined)
    .map((row): Training => ({
      title: normalizeWhitespace(row[0]),
      from: normalizeWhitespace(row[4]),
      to: normalizeWhitespace(row[5]),
      hours: normalizeWhitespace(row[6]),
      type: titleCase(normalizeWhitespace(row[7])),
      provider: normalizeWhitespace(row[8]),
    }))
    .filter((training) => isMeaningful(training.title))
    .filter((training) => !/start from the most recent|title of learning|continue|from|to|^\d+\.$/i.test(training.title));
};

export const parseSpecialSkills = (c3Rows: SheetRows) => {
  const start = findRowIndex(c3Rows, /SPECIAL SKILLS/i);
  if (start < 0) return [];

  const skills: string[] = [];
  for (let rowIndex = start + 1; rowIndex < c3Rows.length; rowIndex += 1) {
    const value = normalizeWhitespace(c3Rows[rowIndex]?.[0]);
    if (!isMeaningful(value)) continue;
    if (/continue|signature|date|cs form/i.test(value)) break;
    skills.push(titleCase(value.replace(/\bDESIGNING\b/i, "Design")));
  }

  return skills;
};
