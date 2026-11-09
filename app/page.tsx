import Link from "next/link";
import { loadResults, prettyDate, shortDate } from "./lib/data";

export default function Home() {
  const results = loadResults();
  const pending = results.queue.length;
  const visitCount = results.members.reduce((n, m) => n + m.visits.length, 0);
  const heldByMember = new Map<string, number>();
  for (const f of results.queue) {
    heldByMember.set(f.memberId, (heldByMember.get(f.memberId) ?? 0) + 1);
  }

  return (
    <main>
      <div className="page-head">
        <p className="kicker">Visit results</p>
        <h1>Member results, with unresolved readings held for review.</h1>
        <p className="lede">
          Six fictional members; five have two quarterly visits, one has just had their
          first. Every reading is invented; the pipeline checks that records are complete,
          consistent, and traceable - a person decides anything unresolved.
        </p>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{results.members.length}</div>
          <div className="stat-label">Members</div>
        </div>
        <div className="stat">
          <div className="stat-value">{visitCount}</div>
          <div className="stat-label">Visits</div>
        </div>
        <div className="stat">
          <div className="stat-value">{results.exportsChecked}</div>
          <div className="stat-label">Exports checked</div>
        </div>
        <div className="stat">
          <div className="stat-value">{pending}</div>
          <div className="stat-label">Awaiting review</div>
        </div>
      </div>

      {pending > 0 ? (
        <Link className="queue-banner" href="/queue">
          <span>
            <strong>{pending} records could not be reconciled automatically.</strong>
            <br />
            Each one waits in the staff review queue with the exact inconsistency named.
          </span>
          <span className="queue-go">Review &rarr;</span>
        </Link>
      ) : (
        <div className="queue-banner is-empty">
          <span>
            <strong>Staff review queue is empty.</strong>
            <br />
            Nothing needs a human look.
          </span>
          <span className="queue-go" />
        </div>
      )}

      <div className="section-head">
        <h2>Members</h2>
      </div>

      <ul className="member-grid">
        {results.members.map((m) => {
          const heldCount = heldByMember.get(m.id) ?? 0;
          const latest = m.visits[m.visits.length - 1];
          return (
            <li className="member-card" key={m.id}>
              <Link className="member-name" href={`/report/${m.id}/${latest.visitDate}`}>
                {m.firstName}
              </Link>
              <span className="member-meta">
                {m.visits.length === 1 ? "1 visit" : `${m.visits.length} visits`}
                {" · "}latest {shortDate(latest.visitDate)}
              </span>
              <span className="member-visits">
                {m.visits.map((v, j) => (
                  <span key={v.visitDate}>
                    {j > 0 && <span className="visit-sep">/</span>}
                    <Link href={`/report/${m.id}/${v.visitDate}`}>
                      {prettyDate(v.visitDate)}
                    </Link>
                  </span>
                ))}
              </span>
              <span className="member-status">
                <span className={`status-dot${heldCount > 0 ? " pending" : ""}`} />
                {heldCount > 0
                  ? `${heldCount} ${heldCount === 1 ? "item" : "items"} being checked`
                  : "All records reconciled"}
              </span>
            </li>
          );
        })}
      </ul>

      <footer>
        All data on this site is synthetic, generated for a software demo. It checks data
        integrity - provenance, completeness, units, duplicates, and trends. It does not
        make health judgments.
      </footer>
    </main>
  );
}
