import type { ExportData, Measurement, Metadata, Section } from "./types.js";

export class FixtureError extends Error {
  constructor(public readonly file: string, reason: string) {
    super(`${file}: ${reason}`);
    this.name = "FixtureError";
  }
}

function reqString(obj: unknown, key: string, file: string): string {
  const v = (obj as Record<string, unknown>)?.[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new FixtureError(file, `missing or empty string field "${key}"`);
  }
  return v;
}

function parseMeasurement(raw: unknown, file: string): Measurement {
  if (typeof raw !== "object" || raw === null) {
    throw new FixtureError(file, "measurement is not an object");
  }
  const r = raw as Record<string, unknown>;
  const name = reqString(r, "name", file);
  if (typeof r.value !== "number" || !Number.isFinite(r.value)) {
    throw new FixtureError(file, `measurement "${name}" has a non-numeric value`);
  }
  const unit = reqString(r, "unit", file);
  const measuredAt = reqString(r, "measured_at", file);
  if (Number.isNaN(Date.parse(measuredAt))) {
    throw new FixtureError(file, `measurement "${name}" has an unparseable measured_at`);
  }
  return { name, value: r.value, unit, measuredAt };
}

function parseMetadata(raw: unknown, file: string): Metadata {
  if (typeof raw !== "object" || raw === null) {
    throw new FixtureError(file, "missing metadata block");
  }
  const m = raw as Record<string, unknown>;
  const exportedAt = reqString(m, "exported_at", file);
  if (Number.isNaN(Date.parse(exportedAt))) {
    throw new FixtureError(file, "unparseable exported_at in metadata");
  }
  return {
    deviceId: reqString(m, "device_id", file),
    deviceModel: typeof m.device_model === "string" ? m.device_model : null,
    exportVersion: reqString(m, "export_version", file),
    exportedAt,
    unitSystem: reqString(m, "unit_system", file),
  };
}

export function parseJsonExport(file: string, rawText: string): ExportData {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    throw new FixtureError(file, `invalid JSON (${(e as Error).message})`);
  }
  if (typeof raw !== "object" || raw === null) {
    throw new FixtureError(file, "top level is not an object");
  }
  const obj = raw as Record<string, unknown>;
  const metadata = parseMetadata(obj.metadata, file);

  const sections: Section[] = [];
  if (typeof obj.sections === "object" && obj.sections !== null) {
    for (const [name, sraw] of Object.entries(obj.sections as Record<string, unknown>)) {
      const s = sraw as Record<string, unknown>;
      if (!Array.isArray(s?.measurements)) {
        throw new FixtureError(file, `section "${name}" has no measurements array`);
      }
      sections.push({
        name,
        deviceId: typeof s.device_id === "string" ? s.device_id : null,
        exportVersion: typeof s.export_version === "string" ? s.export_version : null,
        measurements: s.measurements.map((m) => parseMeasurement(m, file)),
      });
    }
  } else if (Array.isArray(obj.measurements)) {
    sections.push({
      name: "main",
      deviceId: null,
      exportVersion: null,
      measurements: obj.measurements.map((m) => parseMeasurement(m, file)),
    });
  } else {
    throw new FixtureError(file, "no sections or measurements found");
  }

  const categorical: Record<string, string> = {};
  if (typeof obj.categorical === "object" && obj.categorical !== null) {
    for (const [k, v] of Object.entries(obj.categorical as Record<string, unknown>)) {
      if (typeof v === "string") categorical[k] = v;
    }
  }

  const parts = file.split("/");
  return {
    file,
    memberId: parts[0],
    visitDate: parts[1],
    format: "json",
    metadata,
    sections,
    categorical,
  };
}

const CSV_HEADER = [
  "member_id", "visit_date", "measured_at", "measurement",
  "value", "unit", "device_id", "export_version", "exported_at",
];

export function parseBodyCsv(file: string, rawText: string): ExportData {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new FixtureError(file, "CSV has a header but no rows");
  }
  const header = lines[0].split(",");
  if (header.join(",") !== CSV_HEADER.join(",")) {
    throw new FixtureError(file, `unexpected CSV header "${lines[0]}"`);
  }
  const measurements: Measurement[] = [];
  let deviceId: string | null = null;
  let exportVersion: string | null = null;
  let exportedAt: string | null = null;
  let memberId = "";
  let visitDate = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length !== CSV_HEADER.length) {
      throw new FixtureError(file, `row ${i + 1} has ${cols.length} columns, expected ${CSV_HEADER.length}`);
    }
    const [mid, vdate, measuredAt, name, rawValue, unit, dev, ver, exp] = cols;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new FixtureError(file, `row ${i + 1}: non-numeric value "${rawValue}"`);
    }
    if (!unit) throw new FixtureError(file, `row ${i + 1}: empty unit`);
    if (Number.isNaN(Date.parse(measuredAt))) {
      throw new FixtureError(file, `row ${i + 1}: unparseable measured_at`);
    }
    if (deviceId === null) {
      memberId = mid; visitDate = vdate; deviceId = dev; exportVersion = ver; exportedAt = exp;
    } else if (dev !== deviceId || ver !== exportVersion || exp !== exportedAt) {
      throw new FixtureError(file, `row ${i + 1}: inconsistent device metadata within file`);
    }
    measurements.push({ name, value, unit, measuredAt });
  }

  return {
    file,
    memberId,
    visitDate,
    format: "csv",
    metadata: {
      deviceId: deviceId!,
      deviceModel: null,
      exportVersion: exportVersion!,
      exportedAt: exportedAt!,
      unitSystem: "metric",
    },
    sections: [{ name: "body", deviceId: null, exportVersion: null, measurements }],
    categorical: {},
  };
}
