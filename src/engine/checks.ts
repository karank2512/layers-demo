import type { ExportData, Flag, Registry } from "./types.js";

function flag(exp: ExportData, type: string, measurement: string | null, detail: string): Flag {
  return { type, file: exp.file, memberId: exp.memberId, visitDate: exp.visitDate, measurement, detail };
}

/** Device identity and export version must be known to the registry. */
export function checkProvenance(exp: ExportData, registry: Registry): Flag[] {
  const flags: Flag[] = [];
  const check = (deviceId: string, version: string, scope: string) => {
    const device = registry.devices[deviceId];
    if (!device) {
      flags.push(flag(exp, "unknown_device", null, `${scope}: device "${deviceId}" is not in the registry`));
    } else if (!device.known_export_versions.includes(version)) {
      flags.push(flag(exp, "unknown_export_version", null,
        `${scope}: ${deviceId} export version "${version}" is not in the known versions list`));
    }
  };
  check(exp.metadata.deviceId, exp.metadata.exportVersion, "file metadata");
  for (const s of exp.sections) {
    if (s.deviceId && s.exportVersion) check(s.deviceId, s.exportVersion, `section "${s.name}"`);
  }
  return flags;
}

const EXPECTED_FILES = ["skin.json", "hair.json", "body.csv", "metabolic.json"];

/** Every visit should have the four domain exports. */
export function checkMissingFiles(memberId: string, visitDate: string, present: string[]): Flag[] {
  return EXPECTED_FILES.filter((f) => !present.includes(f)).map((f) => ({
    type: "missing_file",
    file: `${memberId}/${visitDate}/${f}`,
    memberId,
    visitDate,
    measurement: null,
    detail: `expected export ${f} is absent for this visit`,
  }));
}

/** Metabolic exports carry a panel and a CGM section; others at least one section. */
export function checkMissingSections(exp: ExportData): Flag[] {
  const flags: Flag[] = [];
  const names = exp.sections.map((s) => s.name);
  if (exp.file.endsWith("metabolic.json")) {
    for (const required of ["panel", "cgm"]) {
      if (!names.includes(required)) {
        flags.push(flag(exp, "missing_section", null,
          `metabolic export is missing the "${required}" section`));
      }
    }
  } else if (exp.sections.length === 0) {
    flags.push(flag(exp, "missing_section", null, "export contains no sections"));
  }
  return flags;
}

/** Same measurement twice in one file: identical values collapse with a note, differing values conflict. */
export function checkDuplicates(exp: ExportData): { flags: Flag[]; notes: string[] } {
  const flags: Flag[] = [];
  const notes: string[] = [];
  const byName = new Map<string, number[]>();
  for (const s of exp.sections) {
    for (const m of s.measurements) {
      const list = byName.get(m.name) ?? [];
      list.push(m.value);
      byName.set(m.name, list);
    }
  }
  for (const [name, values] of byName) {
    if (values.length < 2) continue;
    const distinct = [...new Set(values)];
    if (distinct.length === 1) {
      notes.push(`${exp.file}: duplicate reading for ${name} with identical value ${distinct[0]} (collapsed)`);
    } else {
      const sorted = [...values].sort((a, b) => a - b);
      flags.push({
        ...flag(exp, "conflicting_duplicate", name,
          `two conflicting values for ${name}: ${sorted.join(" vs ")}`),
        values: sorted,
      });
    }
  }
  return { flags, notes };
}

/** A record cannot be measured after its own export was produced. */
export function checkOrdering(exp: ExportData): Flag[] {
  const flags: Flag[] = [];
  for (const s of exp.sections) {
    for (const m of s.measurements) {
      if (m.measuredAt > exp.metadata.exportedAt) {
        flags.push(flag(exp, "record_after_export", m.name,
          `${m.name} measured at ${m.measuredAt}, after the export was produced at ${exp.metadata.exportedAt}`));
      }
    }
  }
  return flags;
}

/** Units must be stable across a member's visits for the same measurement. */
export function checkUnitsAcrossVisits(prior: ExportData[], current: ExportData): Flag[] {
  const priorUnits = new Map<string, string>();
  for (const p of prior) {
    for (const s of p.sections) {
      for (const m of s.measurements) priorUnits.set(m.name, m.unit);
    }
  }
  const mismatched = new Set<string>();
  let priorSystem: string | null = null;
  for (const s of current.sections) {
    for (const m of s.measurements) {
      const prev = priorUnits.get(m.name);
      if (prev !== undefined && prev !== m.unit) mismatched.add(m.name);
    }
  }
  if (mismatched.size === 0) return [];
  const priorExp = prior.find((p) => p.file.endsWith(current.file.split("/").pop()!));
  priorSystem = priorExp ? priorExp.metadata.unitSystem : null;
  return [flag(current, "unit_mismatch_vs_prior", null,
    `unit system changed (${priorSystem ?? "unknown"} -> ${current.metadata.unitSystem}) for: ${[...mismatched].sort().join(", ")}`)];
}
