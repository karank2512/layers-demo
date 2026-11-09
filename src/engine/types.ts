export interface Measurement {
  name: string;
  value: number;
  unit: string;
  measuredAt: string;
}

export interface Section {
  name: string;
  deviceId: string | null;
  exportVersion: string | null;
  measurements: Measurement[];
}

export interface Metadata {
  deviceId: string;
  deviceModel: string | null;
  exportVersion: string;
  exportedAt: string;
  unitSystem: string;
}

export interface ExportData {
  file: string;
  memberId: string;
  visitDate: string;
  format: "json" | "csv";
  metadata: Metadata;
  sections: Section[];
  categorical: Record<string, string>;
}

export interface RegistryDevice {
  model: string;
  domain: string;
  format: string;
  known_export_versions: string[];
}

export interface Registry {
  devices: Record<string, RegistryDevice>;
  unit_systems: string[];
  conversion_constants: Record<string, number>;
}

export interface Flag {
  type: string;
  file: string;
  memberId: string;
  visitDate: string;
  measurement: string | null;
  detail: string;
  /** For conflicting_duplicate: the conflicting recorded values, sorted. */
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
  /** Unit of visit A's recorded value (the delta basis). */
  unit: string;
  /** Unit of visit B's recorded value, and of deltaB. */
  unitB: string;
  visitA: string;
  visitB: string;
  valueA: number;
  /** Visit B's value expressed in visit A's units. */
  valueB: number;
  /** valueB - valueA, in visit A's units. */
  delta: number;
  /** Visit B's recorded value minus visit A's value in visit B's units. */
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
