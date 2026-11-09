import Link from "next/link";
import { loadResults, prettyDate } from "./lib/data";

export default function Home() {
  const results = loadResults();
  return (
    <main>
      <p className="wordmark">Meridian Health - synthetic demo</p>
      <h1>Visit results, in context</h1>
      <p className="lede">
        Six fictional members; five have two quarterly visits, one has just had their
        first. Every reading is invented; the pipeline checks that records are complete,
        consistent, and traceable - a person decides anything unresolved.
      </p>

      {results.queue.length > 0 ? (
        <Link className="queue-banner" href="/queue">
          <strong>{results.queue.length} items</strong> in the staff review queue need a
          human look before these visits are final.
        </Link>
      ) : (
        <p className="queue-banner">
          <strong>Staff review queue is empty</strong> - nothing needs a human look.
        </p>
      )}

      <h2>Members</h2>
      <ul className="member-list">
        {results.members.map((m) => (
          <li key={m.id}>
            <span className="member-name">{m.firstName}</span>
            <span className="member-visits">
              {m.visits.map((v) => (
                <Link key={v.visitDate} href={`/report/${m.id}/${v.visitDate}`}>
                  {prettyDate(v.visitDate)}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <footer>
        All data on this site is synthetic, generated for a software demo. It checks data
        integrity - provenance, completeness, units, duplicates, and trends. It does not
        make health judgments.
      </footer>
    </main>
  );
}
