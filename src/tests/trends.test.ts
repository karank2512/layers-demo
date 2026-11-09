import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, computeTrends } from "../engine/trends.js";
import type { ExportData } from "../engine/types.js";

const CONSTANTS = {
  glucose_mgdl_per_mmoll: 18.016,
  cholesterol_mgdl_per_mmoll: 38.66,
  triglycerides_mgdl_per_mmoll: 88.57,
  cm_per_in: 2.54,
};

test("conversion constants: glucose mg/dL to mmol/L is exact", () => {
  assert.equal(convert("fasting_glucose", 90.08, "mg/dL", "mmol/L", CONSTANTS), 5);
  assert.equal(convert("fasting_glucose", 5, "mmol/L", "mg/dL", CONSTANTS), 90.08);
});

test("conversion: same unit passes through", () => {
  assert.equal(convert("hdl", 55, "mg/dL", "mg/dL", CONSTANTS), 55);
});

test("conversion: measurement without a verified constant returns null", () => {
  assert.equal(convert("hydration_score", 72, "score", "index", CONSTANTS), null);
  assert.equal(convert("weight_kg", 70, "kg", "lb", CONSTANTS), null);
});

function visit(memberId: string, date: string, name: string, value: number, unit: string): ExportData[] {
  return [{
    file: `${memberId}/${date}/skin.json`,
    memberId,
    visitDate: date,
    format: "json",
    metadata: { deviceId: "SKINSCAN-01", deviceModel: null, exportVersion: "2.2.0", exportedAt: `${date}T11:05:00`, unitSystem: "metric" },
    sections: [{ name: "main", deviceId: null, exportVersion: null, measurements: [{ name, value, unit, measuredAt: `${date}T09:30:00` }] }],
    categorical: {},
  }];
}

test("trends: same-unit delta across two visits", () => {
  const trends = computeTrends("M-009", [
    visit("M-009", "2026-08-01", "hydration_score", 72, "score"),
    visit("M-009", "2026-11-01", "hydration_score", 76, "score"),
  ], CONSTANTS);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].delta, 4);
  assert.equal(trends[0].converted, false);
});

test("trends: cross-unit delta uses the verified conversion and reports in the first unit", () => {
  const trends = computeTrends("M-009", [
    visit("M-009", "2026-08-01", "fasting_glucose", 90.08, "mg/dL"),
    visit("M-009", "2026-11-01", "fasting_glucose", 4.9, "mmol/L"),
  ], CONSTANTS);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].converted, true);
  assert.ok(Math.abs(trends[0].delta - (4.9 * 18.016 - 90.08)) < 0.01);
  assert.equal(trends[0].unit, "mg/dL");
});

test("trends: incomparable units produce no trend and no conflation", () => {
  const trends = computeTrends("M-009", [
    visit("M-009", "2026-08-01", "hydration_score", 72, "score"),
    visit("M-009", "2026-11-01", "hydration_score", 5, "index"),
  ], CONSTANTS);
  assert.equal(trends.length, 0);
});

test("trends: a member with one visit has no trends", () => {
  const trends = computeTrends("M-009", [visit("M-009", "2026-08-01", "hydration_score", 72, "score")], CONSTANTS);
  assert.equal(trends.length, 0);
});
