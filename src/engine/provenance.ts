/**
 * Per-domain provenance for one visit, derived only from what the pipeline
 * already recorded: which domains rendered, and which flags name which file.
 * Pure presentation logic - it changes nothing the engine computes.
 *
 * States are exact:
 * - received:     the domain rendered and no flag names its export file
 * - under-review: the domain rendered, but at least one flag names its file
 * - incomplete:   the export arrived but a section inside it is absent
 *                 (missing_section) - not the same as a missing export
 * - missing:      the domain did not render at this visit at all
 */

export interface ProvenanceFlag {
  type: string;
  file: string;
}

export interface ProvenanceVisit {
  domains: { domain: string }[];
  flags: ProvenanceFlag[];
}

export type DomainState = "received" | "under-review" | "incomplete" | "missing";

export interface DomainProvenance {
  domain: string;
  state: DomainState;
  flagCount: number;
}

/** "fixtures/.../metabolic.json" -> "metabolic" */
export function fileDomain(file: string): string {
  const base = file.split("/").pop() ?? file;
  const dot = base.indexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
}

export function deriveVisitProvenance(
  expectedDomains: string[],
  visit: ProvenanceVisit,
): DomainProvenance[] {
  const present = new Set(visit.domains.map((d) => d.domain));
  return expectedDomains.map((domain) => {
    const flags = visit.flags.filter((f) => fileDomain(f.file) === domain);
    if (!present.has(domain)) return { domain, state: "missing", flagCount: 0 };
    if (flags.some((f) => f.type === "missing_section")) {
      return { domain, state: "incomplete", flagCount: flags.length };
    }
    if (flags.length > 0) return { domain, state: "under-review", flagCount: flags.length };
    return { domain, state: "received", flagCount: 0 };
  });
}
