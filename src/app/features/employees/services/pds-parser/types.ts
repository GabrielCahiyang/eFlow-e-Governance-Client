import type { UserRole } from '../../../../types';

export type PdsEmployeeNotes = {
  strengths: string;
  weaknesses: string;
  notes: string;
  tags: string[];
};

export type PdsUserDefaults = {
  fullName: string;
  email: string;
  departmentId: string;
  role: UserRole;
  workload: number;
  burnoutLevel: "low";
  status: "active";
};

export type PdsPersonalDetails = {
  surname: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  placeOfBirth: string;
  telephone: string;
  mobile: string;
  email: string;
  employeeNumber: string;
};

export type PdsImportDetails = {
  sourceFileName: string;
  personal: PdsPersonalDetails;
  currentWork?: WorkExperience;
  education: Education[];
  eligibility: Eligibility | null;
  trainings: Training[];
  specialSkills: string[];
};

export type ParsedPdsImport = {
  profile: PdsUserDefaults;
  employeeNotes: PdsEmployeeNotes;
  details: PdsImportDetails;
};

export type DepartmentOption = {
  value: string;
  label: string;
};

export type SheetRows = string[][];

export type WorkExperience = {
  from: string;
  to: string;
  position: string;
  office: string;
  monthlySalary: string;
  salaryGrade: string;
  appointmentStatus: string;
  governmentService: string;
};

export type Eligibility = {
  title: string;
  rating: string;
  examinationDate: string;
  examinationPlace: string;
  licenseNumber: string;
  licenseValidity: string;
};

export type Education = {
  level: string;
  school: string;
  degree: string;
  from: string;
  to: string;
  yearGraduated: string;
  highestLevel: string;
};

export type Training = {
  title: string;
  from: string;
  to: string;
  hours: string;
  type: string;
  provider: string;
};
