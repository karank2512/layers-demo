import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseJsonExport, parseBodyCsv } from "./parse.js";
import {
  checkProvenance,
  checkMissingFiles,
  checkMissingSections,
  checkDuplicates,
  checkOrdering,
  checkUnitsAcrossVisits,
} from "./checks.js";
import { computeTrends } from "./trends.js";
import type {
  DomainReport,
  ExportData,
  Flag,
  MemberResult,
  Registry,
  Results,
  VisitReport,
} from "./types.js";

const DOMAIN_OF_FILE: Record<string, string> = {
  "skin.json": "skin",
  "hair.json": "hair",
  "body.csv": "body",
  "metabolic.json": "metabolic",
};

function domainOf(exp: ExportData): string {
  return DOMAIN_OF_FILE[exp.file.split("/").pop()!] ?? "unknown";
}

/** Full deterministic pipeline over the fixture tree. No clock, no network. */
export function analyze(fixturesDir: string): Results {
  const registry: Registry = JSON.parse(readFileSync(join(fixturesDir, "registry.json"), "utf8"));
  const membersFile = JSON.parse(readFileSync(join(fixturesDir, "members.json"), "utf8"));
  const firstNames = new Map<string, string>(
    membersFile.members.map((m: { id: string; first_name: string }) => [m.id, m.first_name]),
  );

  const members: MemberResult[] = [];
  const allFlags: Flag[] = [];
  const allNotes: string[] = [];
  let exportsChecked = 0;

  const memberIds = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("M-"))
    .map((d) => d.name)
    .sort();

  for (const memberId of memberIds) {
    const visitDates = readdirSync(join(fixturesDir, memberId), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const parsedVisits: ExportData[][] = [];
    const visitReports: VisitReport[] = [];

    for (const visitDate of visitDates) {
      const dir = join(fixturesDir, memberId, visitDate);
      const present = readdirSync(dir).filter((f) => f in DOMAIN_OF_FILE).sort();
      const exports: ExportData[] = [];
      for (const fname of present) {
        const raw = readFileSync(join(dir, fname), "utf8");
        const rel = `${memberId}/${visitDate}/${fname}`;
        exports.push(fname.endsWith(".csv") ? parseBodyCsv(rel, raw) : parseJsonExport(rel, raw));
      }
      exportsChecked += exports.length;

      const flags: Flag[] = [];
      const notes: string[] = [];
      flags.push(...checkMissingFiles(memberId, visitDate, present));
      for (const exp of exports) {
        flags.push(...checkProvenance(exp, registry));
        flags.push(...checkMissingSections(exp));
        const dup = checkDuplicates(exp);
        flags.push(...dup.flags);
        notes.push(...dup.notes);
        flags.push(...checkOrdering(exp));
        const priorVisits = parsedVisits.flat();
        if (priorVisits.length > 0) flags.push(...checkUnitsAcrossVisits(priorVisits, exp));
      }

      const domainReports: DomainReport[] = exports.map((exp) => ({
        domain: domainOf(exp),
        measurements: exp.sections.flatMap((s) => s.measurements),
        categorical: exp.categorical,
      }));

      visitReports.push({
        memberId,
        firstName: firstNames.get(memberId) ?? memberId,
        visitDate,
        domains: domainReports,
        flags: flags.filter((f) => f.file.startsWith(`${memberId}/${visitDate}/`)),
      });
      allFlags.push(...flags);
      allNotes.push(...notes);
      parsedVisits.push(exports);
    }

    // A measurement flagged with conflicting values or a timestamp problem at
    // any visit produces no trend - unresolved data gets no delta.
    const trendExcluded = new Set(
      allFlags
        .filter(
          (f) =>
            f.memberId === memberId &&
            f.measurement !== null &&
            (f.type === "conflicting_duplicate" || f.type === "record_after_export"),
        )
        .map((f) => f.measurement!),
    );

    members.push({
      id: memberId,
      firstName: firstNames.get(memberId) ?? memberId,
      visits: visitReports,
      trends: computeTrends(memberId, parsedVisits, registry.conversion_constants, trendExcluded),
    });
  }

  const queue = [...allFlags].sort(
    (a, b) => a.visitDate.localeCompare(b.visitDate) || a.file.localeCompare(b.file) || a.type.localeCompare(b.type),
  );
  return { exportsChecked, members, queue, notes: allNotes.sort() };
}
