import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkProvenance,
  checkMissingFiles,
  checkMissingSections,
  checkDuplicates,
  checkOrdering,
  checkUnitsAcrossVisits,
} from "../engine/checks.js";
import type { ExportData, Registry } from "../engine/types.js";

const REGISTRY: Registry = {
  devices: {
    "SKINSCAN-01": { model: "DermaView Pro", domain: "skin", format: "json", known_export_versions: ["2.2.0"] },
  },
  unit_systems: ["metric", "si"],
  conversion_constants: { glucose_mgdl_per_mmoll: 18.016, cholesterol_mgdl_per_mmoll: 38.66, triglycerides_mgdl_per_mmoll: 88.57, cm_per_in: 2.54 },
};

function exp(overrides: Partial<ExportData> = {}): ExportData {
  return {
    file: "M-009/2026-08-01/skin.json",
    memberId: "M-009",
    visitDate: "2026-08-01",
    format: "json",
    metadata: { deviceId: "SKINSCAN-01", deviceModel: null, exportVersion: "2.2.0", exportedAt: "2026-08-01T11:05:00", unitSystem: "metric" },
    sections: [{ name: "main", deviceId: null, exportVersion: null, measurements: [{ name: "hydration_score", value: 72, unit: "score", measuredAt: "2026-08-01T09:30:00" }] }],
    categorical: {},
    ...overrides,
  };
}

test("provenance: clean export produces no flags", () => {
  assert.deepEqual(checkProvenance(exp(), REGISTRY), []);
});

test("provenance: unknown device is flagged", () => {
  const e = exp();
  e.metadata.deviceId = "MYSTERY-99";
  const flags = checkProvenance(e, REGISTRY);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "unknown_device");
});

test("provenance: unknown export version is flagged", () => {
  const e = exp();
  e.metadata.exportVersion = "9.9.9-unknown";
  const flags = checkProvenance(e, REGISTRY);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "unknown_export_version");
});

test("missing files: absent expected export is flagged", () => {
  const flags = checkMissingFiles("M-009", "2026-08-01", ["skin.json", "hair.json", "body.csv"]);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "missing_file");
  assert.ok(flags[0].file.endsWith("metabolic.json"));
});

test("missing sections: metabolic without panel is flagged", () => {
  const e = exp({ file: "M-009/2026-08-01/metabolic.json" });
  e.sections = [{ name: "cgm", deviceId: "CGM-01", exportVersion: "1.1.3", measurements: [] }];
  const flags = checkMissingSections(e);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "missing_section");
  assert.ok(flags[0].detail.includes("panel"));
});

test("duplicates: identical values collapse to a note, no flag", () => {
  const e = exp();
  e.sections[0].measurements.push({ name: "hydration_score", value: 72, unit: "score", measuredAt: "2026-08-01T09:30:00" });
  const { flags, notes } = checkDuplicates(e);
  assert.equal(flags.length, 0);
  assert.equal(notes.length, 1);
});

test("duplicates: conflicting values are flagged", () => {
  const e = exp();
  e.sections[0].measurements.push({ name: "hydration_score", value: 74, unit: "score", measuredAt: "2026-08-01T09:30:00" });
  const { flags } = checkDuplicates(e);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "conflicting_duplicate");
  assert.ok(flags[0].detail.includes("72 vs 74"));
  assert.deepEqual(flags[0].values, [72, 74]);
});

test("ordering: record after export is flagged", () => {
  const e = exp();
  e.sections[0].measurements[0].measuredAt = "2026-08-01T12:30:00";
  const flags = checkOrdering(e);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "record_after_export");
});

test("units: a unit change across visits is flagged once per file", () => {
  const prior = exp();
  const current = exp({ file: "M-009/2026-11-01/skin.json", visitDate: "2026-11-01" });
  current.sections[0].measurements[0].unit = "index";
  current.metadata.unitSystem = "si";
  const flags = checkUnitsAcrossVisits([prior], current);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].type, "unit_mismatch_vs_prior");
  assert.ok(flags[0].detail.includes("hydration_score"));
});

test("units: unchanged units produce no flags", () => {
  const prior = exp();
  const current = exp({ file: "M-009/2026-11-01/skin.json", visitDate: "2026-11-01" });
  assert.deepEqual(checkUnitsAcrossVisits([prior], current), []);
});
