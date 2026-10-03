import type { Employee, EmployeeNotesMap } from "../../members";
import type { SkillCoverageRow } from "../types";

export function buildSkillCoverage(employees: Employee[], notes: EmployeeNotesMap): SkillCoverageRow[] {
  const skills = new Map<string, { label: string; employeeIds: Set<string>; employeeNames: Set<string> }>();
  employees.forEach((employee) => {
    const explicit = notes[employee.id]?.tags || [];
    const profileSkills = employee.jobDescription
      .split(/[,;|]/)
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 1 && skill.toLowerCase() !== employee.jobTitle.toLowerCase());
    [...explicit, ...profileSkills].forEach((skill) => {
      const key = skill.trim().toLowerCase();
      if (!key) return;
      const row = skills.get(key) || { label: skill.trim(), employeeIds: new Set<string>(), employeeNames: new Set<string>() };
      row.employeeIds.add(employee.id);
      row.employeeNames.add(employee.name);
      skills.set(key, row);
    });
  });
  return Array.from(skills.values()).map((row): SkillCoverageRow => {
    const coverage: SkillCoverageRow["coverage"] = row.employeeIds.size === 1 ? "single_point" : row.employeeIds.size === 2 ? "limited" : "covered";
    return { skill: row.label, employeeIds: Array.from(row.employeeIds), employeeNames: Array.from(row.employeeNames).sort(), coverage };
  }).sort((first, second) => first.employeeIds.length - second.employeeIds.length || first.skill.localeCompare(second.skill));
}

