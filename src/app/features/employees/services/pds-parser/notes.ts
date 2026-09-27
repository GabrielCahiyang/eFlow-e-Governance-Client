import type { Education, Eligibility, Training, WorkExperience } from './types';
import { NOTE_TAG_LIMIT, departmentLabelFromOffice, formatList, graduateFocus, isMeaningful, normalizeDegree, unique } from './valueUtils';

export const buildStrengths = (
  currentWork: WorkExperience | undefined,
  trainings: Training[],
) => {
  const haystack = [
    currentWork?.position,
    currentWork?.office,
    ...trainings.map((training) => `${training.title} ${training.type}`),
  ]
    .join(" ")
    .toLowerCase();

  const strengths: string[] = [];
  if (/administrative|admin officer/.test(haystack)) {
    strengths.push("Administrative Management");
  }
  if (/business permits?.*licen[cs]ing|licen[cs]ing.*business permits?/.test(haystack)) {
    strengths.push("Business Permits & Licensing");
  }
  if (/public-private|ppp|investment/.test(haystack)) {
    strengths.push("PPP & Investment Facilitation");
  }
  if (/supervisory|leadership|management/.test(haystack)) {
    strengths.push("Supervisory Leadership");
  }

  return unique(strengths).join(", ");
};

export const buildTags = (
  currentWork: WorkExperience | undefined,
  education: Education[],
  trainings: Training[],
  specialSkills: string[],
) => {
  const haystack = [
    currentWork?.position,
    currentWork?.office,
    ...education.map((item) => item.degree),
    ...trainings.map((training) => `${training.title} ${training.type}`),
    ...specialSkills,
  ]
    .join(" ")
    .toLowerCase();

  const tags: string[] = [];
  specialSkills.forEach((skill) => tags.push(skill));
  if (departmentLabelFromOffice(currentWork?.office || "") === "BPLO") tags.push("BPLO");
  if (/administrative|admin officer/.test(haystack)) tags.push("Administrative");
  if (/public-private|ppp/.test(haystack)) tags.push("PPP");
  if (/computer|information technology|\bit\b/.test(haystack)) tags.push("IT");
  if (/graphic design/.test(haystack)) tags.push("Graphic Design");

  return unique(tags).slice(0, NOTE_TAG_LIMIT);
};

export const buildNotes = (
  currentWork: WorkExperience | undefined,
  education: Education[],
  eligibility: Eligibility | null,
) => {
  const collegeDegree = education.find((item) => /COLLEGE/i.test(item.level))?.degree;
  const graduateStudies = education.filter((item) => /GRADUATE/i.test(item.level));
  const departmentLabel = departmentLabelFromOffice(currentWork?.office || "");
  const sentences: string[] = [];

  if (currentWork?.position) {
    const role = currentWork.position;
    const rolePrefix = departmentLabel ? `${role} at ${departmentLabel}` : role;
    const degreeText = collegeDegree
      ? ` with ${normalizeDegree(collegeDegree)} background`
      : "";
    sentences.push(`${rolePrefix}${degreeText}.`);
  }

  if (eligibility?.title) {
    const ratingText = eligibility.rating ? ` (${eligibility.rating})` : "";
    sentences.push(`Holds ${eligibility.title} eligibility${ratingText}.`);
  }

  const graduateFocuses = unique(
    graduateStudies.map((item) => graduateFocus(item.degree)).filter(Boolean),
  );
  if (graduateFocuses.length) {
    const isPursuing = graduateStudies.some(
      (item) =>
        /present/i.test(item.to) ||
        (!isMeaningful(item.yearGraduated) && isMeaningful(item.highestLevel)),
    );
    sentences.push(
      `${isPursuing ? "Pursuing" : "Completed"} graduate studies in ${formatList(
        graduateFocuses,
      )}.`,
    );
  }

  return sentences.join(" ");
};
