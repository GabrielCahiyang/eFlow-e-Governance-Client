import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePdsWorkbook } from "../../src/app/features/members/services/pds-parser";

function workbookBuffer() {
  const workbook = XLSX.utils.book_new();

  const c1 = XLSX.utils.aoa_to_sheet([
    ["PERSONAL DATA SHEET"],
    ["", "SURNAME", "", "GALLO"],
    ["", "FIRST NAME", "", "CHERYL"],
    ["", "MIDDLE NAME", "", "PANTALITA"],
    ["", "DATE OF BIRTH (mm/dd/yyyy)", "", "04/26/1983"],
    ["", "PLACE OF BIRTH", "", "ORMOC CITY"],
    ["", "TELEPHONE NO.", "", "N/A"],
    ["", "MOBILE NO.", "", "0912-345-6789"],
    ["AGENCY EMPLOYEE NO.", "", "", "ENR-1062"],
    ["", "E-MAIL ADDRESS (if any)", "", "cvpgallo@example.gov.ph"],
    ["III. EDUCATIONAL BACKGROUND"],
    ["", "LEVEL", "", "NAME OF SCHOOL", "", "", "BASIC EDUCATION/DEGREE/COURSE"],
    ["", "COLLEGE", "", "STI COLLEGE ORMOC", "", "", "BS COMPUTER SCIENCE", "", "", "2000", "2004", "GRADUATE", "2004"],
  ]);

  const c2 = XLSX.utils.aoa_to_sheet([
    ["IV. CIVIL SERVICE ELIGIBILITY"],
    ["27.", "CAREER SERVICE", "", "", "", "RATING", "DATE", "", "PLACE"],
    ["CSE-PPT PROFESSIONAL LEVEL", "", "", "", "", "86.89", "05/03/2015", "", "CEBU CITY"],
    ["V. WORK EXPERIENCE"],
    ["28.", "INCLUSIVE DATES", "", "POSITION TITLE", "", "", "DEPARTMENT / AGENCY / OFFICE / COMPANY"],
    ["JANUARY 2022", "", "PRESENT", "ADMINISTRATIVE OFFICER V", "", "", "ORMOC CITY LGU/BUSINESS PERMITS AND LICENSING OFFICE", "", "", "P46,725", "SG 18", "REGULAR", "Y"],
  ]);

  const c3 = XLSX.utils.aoa_to_sheet([
    ["VII. LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED"],
    ["(Start from the most recent L&D/training program)"],
    ["30.", "TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS"],
    ["PPP PROJECT IDENTIFICATION WORKSHOP", "", "", "", "04/26/2023", "04/27/2023", "7", "TECHNICAL", "PPP CENTER"],
    ["VIII. OTHER INFORMATION"],
    ["31.", "SPECIAL SKILLS and HOBBIES"],
    ["DRIVING"],
    ["GRAPHIC DESIGNING"],
  ]);

  XLSX.utils.book_append_sheet(workbook, c1, "C1");
  XLSX.utils.book_append_sheet(workbook, c2, "C2");
  XLSX.utils.book_append_sheet(workbook, c3, "C3");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("CSC PDS import", () => {
  it("extracts reviewable profile, work, education, training, and skill details", () => {
    const parsed = parsePdsWorkbook(workbookBuffer(), [
      { value: "bplo-id", label: "Business Permits and Licensing Office" },
    ]);

    expect(parsed.profile).toMatchObject({
      fullName: "Cheryl P. Gallo",
      email: "cvpgallo@example.gov.ph",
      departmentId: "bplo-id",
      role: "member",
    });
    expect(parsed.details.personal).toMatchObject({
      birthDate: "04/26/1983",
      placeOfBirth: "ORMOC CITY",
      mobile: "0912-345-6789",
      employeeNumber: "ENR-1062",
    });
    expect(parsed.details.currentWork).toMatchObject({
      position: "Administrative Officer V",
      appointmentStatus: "Regular",
      to: "PRESENT",
    });
    expect(parsed.details.education).toHaveLength(1);
    expect(parsed.details.education[0]).toMatchObject({
      level: "COLLEGE",
      school: "STI COLLEGE ORMOC",
      degree: "BS COMPUTER SCIENCE",
    });
    expect(parsed.details.eligibility?.title).toBe("CSE-PPT Professional Level");
    expect(parsed.details.trainings).toHaveLength(1);
    expect(parsed.details.trainings[0]).toMatchObject({
      title: "PPP PROJECT IDENTIFICATION WORKSHOP",
      hours: "7",
      provider: "PPP CENTER",
    });
    expect(parsed.employeeNotes.tags).toEqual(expect.arrayContaining([
      "Driving",
      "Graphic Design",
      "BPLO",
      "Administrative",
      "PPP",
      "IT",
    ]));
  });
});
