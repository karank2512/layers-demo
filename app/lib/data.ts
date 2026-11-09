import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Measurement {
  name: string;
  value: number;
  unit: string;
  measuredAt: string;
}

export interface Flag {
  type: string;
  file: string;
  memberId: string;
  visitDate: string;
  measurement: string | null;
  detail: string;
  values?: number[];
}

export interface DomainReport {
  domain: string;
  measurements: Measurement[];
  categorical: Record<string, string>;
}

export interface VisitReport {
  memberId: string;
  firstName: string;
  visitDate: string;
  domains: DomainReport[];
  flags: Flag[];
}

export interface TrendEntry {
  memberId: string;
  measurement: string;
  unit: string;
  unitB: string;
  visitA: string;
  visitB: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaB: number;
  converted: boolean;
}

export interface MemberResult {
  id: string;
  firstName: string;
  visits: VisitReport[];
  trends: TrendEntry[];
}

export interface Results {
  exportsChecked: number;
  members: MemberResult[];
  queue: Flag[];
  notes: string[];
}

/** data/results.json is produced by `npm run demo` (the engine CLI). */
export function loadResults(): Results {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "results.json"), "utf8"));
}

const UNIT_DISPLAY: Record<string, string> = {
  pct: "%",
  count_per_cm2: "per cm\u00B2",
  um: "\u00B5m",
};

export function prettyUnit(unit: string): string {
  return UNIT_DISPLAY[unit] ?? unit;
}

export function prettyName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/^hba1c$/, "HbA1c")
    .replace(/^hdl$/, "HDL")
    .replace(/^ldl$/, "LDL")
    .replace(/^cgm /, "CGM ");
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}
