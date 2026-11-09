# Fixtures

Everything in this directory is invented. The six members (M-001 to M-006) are
fictional; no real person or clinic is represented. The devices, models, and
export versions in `registry.json` are made up for this demo.

These files imitate raw exports from four kinds of clinic instruments: skin
imaging, hair analysis, body composition (a legacy CSV format), and a metabolic
panel with a CGM summary. They exist to exercise data-quality checks:
provenance, completeness, units, duplicates, timestamps, and trends.

The planted problems are listed in `../spec/expected_flags.json`. Regenerate
everything deterministically with:

```sh
python3 ../scripts/generate_fixtures.py
```

These fixtures check data integrity only. Nothing here supports any health
conclusion.
