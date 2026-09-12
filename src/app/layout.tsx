import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReplayDB — Temporal Database Debugging & Replay System',
  description: 'Deterministic time-travel debugging, row-level lineage, and counterfactual branching for PostgreSQL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
