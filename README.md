# Meridian Health - visit results demo

A small, self-contained slice of clinic software: what happens between the
instruments and the moment a member sees their results.

A measurement clinic collects readings from several instruments per visit -
skin imaging, hair analysis, body composition, a metabolic panel, and CGM
summaries. Before results reach a member, someone has to know the records are
complete, consistent, and traceable. This repo is that layer: it ingests raw
instrument exports, runs deterministic data-quality checks, computes
visit-over-visit trends, renders a member-facing report, and gives staff a
review queue with the exact operational reason for anything unresolved.

All data is invented. Six fictional members; five have two quarterly visits,
one has just a first visit. The pipeline checks data integrity - provenance,
completeness, units, duplicates, timestamps, trends. It deliberately makes no health judgments: no reference
ranges, no "normal/abnormal", no diagnoses, no automatic release decisions. A
person decides anything the checks cannot reconcile.

Built as a demo for a founding-engineer conversation with a clinic software
team. Not affiliated with or endorsed by anyone.

## Quickstart

Requires Node 20+. No network calls, no API keys, no services.

```sh
npm install
npm test        # engine test suite (33 tests)
npm run demo    # checks all fixtures, prints the staff review queue
npm run build   # renders the static site into out/
```

Open `out/index.html` with any static file server (for example
`npx serve out`) to browse the member reports and the staff review queue.

## What the checks cover

- **Provenance** - every export's device and export version must be in the
  registry (`fixtures/registry.json`), including section-level device metadata
  like the CGM inside a metabolic export.
- **Completeness** - every visit expects four domain exports; metabolic exports
  expect a panel and a CGM section. Anything absent is listed by name.
- **Units** - every measurement carries a unit; a unit change across visits is
  flagged. Trends across a unit change use only exact, verified conversion
  constants (listed in the registry); the original values and units are always
  preserved, and measurements without a verified constant are never converted
  or conflated.
- **Duplicates** - identical repeated readings collapse with a note; the same
  measurement with conflicting values goes to the review queue.
- **Timestamps** - a record cannot be measured after its own export was
  produced.
- **Trends** - consecutive-visit deltas per measurement, computed from
  recorded values and shown in the displayed visit's units; a measurement
  flagged with conflicting values or a timestamp problem produces no trend
  until a person resolves it.

The fixture set plants one example of each problem (see
`spec/expected_flags.json`) plus clean controls. The staff review queue should
contain exactly those five items - the test suite asserts the engine's flags
match the spec, not the other way around.

## Layout

```
fixtures/          synthetic instrument exports (JSON + one legacy CSV), registry, members
spec/              expected flags and trend assertions - the spec the tests assert
scripts/           fixture generator (deterministic; regenerates byte-identical fixtures)
src/engine/        parsers, checks, trends, pipeline (framework-free TypeScript)
src/tests/         node:test suites: parsers, checks, trends, end-to-end vs spec
app/               Next.js (App Router, static export): member reports + staff queue
data/results.json  engine output consumed by the site (generated, not committed)
```

The engine has no dependencies beyond Node and TypeScript. The site is a thin
render of the engine's output.

## Notes and limitations

- Fully deterministic: no wall clock, no randomness, same input gives
  byte-identical output. The determinism test runs the pipeline twice and
  compares.
- Error paths are tested: malformed JSON/CSV, missing metadata, wrong types and
  non-numeric values all fail with a named error identifying the file.
- Security: no network access, no eval, no dynamic code loading; file reads are
  confined to the fixture directory passed to the CLI.
- "Production ready" here means repo craft - a working quickstart, real tests,
  honest docs. It is not a claim of clinical validity; the fixtures are
  synthetic by design.
- Unit conversions only ever go through the verified constants in
  `fixtures/registry.json`. When an export switches unit systems, a little
  precision is lost to the export's own rounding; trends are computed from the
  recorded values, so the demo reports that honestly rather than hiding it.
