import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: "Meridian Health - visit results demo",
  description:
    "Synthetic visit-results pipeline for a measurement clinic: data-quality checks, trends, and a staff review queue. All data invented.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
