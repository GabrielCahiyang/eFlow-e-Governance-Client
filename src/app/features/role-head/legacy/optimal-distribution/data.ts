export type FieldWorker = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  license?: string;
  distanceKm: number;
  fatigue: "low" | "medium" | "high";
  gpsZone: string;
};

export type DeployTask = {
  id: string;
  name: string;
  required: string;
  site: string;
  priority: "P1" | "P2" | "P3";
};

export const FIELD: FieldWorker[] = [
  {
    id: "f1",
    name: "Engr. Ronnie Bautista",
    role: "Heavy Equip. Operator",
    skills: ["Concrete", "Operator"],
    license: "Heavy Equipment License",
    distanceKm: 2,
    fatigue: "low",
    gpsZone: "Coastal Rd. · KM 4",
  },
  {
    id: "f2",
    name: "Mr. Julius Cabahug",
    role: "Foreman",
    skills: ["Concrete", "Labor"],
    distanceKm: 3,
    fatigue: "medium",
    gpsZone: "Eco-Park Site",
  },
  {
    id: "f3",
    name: "Mr. Rey Ocenar",
    role: "Laborer",
    skills: ["Labor", "Excavation"],
    distanceKm: 1,
    fatigue: "low",
    gpsZone: "Eco-Park Site",
  },
  {
    id: "f4",
    name: "Engr. Fe Manlangit",
    role: "Site Engineer",
    skills: ["QA/QC", "Survey"],
    distanceKm: 5,
    fatigue: "low",
    gpsZone: "Plaza Cancion",
  },
  {
    id: "f5",
    name: "Mr. Dominador Paclibar",
    role: "Welder",
    skills: ["Welding"],
    distanceKm: 7,
    fatigue: "medium",
    gpsZone: "City Motorpool",
  },
  {
    id: "f6",
    name: "Ms. Lourdes Anunciado",
    role: "Surveyor",
    skills: ["Survey"],
    distanceKm: 4,
    fatigue: "low",
    gpsZone: "Brgy. Linao",
  },
  {
    id: "f7",
    name: "Mr. Jerome Solis",
    role: "Laborer",
    skills: ["Labor", "Plumbing"],
    distanceKm: 6,
    fatigue: "high",
    gpsZone: "Public Market",
  },
  {
    id: "f8",
    name: "Engr. Darwin Patriarca",
    role: "Electrical Engineer",
    skills: ["Electrical", "ICT"],
    distanceKm: 3,
    fatigue: "low",
    gpsZone: "City Hall",
  },
  {
    id: "f9",
    name: "Mr. Pastor Egar",
    role: "Foreman",
    skills: ["Concrete", "Labor"],
    distanceKm: 4,
    fatigue: "medium",
    gpsZone: "Fire Station Annex",
  },
  {
    id: "f10",
    name: "Mr. Vicente Laurel",
    role: "Heavy Equip. Operator",
    skills: ["Operator"],
    license: "Heavy Equipment License",
    distanceKm: 8,
    fatigue: "low",
    gpsZone: "City Motorpool",
  },
  {
    id: "f11",
    name: "Ms. Rhea Caranay",
    role: "Laborer",
    skills: ["Labor"],
    distanceKm: 2,
    fatigue: "low",
    gpsZone: "Eco-Park Site",
  },
  {
    id: "f12",
    name: "Mr. Allan Arcenas",
    role: "Electrician",
    skills: ["Electrical"],
    distanceKm: 3,
    fatigue: "medium",
    gpsZone: "City Hall",
  },
];

export const TASKS: DeployTask[] = [
  {
    id: "t1",
    name: "Coastal Road Paving · KM 4.2",
    required: "Operator",
    site: "Coastal Rd.",
    priority: "P1",
  },
  {
    id: "t2",
    name: "Eco-Park Concrete Pouring",
    required: "Concrete",
    site: "Eco-Park",
    priority: "P1",
  },
  {
    id: "t3",
    name: "Plaza Formwork QA Inspection",
    required: "QA/QC",
    site: "Plaza Cancion",
    priority: "P2",
  },
  {
    id: "t4",
    name: "Drainage Survey · Brgy. Linao",
    required: "Survey",
    site: "Brgy. Linao",
    priority: "P2",
  },
  {
    id: "t5",
    name: "Fire Station Foundation Labor",
    required: "Labor",
    site: "Fire Station",
    priority: "P1",
  },
  {
    id: "t6",
    name: "City Hall ICT Rack Install",
    required: "Electrical",
    site: "City Hall",
    priority: "P3",
  },
];
