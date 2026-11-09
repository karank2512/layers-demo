import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { loadResults } from "./lib/data";
import "./styles.css";

export const metadata: Metadata = {
  title: "Meridian Health - visit results demo",
  description:
    "Synthetic visit-results pipeline for a measurement clinic: data-quality checks, trends, and a staff review queue. All data invented.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const pending = loadResults().queue.length;
  return (
    <html lang="en">
      <body>
        <header className="band">
          <div className="band-inner">
            <Link className="band-wordmark" href="/">
              Meridian Health
            </Link>
            <nav className="band-nav">
              <Link href="/">Members</Link>
              <Link href="/queue">
                Review queue
                {pending > 0 && <span className="band-count">{pending}</span>}
              </Link>
            </nav>
            <span className="band-tag">Synthetic demo data</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
