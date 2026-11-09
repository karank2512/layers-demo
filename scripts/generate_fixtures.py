#!/usr/bin/env python3
"""Generate the synthetic fixture exports for the Layers demo.

All data is invented. Deterministic by construction: no RNG, no clock, no
network. Re-running regenerates byte-identical files. Planted data-quality
cases are listed in SPEC_CASES and mirrored in spec/expected_flags.json;
tests assert against that spec, not against this script's implementation.
"""

import csv
import json
import os
import shutil

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FIXTURES = os.path.join(ROOT, "fixtures")
SPEC = os.path.join(ROOT, "spec")

MEMBERS = [
    {"id": "M-001", "first_name": "Alex"},
    {"id": "M-002", "first_name": "Jordan"},
    {"id": "M-003", "first_name": "Sam"},
    {"id": "M-004", "first_name": "Riley"},
    {"id": "M-005", "first_name": "Casey"},
    {"id": "M-006", "first_name": "Morgan"},
]

DEVICES = {
    "skin": {"device_id": "SKINSCAN-01", "model": "DermaView Pro", "version": "2.2.0"},
    "hair": {"device_id": "HAIRSCAN-01", "model": "FollicleScope", "version": "1.4.0"},
    "body": {"device_id": "BODYCOMP-01", "model": "CompStation Legacy", "version": "3.0.2"},
    "metabolic": {"device_id": "METAB-01", "model": "PanelBridge", "version": "4.5.1"},
    "cgm": {"device_id": "CGM-01", "model": "GlucoTrace", "version": "1.1.3"},
}

REGISTRY = {
    "devices": {
        "SKINSCAN-01": {"model": "DermaView Pro", "domain": "skin", "format": "json",
                         "known_export_versions": ["2.1.0", "2.2.0"]},
        "HAIRSCAN-01": {"model": "FollicleScope", "domain": "hair", "format": "json",
                         "known_export_versions": ["1.4.0"]},
        "BODYCOMP-01": {"model": "CompStation Legacy", "domain": "body", "format": "csv",
                         "known_export_versions": ["3.0.2"]},
        "METAB-01": {"model": "PanelBridge", "domain": "metabolic", "format": "json",
                      "known_export_versions": ["4.5.1"]},
        "CGM-01": {"model": "GlucoTrace", "domain": "metabolic", "format": "json",
                    "known_export_versions": ["1.1.3"]},
    },
    "unit_systems": ["metric", "si"],
    "conversion_constants": {
        "glucose_mgdl_per_mmoll": 18.016,
        "cholesterol_mgdl_per_mmoll": 38.66,
        "triglycerides_mgdl_per_mmoll": 88.57,
        "cm_per_in": 2.54,
    },
}

# (name, base, per-member step, visit-B delta, unit, decimals)
SKIN = [
    ("hydration_score", 72, 3.0, 4.0, "score", 0),
    ("elasticity_score", 68, 2.5, 3.0, "score", 0),
    ("pigmentation_evenness", 75, 2.0, 2.0, "score", 0),
    ("fine_lines_score", 60, 3.0, -1.0, "score", 0),
    ("redness_index", 25, 2.0, -3.0, "index", 0),
    ("uv_spots_count", 40, 5.0, 1.0, "count", 0),
    ("pore_visibility", 55, 2.5, 2.0, "score", 0),
    ("facial_symmetry_score", 88, 1.0, 0.5, "score", 1),
    ("lip_moisture", 65, 3.0, 5.0, "score", 0),
    ("texture_smoothness", 70, 2.5, 3.0, "score", 0),
]

HAIR = [
    ("scalp_density", 180, 8.0, 2.0, "count_per_cm2", 0),
    ("fiber_diameter", 65, 3.0, 0.4, "um", 1),
    ("breakage_index", 30, 2.0, -2.0, "index", 0),
    ("shine_score", 70, 2.5, 3.0, "score", 0),
    ("scalp_redness_index", 20, 1.5, -1.0, "index", 0),
]

BODY = [
    ("weight", 68, 2.5, -0.6, "kg", 1),
    ("body_fat", 22, 1.2, -0.4, "pct", 1),
    ("skeletal_muscle", 28, 1.5, 0.3, "kg", 1),
    ("visceral_fat_level", 8, 0.7, 0.0, "level", 0),
    ("resting_heart_rate", 62, 2.0, -1.0, "bpm", 0),
    ("systolic_blood_pressure", 118, 3.0, -2.0, "mmHg", 0),
    ("diastolic_blood_pressure", 76, 2.0, -1.0, "mmHg", 0),
    ("height", 172, 4.0, 0.0, "cm", 0),
]

PANEL = [
    ("fasting_glucose", 88, 2.0, -1.0, "mg/dL", 0),
    ("total_cholesterol", 175, 5.0, 2.0, "mg/dL", 0),
    ("hdl", 55, 2.0, 1.0, "mg/dL", 0),
    ("ldl", 105, 3.0, 1.0, "mg/dL", 0),
    ("triglycerides", 95, 4.0, -3.0, "mg/dL", 0),
    ("hba1c", 5.3, 0.05, 0.0, "pct", 2),  # displayed as HbA1c
]

CGM = [
    ("cgm_mean_glucose", 95, 2.0, -1.0, "mg/dL", 0),
    ("cgm_time_in_range", 82, 1.5, 2.0, "pct", 0),
    ("cgm_variability", 18, 0.8, -0.5, "pct", 1),
]

UNDERTONES = ["warm", "cool", "neutral", "warm", "cool", "neutral"]
COLOR_SEASONS = ["autumn", "winter", "spring", "autumn", "summer", "spring"]

# Lipid/glucose measurements that have a verified exact conversion constant.
MMOLL_CONVERTIBLE = {
    "fasting_glucose": "glucose_mgdl_per_mmoll",
    "total_cholesterol": "cholesterol_mgdl_per_mmoll",
    "hdl": "cholesterol_mgdl_per_mmoll",
    "ldl": "cholesterol_mgdl_per_mmoll",
    "triglycerides": "triglycerides_mgdl_per_mmoll",
}


def visit_dates(i):
    a = "2026-08-%02d" % (3 + i)
    b = "2026-11-%02d" % (3 + i)
    return a, b


def value(base, step, delta, i, is_b, decimals):
    v = base + step * (i - 2.5) + (delta if is_b else 0.0)
    if decimals == 0:
        return int(round(v))
    return round(v, decimals)


def measured_at(visit_date, idx):
    minute = 30 + 4 * idx
    return "%sT%02d:%02d:00" % (visit_date, 9 + (minute // 60), minute % 60)


def metadata(domain, visit_date, unit_system="metric", device=None):
    d = device or DEVICES[domain]
    return {
        "device_id": d["device_id"],
        "device_model": d["model"],
        "export_version": d["version"],
        "exported_at": "%sT11:05:00" % visit_date,
        "unit_system": unit_system,
    }


def rows(table, i, is_b, visit_date):
    out = []
    for idx, (name, base, step, delta, unit, dec) in enumerate(table):
        out.append({
            "name": name,
            "value": value(base, step, delta, i, is_b, dec),
            "unit": unit,
            "measured_at": measured_at(visit_date, idx),
        })
    return out


def write_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, sort_keys=False)
        f.write("\n")


def build_member(i, member, spec_cases):
    mid = member["id"]
    date_a, date_b = visit_dates(i)
    visits = [("A", date_a)]
    if mid != "M-006":  # M-006: first visit only, exercises the no-baseline path
        visits.append(("B", date_b))

    for label, date in visits:
        is_b = label == "B"
        vdir = os.path.join(FIXTURES, mid, date)
        os.makedirs(vdir, exist_ok=True)

        # --- skin (JSON) ---
        skin = {"metadata": metadata("skin", date), "measurements": rows(SKIN, i, is_b, date)}
        skin["categorical"] = {
            "color_undertone": UNDERTONES[i],
            "color_season": COLOR_SEASONS[i],
        }
        if mid == "M-005" and label == "A":
            # Planted case 5: one record timestamped after the export's own exported_at.
            for m in skin["measurements"]:
                if m["name"] == "uv_spots_count":
                    m["measured_at"] = "%sT12:30:00" % date
            spec_cases.append({
                "file": "%s/%s/skin.json" % (mid, date),
                "flags": [{"type": "record_after_export", "measurement": "uv_spots_count",
                            "measured_at": "%sT12:30:00" % date,
                            "exported_at": "%sT11:05:00" % date}],
            })
        write_json(os.path.join(vdir, "skin.json"), skin)

        # --- hair (JSON) ---
        hair_meta = metadata("hair", date)
        if mid == "M-004" and label == "B":
            # Planted case 4: export version not in the known registry.
            hair_meta["export_version"] = "9.9.9-unknown"
            spec_cases.append({
                "file": "%s/%s/hair.json" % (mid, date),
                "flags": [{"type": "unknown_export_version", "device_id": "HAIRSCAN-01",
                            "export_version": "9.9.9-unknown"}],
            })
        write_json(os.path.join(vdir, "hair.json"),
                   {"metadata": hair_meta, "measurements": rows(HAIR, i, is_b, date)})

        # --- body (legacy CSV, metadata repeated per row) ---
        body_rows = rows(BODY, i, is_b, date)
        if mid == "M-003" and label == "A":
            # Planted case 2: same measurement twice, conflicting values.
            dup = dict(body_rows[0])
            dup["value"] = round(body_rows[0]["value"] + 1.7, 1)
            body_rows.append(dup)
            spec_cases.append({
                "file": "%s/%s/body.csv" % (mid, date),
                "flags": [{"type": "conflicting_duplicate", "measurement": "weight",
                            "values": sorted([body_rows[0]["value"], dup["value"]])}],
            })
        body_path = os.path.join(vdir, "body.csv")
        with open(body_path, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["member_id", "visit_date", "measured_at", "measurement",
                        "value", "unit", "device_id", "export_version", "exported_at"])
            for m in body_rows:
                w.writerow([mid, date, m["measured_at"], m["name"], m["value"], m["unit"],
                            DEVICES["body"]["device_id"], DEVICES["body"]["version"],
                            "%sT11:05:00" % date])

        # --- metabolic (JSON: panel + CGM section with its own provenance) ---
        unit_system = "metric"
        panel_rows = rows(PANEL, i, is_b, date)
        if mid == "M-001" and label == "B":
            # Planted case 3: this export switched to SI units while visit A was metric.
            unit_system = "si"
            converted = []
            for m in panel_rows:
                key = MMOLL_CONVERTIBLE.get(m["name"])
                if key:
                    m["value"] = round(m["value"] / REGISTRY["conversion_constants"][key], 2)
                    m["unit"] = "mmol/L"
                    converted.append(m["name"])
            spec_cases.append({
                "file": "%s/%s/metabolic.json" % (mid, date),
                "flags": [{"type": "unit_mismatch_vs_prior", "unit_system": "si",
                            "prior_unit_system": "metric", "measurements": converted}],
            })
        metabolic = {
            "metadata": metadata("metabolic", date, unit_system=unit_system),
            "sections": {
                "panel": {"measurements": panel_rows},
                "cgm": {
                    "device_id": DEVICES["cgm"]["device_id"],
                    "device_model": DEVICES["cgm"]["model"],
                    "export_version": DEVICES["cgm"]["version"],
                    "measurements": rows(CGM, i, is_b, date),
                },
            },
        }
        if mid == "M-002" and label == "B":
            # Planted case 1: biomarker panel section absent from the export.
            del metabolic["sections"]["panel"]
            spec_cases.append({
                "file": "%s/%s/metabolic.json" % (mid, date),
                "flags": [{"type": "missing_section", "domain": "metabolic", "section": "panel"}],
            })
        write_json(os.path.join(vdir, "metabolic.json"), metabolic)

        if mid == "M-002" and label == "A":
            # Planted case 6: clean control - explicitly zero flags expected.
            for fname in ("skin.json", "hair.json", "body.csv", "metabolic.json"):
                spec_cases.append({"file": "%s/%s/%s" % (mid, date, fname), "flags": []})


def trend_assertions():
    """A few exact cross-visit expectations tests can assert."""
    out = []
    for i, member in enumerate(MEMBERS[:5]):
        mid = member["id"]
        date_a, date_b = visit_dates(i)
        out.append({
            "member": mid, "visits": [date_a, date_b],
            "measurement": "hydration_score",
            "expected_delta": 4.0, "unit": "score",
        })
    # M-001 glucose trend crosses unit systems: metric -> si. The SI export
    # stores 2 decimals, so the converted-back delta carries that rounding:
    # the expected delta is computed from the recorded values, not the ideal ones.
    i = 0
    a = value(88, 2.0, -1.0, i, False, 0)
    b_mgdl = value(88, 2.0, -1.0, i, True, 0)
    c = REGISTRY["conversion_constants"]["glucose_mgdl_per_mmoll"]
    b_mmoll = round(b_mgdl / c, 2)
    expected_delta = round((b_mmoll * c - a) * 100) / 100
    out.append({
        "member": "M-001", "visits": list(visit_dates(0)),
        "measurement": "fasting_glucose",
        "visit_a": {"value": a, "unit": "mg/dL"},
        "visit_b": {"value": b_mmoll, "unit": "mmol/L"},
        "expected_delta": expected_delta, "unit": "mg/dL",
        "note": "delta computed after verified conversion; original units preserved in display",
    })
    return out


def main():
    if os.path.exists(FIXTURES):
        shutil.rmtree(FIXTURES)
    os.makedirs(FIXTURES)
    os.makedirs(SPEC, exist_ok=True)

    write_json(os.path.join(FIXTURES, "registry.json"), REGISTRY)
    write_json(os.path.join(FIXTURES, "members.json"), {
        "note": "All members are invented. No real person is represented.",
        "members": MEMBERS,
    })

    spec_cases = []
    for i, member in enumerate(MEMBERS):
        build_member(i, member, spec_cases)

    write_json(os.path.join(SPEC, "expected_flags.json"), {
        "note": "Spec, not implementation: every file NOT listed here is expected clean.",
        "cases": sorted(spec_cases, key=lambda c: c["file"]),
    })
    write_json(os.path.join(SPEC, "trend_assertions.json"), {"assertions": trend_assertions()})

    count = sum(len(files) for _, _, files in os.walk(FIXTURES))
    print("generated %d fixture files, %d spec cases" % (count, len(spec_cases)))


if __name__ == "__main__":
    main()
