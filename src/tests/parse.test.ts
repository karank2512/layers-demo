import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonExport, parseBodyCsv, FixtureError } from "../engine/parse.js";

const FILE = "M-009/2026-08-01/skin.json";

function validExport(): unknown {
  return {
    metadata: {
      device_id: "SKINSCAN-01",
      device_model: "DermaView Pro",
      export_version: "2.2.0",
      exported_at: "2026-08-01T11:05:00",
      unit_system: "metric",
    },
    measurements: [
      { name: "hydration_score", value: 72, unit: "score", measured_at: "2026-08-01T09:30:00" },
    ],
  };
}

test("valid JSON export parses", () => {
  const exp = parseJsonExport(FILE, JSON.stringify(validExport()));
  assert.equal(exp.memberId, "M-009");
  assert.equal(exp.visitDate, "2026-08-01");
  assert.equal(exp.metadata.deviceId, "SKINSCAN-01");
  assert.equal(exp.sections.length, 1);
  assert.equal(exp.sections[0].measurements[0].name, "hydration_score");
});

test("invalid JSON raises FixtureError", () => {
  assert.throws(() => parseJsonExport(FILE, "{not json"), FixtureError);
});

test("non-numeric value raises FixtureError", () => {
  const bad = validExport() as { measurements: { value: unknown }[] };
  bad.measurements[0].value = "seventy-two";
  assert.throws(() => parseJsonExport(FILE, JSON.stringify(bad)), FixtureError);
});

test("empty unit raises FixtureError", () => {
  const bad = validExport() as { measurements: { unit: string }[] };
  bad.measurements[0].unit = "";
  assert.throws(() => parseJsonExport(FILE, JSON.stringify(bad)), FixtureError);
});

test("missing metadata raises FixtureError", () => {
  const bad = validExport() as Record<string, unknown>;
  delete bad.metadata;
  assert.throws(() => parseJsonExport(FILE, JSON.stringify(bad)), FixtureError);
});

test("metabolic sections parse with section-level provenance", () => {
  const raw = {
    metadata: (validExport() as { metadata: unknown }).metadata,
    sections: {
      panel: { measurements: [{ name: "hdl", value: 55, unit: "mg/dL", measured_at: "2026-08-01T09:30:00" }] },
      cgm: {
        device_id: "CGM-01",
        export_version: "1.1.3",
        measurements: [{ name: "cgm_cv_pct", value: 18, unit: "pct", measured_at: "2026-08-01T09:34:00" }],
      },
    },
  };
  const exp = parseJsonExport("M-009/2026-08-01/metabolic.json", JSON.stringify(raw));
  assert.equal(exp.sections.length, 2);
  assert.equal(exp.sections[1].deviceId, "CGM-01");
});

const CSV = [
  "member_id,visit_date,measured_at,measurement,value,unit,device_id,export_version,exported_at",
  "M-009,2026-08-01,2026-08-01T09:30:00,weight_kg,68.0,kg,BODYCOMP-01,3.0.2,2026-08-01T11:05:00",
].join("\n");

test("valid body CSV parses", () => {
  const exp = parseBodyCsv("M-009/2026-08-01/body.csv", CSV);
  assert.equal(exp.format, "csv");
  assert.equal(exp.sections[0].measurements[0].value, 68.0);
  assert.equal(exp.metadata.deviceId, "BODYCOMP-01");
});

test("CSV with wrong header raises FixtureError", () => {
  assert.throws(() => parseBodyCsv(FILE, "a,b,c\n1,2,3"), FixtureError);
});

test("CSV with non-numeric value raises FixtureError", () => {
  const bad = CSV.replace("68.0", "abc");
  assert.throws(() => parseBodyCsv(FILE, bad), FixtureError);
});

test("CSV with inconsistent device metadata raises FixtureError", () => {
  const bad = CSV + "\nM-009,2026-08-01,2026-08-01T09:34:00,height_cm,172,cm,BODYCOMP-02,3.0.2,2026-08-01T11:05:00";
  assert.throws(() => parseBodyCsv(FILE, bad), FixtureError);
});
