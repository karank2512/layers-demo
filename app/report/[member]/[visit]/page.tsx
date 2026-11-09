import Link from "next/link";
import { loadResults, prettyDate, prettyName, prettyUnit, type TrendEntry } from "../../../lib/data";

export function generateStaticParams() {
  const results = loadResults();
  return results.members.flatMap((m) =>
    m.visits.map((v) => ({ member: m.id, visit: v.visitDate })),
  );
}

function Delta({ trend }: { trend: TrendEntry | undefined }) {
  if (!trend) return <td className="num"><span className="delta flat">-</span></td>;
  const cls = trend.deltaB > 0 ? "up" : trend.deltaB < 0 ? "down" : "flat";
  const arrow = trend.deltaB > 0 ? "\u2191" : trend.deltaB < 0 ? "\u2193" : "";
  return (
    <td className="num">
      <span className={`delta ${cls}`}>
        {arrow} {Math.abs(trend.deltaB)} {prettyUnit(trend.unitB)}
      </span>
    </td>
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
      <p className="wordmark">Meridian Health - synthetic demo</p>
      <h1>{m.firstName}</h1>
      <p className="visit-date">{prettyDate(v.visitDate)}</p>
      {isFirstVisit ? (
        <p className="baseline-note">First visit - no prior baseline to compare against.</p>
      ) : (
        <p className="baseline-note">Compared with {prettyDate(m.visits[0].visitDate)}.</p>
      )}

      {v.flags.length > 0 && (
        <div className="held">
          <p className="held-title">Being checked by the team</p>
          <ul>
            {v.flags.map((f, i) => (
              <li key={i}>{memberPhrase(f)}</li>
            ))}
          </ul>
        </div>
      )}

      {v.domains.map((d) => (
        <section key={d.domain}>
          <h2>{d.domain}</h2>
          <table>
            <tbody>
              {d.measurements.map((meas, i) => {
                const held = unresolved.get(meas.name);
                if (held && renderedHeld.has(d.domain + meas.name)) return null;
                if (held) renderedHeld.add(d.domain + meas.name);
                return (
                  <tr key={i}>
                    <td className="measure-name">{prettyName(meas.name)}</td>
                    <td className="num">
                      {held?.type === "conflicting_duplicate" && held.values ? (
                        <>
                          <span className="measure-value">
                            {held.values.join(" / ")}
                          </span>
                          <span className="measure-unit">{prettyUnit(meas.unit)}</span>
                          <span className="tag">being checked</span>
                        </>
                      ) : held ? (
                        <>
                          <span className="measure-value">{meas.value}</span>
                          <span className="measure-unit">{prettyUnit(meas.unit)}</span>
                          <span className="tag">being checked</span>
                        </>
                      ) : (
                        <>
                          <span className="measure-value">{meas.value}</span>
                          <span className="measure-unit">{prettyUnit(meas.unit)}</span>
                        </>
                      )}
                    </td>
                    {held ? (
                      <td className="num"><span className="delta flat">-</span></td>
                    ) : (
                      <Delta trend={trendFor(meas.name)} />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {d.measurements.some((meas) => trendFor(meas.name)?.converted) && (
            <p className="categorical">
              Some values were converted to compare across visits; the original units are
              kept as recorded.
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

      <footer>
        Synthetic demo data. Values describe a fictional person; trends are arithmetic on
        recorded values, not health assessments.
      </footer>
    </main>
  );
}
