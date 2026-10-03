export type DispatchUnit = {
  id: string;
  name: string;
  team: string;
  x: number;
  y: number;
  status: "active" | "idle" | "enroute";
  lastTask?: string;
  newTask?: string;
  radiusKm?: number;
};

export const INITIAL_UNITS: DispatchUnit[] = [
  {
    id: "u1",
    name: "Plumbing Crew 4",
    team: "Maintenance",
    x: 58,
    y: 42,
    status: "idle",
    lastTask: "Public Market pipe repair · closed 14:02",
    radiusKm: 1,
  },
  {
    id: "u2",
    name: "Electrical Unit 2",
    team: "Electrical",
    x: 32,
    y: 65,
    status: "active",
    lastTask: "City Hall rack install · in progress",
  },
  {
    id: "u3",
    name: "Paving Crew A",
    team: "Engineering",
    x: 75,
    y: 30,
    status: "active",
    lastTask: "Coastal Rd. KM 4.2 · base course",
  },
  {
    id: "u4",
    name: "Sanitation Team 3",
    team: "Environmental",
    x: 46,
    y: 55,
    status: "enroute",
    lastTask: "→ Brgy. Linao trash haul",
  },
  {
    id: "u5",
    name: "Welding Crew 1",
    team: "Fabrication",
    x: 22,
    y: 38,
    status: "active",
    lastTask: "Fire Station trusses",
  },
  {
    id: "u6",
    name: "Survey Team B",
    team: "Engineering",
    x: 68,
    y: 70,
    status: "idle",
    lastTask: "Drainage profile done · closed 13:50",
    radiusKm: 1.5,
  },
];

export type Ticket = {
  id: string;
  title: string;
  priority: "low" | "med";
  x: number;
  y: number;
};

export const NEARBY_TICKETS: Ticket[] = [
  {
    id: "tk1",
    title: "Reported pothole · Market Street",
    priority: "low",
    x: 62,
    y: 46,
  },
  {
    id: "tk2",
    title: "Loose manhole cover · Aviles Ave.",
    priority: "med",
    x: 72,
    y: 73,
  },
  {
    id: "tk3",
    title: "Blocked drain grate · Lopez Jaena",
    priority: "low",
    x: 40,
    y: 60,
  },
];
