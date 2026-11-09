import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveVisitProvenance, fileDomain } from "../engine/provenance.js";

const EXPECTED = ["body", "hair", "metabolic", "skin"];

function visit(domains: string[], flags: { type: string; file: string }[]) {
  return { domains: domains.map((domain) => ({ domain })), flags };
}

test("clean visit: every domain received", () => {
  const p = deriveVisitProvenance(EXPECTED, visit(EXPECTED, []));
  assert.deepEqual(
    p.map((d) => d.state),
    ["received", "received", "received", "received"],
  );
  assert.ok(p.every((d) => d.flagCount === 0));
});

test("flag on one domain's file marks only that domain under review", () => {
  const p = deriveVisitProvenance(
    EXPECTED,
    visit(EXPECTED, [{ type: "unit_mismatch_vs_prior", file: "fixtures/a/metabolic.json" }]),
  );
  assert.equal(p.find((d) => d.domain === "metabolic")?.state, "under-review");
  assert.equal(p.find((d) => d.domain === "metabolic")?.flagCount, 1);
  assert.equal(p.find((d) => d.domain === "skin")?.state, "received");
});

test("missing_section is incomplete, never missing: the export arrived", () => {
  const p = deriveVisitProvenance(
    EXPECTED,
    visit(EXPECTED, [{ type: "missing_section", file: "fixtures/a/metabolic.json" }]),
  );
  assert.equal(p.find((d) => d.domain === "metabolic")?.state, "incomplete");
});

test("absent domain is missing even without any flag", () => {
  const p = deriveVisitProvenance(EXPECTED, visit(["body", "hair", "skin"], []));
  assert.equal(p.find((d) => d.domain === "metabolic")?.state, "missing");
});

test("multiple flags on one file accumulate; csv stems map too", () => {
  const p = deriveVisitProvenance(
    EXPECTED,
    visit(EXPECTED, [
      { type: "conflicting_duplicate", file: "fixtures/a/body.csv" },
      { type: "record_after_export", file: "fixtures/a/body.csv" },
    ]),
  );
  assert.equal(p.find((d) => d.domain === "body")?.flagCount, 2);
});

test("flags naming non-domain files do not fabricate a domain", () => {
  const p = deriveVisitProvenance(
    EXPECTED,
    visit(EXPECTED, [{ type: "unknown_device", file: "fixtures/registry.json" }]),
  );
  assert.ok(p.every((d) => d.state === "received"));
});

test("fileDomain strips directories and extension", () => {
  assert.equal(fileDomain("fixtures/exports/M-001/2026-08-03/body.csv"), "body");
  assert.equal(fileDomain("metabolic.json"), "metabolic");
});
