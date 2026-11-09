import Link from "next/link";
import { loadResults, prettyDate } from "../lib/data";

/**
 * Staff-facing reading of each flag type. The pipeline's raw finding stays
 * available verbatim under "Raw record"; nothing here decides or overrides.
 */
function issueCopy(type: string): { title: string; why: string } {
  switch (type) {
    case "conflicting_duplicate":
      return {
        title: "Conflicting readings",
        why: "The same measurement arrived twice with different values. A person confirms which reading stands before the visit is final.",
      };
    case "record_after_export":
      return {
        title: "Timestamp after export",
        why: "A record is marked as measured after the file containing it was produced. A person verifies the actual measurement time.",
      };
    case "unit_mismatch_vs_prior":
      return {
        title: "Units differ from the prior visit",
        why: "This export uses a different unit system than the member's earlier visit. A person confirms the conversion before trends rely on it.",
      };
    case "unknown_export_version":
    case "unknown_device":
      return {
        title: "Unrecognized instrument version",
        why: "The export's device or version is not in the registry. A person confirms the instrument before its data is relied on.",
      };
    case "missing_section":
      return {
        title: "Part of an export is missing",
        why: "A section this file is expected to contain is absent. The team follows up before the visit is treated as complete.",
      };
    case "missing_file":
      return {
        title: "An export has not arrived",
        why: "One of the visit's expected instrument files is absent. The team follows up before the visit is treated as complete.",
      };
    default:
      return {
        title: "Needs a human look",
        why: "The pipeline could not reconcile this record on its own.",
      };
  }
}

export default function Queue() {
  const results = loadResults();
  const nameOf = new Map(results.members.map((m) => [m.id, m.firstName]));
  return (
    <main>
      <Link className="back" href="/">
        &larr; All members
      </Link>
      <h1>Review queue</h1>
      <p className="lede">
        Records the pipeline could not reconcile on its own. Each item names the
        inconsistency in plain language, with the raw record kept underneath. Decisions
        stay with the team; this page is read-only.
      </p>

      {results.queue.length === 0 ? (
        <p className="lede">Nothing needs review.</p>
      ) : (
        <ol className="queue-list">
          {results.queue.map((f, i) => {
            const copy = issueCopy(f.type);
            return (
              <li className="queue-item" key={i}>
                <span>
                  <p className="queue-item-meta">
                    {nameOf.get(f.memberId) ?? f.memberId} &middot;{" "}
                    {prettyDate(f.visitDate)}
                  </p>
                  <p className="queue-item-title">{copy.title}</p>
                  <p className="queue-item-detail">{copy.why}</p>
                  <details className="queue-raw">
                    <summary>Raw record</summary>
                    <p className="queue-raw-detail">{f.detail}</p>
                    <p className="queue-item-file">{f.file.split("/").pop()}</p>
                  </details>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {results.notes.length > 0 && (
        <>
          <h2>Notes</h2>
          <p className="lede">
            Collapsed duplicates and other housekeeping - recorded, no decision needed.
          </p>
          <p className="categorical">
            {results.notes.map((n, i) => (
              <span key={i}>
                {n}
                <br />
              </span>
            ))}
          </p>
        </>
      )}

      <footer>
        Synthetic demo data. The queue lists data-quality findings only; it contains no
        health assessments.
      </footer>
    </main>
  );
}
