import type { ExportData, Registry, TrendEntry } from "./types.js";

// Only exact, verified constants. Original units are always preserved; a
// converted value is display/trend math only, never written back.
const MMOLL_CONSTANT: Record<string, keyof Registry["conversion_constants"]> = {
  fasting_glucose: "glucose_mgdl_per_mmoll",
  total_cholesterol: "cholesterol_mgdl_per_mmoll",
  hdl: "cholesterol_mgdl_per_mmoll",
  ldl: "cholesterol_mgdl_per_mmoll",
  triglycerides: "triglycerides_mgdl_per_mmoll",
};

/**
 * Convert a value between mg/dL and mmol/L for measurements with a verified
 * constant. Returns null when no exact conversion exists - unlike assays are
 * never conflated.
 */
export function convert(
  name: string,
  value: number,
  fromUnit: string,
  toUnit: string,
  constants: Registry["conversion_constants"],
): number | null {
  if (fromUnit === toUnit) return value;
  const key = MMOLL_CONSTANT[name];
  if (!key) return null;
  const c = constants[key];
  // Round to 4 decimals so float noise never leaks into deltas or display.
  if (fromUnit === "mg/dL" && toUnit === "mmol/L") return Math.round((value / c) * 1e4) / 1e4;
  if (fromUnit === "mmol/L" && toUnit === "mg/dL") return Math.round(value * c * 1e4) / 1e4;
  return null;
}

interface Point {
  visitDate: string;
  value: number;
  unit: string;
}

/**
 * Per member: consecutive-visit deltas for every measurement seen twice.
 * Measurements in `excluded` (flagged with a conflict or a timestamp problem
 * at either endpoint) get no trend: an unresolved reading never produces an
 * authoritative-looking delta.
 */
export function computeTrends(
  memberId: string,
  visits: ExportData[][],
  constants: Registry["conversion_constants"],
  excluded: Set<string> = new Set(),
): TrendEntry[] {
  const history = new Map<string, Point[]>();
  const dates: string[] = [];
  for (const exports of visits) {
    const visitDate = exports[0]?.visitDate;
    if (!visitDate) continue;
    dates.push(visitDate);
    for (const exp of exports) {
      for (const s of exp.sections) {
        for (const m of s.measurements) {
          const list = history.get(m.name) ?? [];
          if (!list.some((p) => p.visitDate === visitDate)) {
            list.push({ visitDate, value: m.value, unit: m.unit });
          }
          history.set(m.name, list);
        }
      }
    }
  }

  const trends: TrendEntry[] = [];
  const sortedDates = [...dates].sort();
  for (let i = 1; i < sortedDates.length; i++) {
    const [dateA, dateB] = [sortedDates[i - 1], sortedDates[i]];
    for (const [name, points] of [...history.entries()].sort()) {
      if (excluded.has(name)) continue;
      const a = points.find((p) => p.visitDate === dateA);
      const b = points.find((p) => p.visitDate === dateB);
      if (!a || !b) continue;
      let bInAUnit: number | null = b.value;
      let aInBUnit: number | null = a.value;
      let converted = false;
      if (a.unit !== b.unit) {
        bInAUnit = convert(name, b.value, b.unit, a.unit, constants);
        aInBUnit = convert(name, a.value, a.unit, b.unit, constants);
        converted = bInAUnit !== null && aInBUnit !== null;
      }
      if (bInAUnit === null || aInBUnit === null) continue; // incomparable units: no trend, no conflation
      trends.push({
        memberId,
        measurement: name,
        unit: a.unit,
        unitB: b.unit,
        visitA: dateA,
        visitB: dateB,
        valueA: a.value,
        valueB: bInAUnit,
        delta: Math.round((bInAUnit - a.value) * 100) / 100,
        deltaB: Math.round((b.value - aInBUnit) * 100) / 100,
        converted,
      });
    }
  }
  return trends;
}
