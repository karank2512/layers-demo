import Link from "next/link";
import { loadResults, prettyDate } from "../lib/data";

export default function Queue() {
  const results = loadResults();
  return (
    <main>
      <Link className="back" href="/">
        &larr; All members
      </Link>
      <p className="wordmark">Staff view</p>
      <h1>Review queue</h1>
      <p className="lede">
        Records the pipeline could not reconcile on its own. Each item says exactly what is
        inconsistent; a person decides what to do about it.
      </p>

      {results.queue.length === 0 ? (
        <p className="lede">Nothing needs review.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Visit</th>
              <th>Member</th>
              <th>Export</th>
              <th>What needs a look</th>
            </tr>
          </thead>
          <tbody>
            {results.queue.map((f, i) => (
              <tr key={i}>
                <td>{prettyDate(f.visitDate)}</td>
                <td>{f.memberId}</td>
                <td>
                  <code>{f.file.split("/").pop()}</code>
                </td>
                <td className="measure-name">{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {results.notes.length > 0 && (
        <>
          <h2>Notes</h2>
          <p className="lede">
            Collapsed duplicates and other housekeeping - recorded, no decision needed.
          </p>
          <ul className="categorical">
            {results.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
