import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../engine/analyze.js";
import type { Flag } from "../engine/types.js";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "fixtures");

interface SpecCase {
  file: string;
  flags: { type: string; [k: string]: unknown }[];
}

const spec: { cases: SpecCase[] } = JSON.parse(
  readFileSync(join(ROOT, "spec", "expected_flags.json"), "utf8"),
);

function key(f: Pick<Flag, "file" | "type">): string {
  return `${f.file}::${f.type}`;
}

test("end to end: engine flags match the fixture spec exactly", () => {
  const results = analyze(FIXTURES);

  const actual = new Map<string, Flag>();
  for (const f of results.queue) {
    const k = key(f);
    assert.ok(!actual.has(k), `duplicate engine flag ${k}`);
    actual.set(k, f);
  }

  const expected = new Set<string>();
  for (const c of spec.cases) {
    for (const f of c.flags) expected.add(`${c.file}::${f.type}`);
  }

  for (const k of expected) {
    assert.ok(actual.has(k), `expected flag missing from engine output: ${k}`);
  }
  for (const k of actual.keys()) {
    assert.ok(expected.has(k), `unexpected engine flag: ${k}`);
  }
});

test("end to end: every export file is checked and clean files stay clean", () => {
  const results = analyze(FIXTURES);
  assert.equal(results.exportsChecked, 44);
  const flaggedFiles = new Set(results.queue.map((f) => f.file));
  const specFiles = new Set(spec.cases.filter((c) => c.flags.length > 0).map((c) => c.file));
  assert.deepEqual(flaggedFiles, specFiles);
});

test("end to end: planted-case details are reported in operational language", () => {
  const results = analyze(FIXTURES);
  const byType = (t: string) => results.queue.filter((f) => f.type === t);

  const conflict = byType("conflicting_duplicate");
  assert.equal(conflict.length, 1);
  assert.ok(conflict[0].detail.includes("66.8") && conflict[0].detail.includes("68.5"));

  const units = byType("unit_mismatch_vs_prior");
  assert.equal(units.length, 1);
  assert.ok(units[0].detail.includes("fasting_glucose"));

  const ordering = byType("record_after_export");
  assert.equal(ordering.length, 1);
  assert.ok(ordering[0].detail.includes("uv_spots_count"));

  const provenance = byType("unknown_export_version");
  assert.equal(provenance.length, 1);
  assert.ok(provenance[0].detail.includes("9.9.9-unknown"));

  const missing = byType("missing_section");
  assert.equal(missing.length, 1);
  assert.ok(missing[0].detail.includes("panel"));
});

test("end to end: trend assertions from the spec hold", () => {
  const results = analyze(FIXTURES);
  const specTrends = JSON.parse(readFileSync(join(ROOT, "spec", "trend_assertions.json"), "utf8"));

  for (const a of specTrends.assertions) {
    const member = results.members.find((m) => m.id === a.member);
    assert.ok(member, `member ${a.member} missing`);
    const trend = member.trends.find(
      (t) => t.measurement === a.measurement && t.visitA === a.visits[0] && t.visitB === a.visits[1],
    );
    assert.ok(trend, `trend missing for ${a.member} ${a.measurement}`);
    assert.equal(trend.delta, a.expected_delta, `delta for ${a.member} ${a.measurement}`);
  }

  const glucose = results.members
    .find((m) => m.id === "M-001")!
    .trends.find((t) => t.measurement === "fasting_glucose")!;
  assert.equal(glucose.converted, true);
  assert.equal(glucose.unit, "mg/dL");
  assert.equal(glucose.unitB, "mmol/L");
});

test("end to end: unresolved measurements produce no trend at either visit", () => {
  const results = analyze(FIXTURES);
  const m3 = results.members.find((m) => m.id === "M-003")!;
  assert.ok(!m3.trends.some((t) => t.measurement === "weight"), "conflicted weight must have no trend");
  const m5 = results.members.find((m) => m.id === "M-005")!;
  assert.ok(!m5.trends.some((t) => t.measurement === "uv_spots_count"), "timestamp-flagged reading must have no trend");
});

test("end to end: the pipeline is deterministic", () => {
  const a = JSON.stringify(analyze(FIXTURES));
  const b = JSON.stringify(analyze(FIXTURES));
  assert.equal(a, b);
});
