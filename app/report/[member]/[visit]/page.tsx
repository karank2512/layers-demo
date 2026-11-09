import Link from "next/link";
import {
  capitalize,
  loadResults,
  prettyDate,
  prettyName,
  prettyUnit,
  shortDate,
  type TrendEntry,
} from "../../../lib/data";

export function generateStaticParams() {
  const results = loadResults();
  return results.members.flatMap((m) =>
    m.visits.map((v) => ({ member: m.id, visit: v.visitDate })),
  );
}

/**
 * Two-visit slope glyph. Direction only - rising and falling use the same
 * neutral ink, because a slope is never a judgment about health.
 */
function Spark({ delta }: { delta: number }) {
  const top = 3;
  const bottom = 13;
  const y1 = delta > 0 ? bottom : delta < 0 ? top : 8;
  const y2 = delta > 0 ? top : delta < 0 ? bottom : 8;
  return (
    <svg
      className="spark"
      width="40"
      height="16"
      viewBox="0 0 40 16"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="3" y1={y1} x2="37" y2={y2} stroke="var(--faint)" strokeWidth="1.4" />
      <circle cx="3" cy={y1} r="2" fill="var(--paper)" stroke="var(--muted)" strokeWidth="1.4" />
      <circle cx="37" cy={y2} r="2" fill="var(--muted)" />
    </svg>
  );
}

/**
 * Trend line with the only two real points labeled: the prior visit's date
 * and recorded value, then the delta to this visit. No invented history.
 */
function TrendLine({
  trend,
  isFirstVisit,
}: {
  trend: TrendEntry | undefined;
  isFirstVisit: boolean;
}) {
  if (!trend) {
    return (
      <span className="trend-none">
        {isFirstVisit ? "First recorded" : "No comparable prior"}
      </span>
    );
  }
  const arrow = trend.deltaB > 0 ? "\u2191" : trend.deltaB < 0 ? "\u2193" : "";
  return (
    <>
      <Spark delta={trend.deltaB} />
      <span className="trend-prior">
        {shortDate(trend.visitA)}: {trend.valueA} {prettyUnit(trend.unit)}
      </span>
      <span className="trend-arrow">&rarr;</span>
      <span className="trend-delta">
        {arrow} {Math.abs(trend.deltaB)} {prettyUnit(trend.unitB)}
      </span>
    </>
  );
}

function memberPhrase(f: { type: string; measurement: string | null }): string {
  const what = f.measurement ? prettyName(f.measurement) : null;
  switch (f.type) {
    case "conflicting_duplicate":
      return `Two readings for ${what} didn't match - the team is checking which one is right.`;
    case "record_after_export":
      return `One ${what} record arrived with a timestamp problem - the team is verifying it.`;
    case "unit_mismatch_vs_prior":
      return "Some results arrived in different units than last time - the team is confirming the conversion.";
    case "unknown_export_version":
    case "unknown_device":
      return "One instrument file had unrecognized version information - the team is confirming it.";
    case "missing_section":
    case "missing_file":
      return "Part of this visit's data has not arrived yet - the team is following up.";
    default:
      return "Something in this visit's data needs a human look - the team is on it.";
  }
}

export default async function Report({
  params,
}: {
  params: Promise<{ member: string; visit: string }>;
}) {
  const { member, visit } = await params;
  const results = loadResults();
  const m = results.members.find((x) => x.id === member);
  const v = m?.visits.find((x) => x.visitDate === visit);
  if (!m || !v) {
    return (
      <main>
        <Link className="back" href="/">&larr; All members</Link>
        <h1>Report not found</h1>
      </main>
    );
  }

  const isFirstVisit = v.visitDate === m.visits[0]?.visitDate;
  const trendFor = (name: string) =>
    m.trends.find((t) => t.measurement === name && t.visitB === v.visitDate);

  // A flagged measurement renders once even if the raw export repeated it.
  const renderedHeld = new Set<string>();

  // Measurements with an unresolved data-quality flag at this visit show
  // their status instead of an authoritative-looking value and trend.
  const unresolved = new Map(
    v.flags
      .filter((f) => f.measurement !== null)
      .map((f) => [f.measurement as string, f]),
  );

  return (
    <main>
      <Link className="back" href="/">&larr; All members</Link>

      <div className="report-layout">
        <aside className="report-side">
          <p className="kicker">Member report</p>
          <p className="side-name">{m.firstName}</p>
          <p className="side-date">{prettyDate(v.visitDate)}</p>
          <p className="side-baseline">
            {isFirstVisit
              ? "First visit - no prior baseline."
              : `Compared with ${prettyDate(m.visits[0].visitDate)}.`}
          </p>

          <ul className="side-nav">
            {v.domains.map((d) => (
              <li key={d.domain}>
                <a href={`#domain-${d.domain}`}>
                  {capitalize(d.domain)}
                  <span className="side-count">{d.measurements.length}</span>
                </a>
              </li>
            ))}
          </ul>

          {v.flags.length > 0 && (
            <a className="side-held" href="#being-checked">
              {v.flags.length} {v.flags.length === 1 ? "item" : "items"} being checked by
              the team
            </a>
          )}
        </aside>

        <div>
          {v.flags.length > 0 && (
            <div className="held" id="being-checked">
              <p className="held-title">Being checked by the team</p>
              <ul>
                {v.flags.map((f, i) => (
                  <li key={i}>{memberPhrase(f)}</li>
                ))}
              </ul>
            </div>
          )}

          {v.domains.map((d) => (
            <section className="domain" id={`domain-${d.domain}`} key={d.domain}>
              <div className="domain-head">
                <span className="domain-name">{capitalize(d.domain)}</span>
                <span className="domain-count">
                  {d.measurements.length} measurements
                </span>
              </div>
              {d.measurements.map((meas, i) => {
                const held = unresolved.get(meas.name);
                if (held && renderedHeld.has(d.domain + meas.name)) return null;
                if (held) renderedHeld.add(d.domain + meas.name);
                const trend = held ? undefined : trendFor(meas.name);
                return (
                  <div className="measure" key={i}>
                    <span className="measure-name">{prettyName(meas.name)}</span>
                    <span className="measure-value-wrap">
                      <span className="measure-value">
                        {held?.type === "conflicting_duplicate" && held.values
                          ? held.values.join(" / ")
                          : meas.value}
                      </span>
                      <span className="measure-unit">{prettyUnit(meas.unit)}</span>
                      {held && <span className="tag">being checked</span>}
                    </span>
                    <span className="measure-trend">
                      {held ? (
                        <span className="trend-none">Under review</span>
                      ) : (
                        <TrendLine trend={trend} isFirstVisit={isFirstVisit} />
                      )}
                    </span>
                  </div>
                );
              })}
              {d.measurements.some((meas) => trendFor(meas.name)?.converted) && (
                <p className="categorical">
                  Some values were converted to compare across visits; the original units
                  are kept as recorded.
                </p>
              )}
              {Object.keys(d.categorical).length > 0 && (
                <p className="categorical">
                  {Object.entries(d.categorical)
                    .map(([k, val]) => `${prettyName(k)}: ${val}`)
                    .join(" - ")}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>

      <footer>
        Synthetic demo data. Values describe a fictional person; trends are arithmetic on
        recorded values, not health assessments.
      </footer>
    </main>
  );
}
