export interface SeedDepartment {
  id: string;
  name: string;
  description: string;
}

export interface SeedEmployee {
  id: string;
  name: string;
  initials: string;
  department: string;
  role: string;
  description: string;
  workload: number;
  email: string;
}

export type SeedTaskStatus = "todo" | "in_progress";

export interface SeedTask {
  id: string;
  title: string;
  description: string;
  department: string;
  assignedTo: string;
  status: SeedTaskStatus;
  priority: "high" | "medium";
  dueDate: string;
  tags: string[];
}

export const DEPARTMENT_SEED: SeedDepartment[] = [
  {
    id: "EPW",
    name: "Engineering & Public Works",
    description: "Oversees all city infrastructure, road projects, and public works contracts",
  },
  {
    id: "CPD",
    name: "City Planning & Development",
    description: "Leads urban planning, zoning, and land use policy for the city",
  },
  {
    id: "FIN",
    name: "Finance & Budget",
    description: "Manages city budget, financial planning, and expenditure reporting",
  },
  {
    id: "HSW",
    name: "Health & Social Welfare",
    description: "Directs public health programs, social services, and community welfare",
  },
  {
    id: "ITS",
    name: "IT & Digital Services",
    description: "Oversees city IT infrastructure, digital transformation, and cybersecurity",
  },
];

export const EMPLOYEE_SEED: SeedEmployee[] = [
  {
    id: "emp_001",
    name: "Ramon Cruz",
    initials: "RC",
    department: "EPW",
    role: "Head",
    description: "Oversees all city infrastructure, road projects, and public works contracts",
    workload: 75,
    email: "r.cruz@eflow.gov.ph",
  },
  {
    id: "emp_002",
    name: "Maria Villanueva",
    initials: "MV",
    department: "EPW",
    role: "Project Manager",
    description: "Manages road rehabilitation and drainage improvement projects",
    workload: 60,
    email: "m.villanueva@eflow.gov.ph",
  },
  {
    id: "emp_003",
    name: "Jose Torralba",
    initials: "JT",
    department: "EPW",
    role: "Civil Engineer",
    description: "Designs and inspects bridges, roads, and structural works",
    workload: 45,
    email: "j.torralba@eflow.gov.ph",
  },
  {
    id: "emp_004",
    name: "Ana Lacson",
    initials: "AL",
    department: "EPW",
    role: "Field Inspector",
    description: "Conducts on-site inspections and progress monitoring of active projects",
    workload: 80,
    email: "a.lacson@eflow.gov.ph",
  },
  {
    id: "emp_005",
    name: "Bryan Palomino",
    initials: "BP",
    department: "EPW",
    role: "CAD Technician",
    description: "Produces technical drawings and blueprints for infrastructure projects",
    workload: 30,
    email: "b.palomino@eflow.gov.ph",
  },
  {
    id: "emp_006",
    name: "Liza Castellano",
    initials: "LC",
    department: "CPD",
    role: "Head",
    description: "Leads urban planning, zoning, and land use policy for the city",
    workload: 70,
    email: "l.castellano@eflow.gov.ph",
  },
  {
    id: "emp_007",
    name: "Eduardo Reyes",
    initials: "ER",
    department: "CPD",
    role: "Urban Planner",
    description: "Develops comprehensive land use and zoning plans per barangay",
    workload: 55,
    email: "e.reyes@eflow.gov.ph",
  },
  {
    id: "emp_008",
    name: "Sofia Fuentes",
    initials: "SF",
    department: "CPD",
    role: "GIS Analyst",
    description: "Manages geospatial data, maps, and location-based planning tools",
    workload: 40,
    email: "s.fuentes@eflow.gov.ph",
  },
  {
    id: "emp_009",
    name: "Karl Magallanes",
    initials: "KM",
    department: "CPD",
    role: "Permit Officer",
    description: "Processes building permits and land use clearances",
    workload: 65,
    email: "k.magallanes@eflow.gov.ph",
  },
  {
    id: "emp_010",
    name: "Patricia Ngo",
    initials: "PN",
    department: "FIN",
    role: "Head",
    description: "Manages city budget, financial planning, and expenditure reporting",
    workload: 70,
    email: "p.ngo@eflow.gov.ph",
  },
  {
    id: "emp_011",
    name: "Ronaldo Dimaculangan",
    initials: "RD",
    department: "FIN",
    role: "Budget Officer",
    description: "Prepares annual budget proposals and monitors fund utilization",
    workload: 60,
    email: "r.dimaculangan@eflow.gov.ph",
  },
  {
    id: "emp_012",
    name: "Carla Mercado",
    initials: "CM",
    department: "FIN",
    role: "Accountant",
    description: "Handles disbursements, payroll, and financial compliance audits",
    workload: 50,
    email: "c.mercado@eflow.gov.ph",
  },
  {
    id: "emp_013",
    name: "Tomas Quiambao",
    initials: "TQ",
    department: "FIN",
    role: "Revenue Collector",
    description: "Collects local taxes, fees, and other city revenue streams",
    workload: 45,
    email: "t.quiambao@eflow.gov.ph",
  },
  {
    id: "emp_014",
    name: "Dr. Remedios Avila",
    initials: "DR",
    department: "HSW",
    role: "Head",
    description: "Directs public health programs, social services, and community welfare",
    workload: 85,
    email: "r.avila@eflow.gov.ph",
  },
  {
    id: "emp_015",
    name: "Nurse Bella Santos",
    initials: "NB",
    department: "HSW",
    role: "Public Health Nurse",
    description: "Coordinates barangay health center operations and vaccination drives",
    workload: 75,
    email: "b.santos@eflow.gov.ph",
  },
  {
    id: "emp_016",
    name: "Gerald Soriano",
    initials: "GS",
    department: "HSW",
    role: "Social Worker",
    description: "Assists indigent families with aid programs and crisis intervention",
    workload: 60,
    email: "g.soriano@eflow.gov.ph",
  },
  {
    id: "emp_017",
    name: "Irene Alcazar",
    initials: "IA",
    department: "HSW",
    role: "Nutrition Officer",
    description: "Implements supplemental feeding and malnutrition monitoring programs",
    workload: 50,
    email: "i.alcazar@eflow.gov.ph",
  },
  {
    id: "emp_018",
    name: "Dante Caballero",
    initials: "DC",
    department: "ITS",
    role: "Head",
    description: "Oversees city IT infrastructure, digital transformation, and cybersecurity",
    workload: 65,
    email: "d.caballero@eflow.gov.ph",
  },
  {
    id: "emp_019",
    name: "Frances Ocampo",
    initials: "FO",
    department: "ITS",
    role: "Systems Administrator",
    description: "Maintains city servers, network, and government information systems",
    workload: 55,
    email: "f.ocampo@eflow.gov.ph",
  },
  {
    id: "emp_020",
    name: "Miguel Ramos",
    initials: "MR",
    department: "ITS",
    role: "Software Developer",
    description: "Builds and maintains internal city web applications and portals",
    workload: 70,
    email: "m.ramos@eflow.gov.ph",
  },
  {
    id: "emp_021",
    name: "Jasmine Vergara",
    initials: "JV",
    department: "ITS",
    role: "Data Analyst",
    description: "Processes city operational data and generates performance dashboards",
    workload: 40,
    email: "j.vergara@eflow.gov.ph",
  },
];

export const EMPLOYEE_SEED_BY_ID = Object.fromEntries(
  EMPLOYEE_SEED.map((employee) => [employee.id, employee])
) as Record<string, SeedEmployee>;

export const TASK_SEED: SeedTask[] = [
  {
    id: "task_001",
    title: "Road rehabilitation survey — Barangay 5",
    description: "Conduct initial survey and assessment of road conditions along Lacson Street",
    department: "EPW",
    assignedTo: "emp_004",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-05-15",
    tags: ["survey", "road", "barangay-5"],
  },
  {
    id: "task_002",
    title: "Prepare drainage improvement blueprint",
    description: "Draft technical blueprints for the drainage system upgrade in Barangay 12",
    department: "EPW",
    assignedTo: "emp_005",
    status: "todo",
    priority: "medium",
    dueDate: "2026-05-20",
    tags: ["blueprint", "drainage", "barangay-12"],
  },
  {
    id: "task_003",
    title: "Update zoning map — Barangay 7 & 8",
    description: "Revise zoning classifications based on recent land use assessments",
    department: "CPD",
    assignedTo: "emp_008",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-05-18",
    tags: ["GIS", "zoning", "barangay-7", "barangay-8"],
  },
  {
    id: "task_004",
    title: "Process 15 pending building permits",
    description: "Review and approve backlog of building permit applications from Q1",
    department: "CPD",
    assignedTo: "emp_009",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-05-10",
    tags: ["permits", "backlog", "compliance"],
  },
  {
    id: "task_005",
    title: "Q2 budget utilization report",
    description: "Compile and submit Q2 fund utilization report to the City Mayor's office",
    department: "FIN",
    assignedTo: "emp_011",
    status: "todo",
    priority: "high",
    dueDate: "2026-05-30",
    tags: ["budget", "report", "Q2"],
  },
  {
    id: "task_006",
    title: "Payroll processing — May 2026",
    description: "Process monthly payroll for all city hall members",
    department: "FIN",
    assignedTo: "emp_012",
    status: "todo",
    priority: "high",
    dueDate: "2026-05-14",
    tags: ["payroll", "monthly"],
  },
  {
    id: "task_007",
    title: "Vaccination drive — Barangay 3",
    description: "Coordinate and execute scheduled vaccination drive for children under 5",
    department: "HSW",
    assignedTo: "emp_015",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-05-12",
    tags: ["vaccination", "barangay-3", "children"],
  },
  {
    id: "task_008",
    title: "Supplemental feeding program — Barangay 9",
    description: "Distribute food packs and monitor nutritional status of beneficiary children",
    department: "HSW",
    assignedTo: "emp_017",
    status: "todo",
    priority: "medium",
    dueDate: "2026-05-22",
    tags: ["feeding", "nutrition", "barangay-9"],
  },
  {
    id: "task_009",
    title: "City portal performance dashboard",
    description: "Build and deploy a real-time performance dashboard for city services portal",
    department: "ITS",
    assignedTo: "emp_021",
    status: "in_progress",
    priority: "medium",
    dueDate: "2026-05-28",
    tags: ["dashboard", "analytics", "portal"],
  },
  {
    id: "task_010",
    title: "Network infrastructure audit",
    description: "Audit all city hall network switches, routers, and server configurations",
    department: "ITS",
    assignedTo: "emp_019",
    status: "todo",
    priority: "medium",
    dueDate: "2026-06-01",
    tags: ["network", "audit", "infrastructure"],
  },
];

export const getDepartmentLabel = (departmentId?: string) => {
  if (!departmentId) return "";
  return DEPARTMENT_SEED.find((department) => department.id === departmentId)?.name ?? departmentId;
};