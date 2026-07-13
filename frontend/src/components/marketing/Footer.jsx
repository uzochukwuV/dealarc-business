import React from "react";
import { Link } from "react-router-dom";

const COLUMNS = [
  {
    title: "Network",
    links: [
      { label: "Discover businesses", href: "#" },
      { label: "Opportunities", href: "#" },
      { label: "Reputation registry", href: "#" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Deal workspaces", href: "#" },
      { label: "Contracts", href: "#" },
      { label: "Payments", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Security", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-foreground/15 bg-background">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="block h-6 w-6 rounded-md bg-primary" />
              <span className="font-heading text-xl font-medium tracking-tight">
                Counterpart
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Trust infrastructure for high-value commerce. Verified organizations,
              structured negotiation, settlement with proof.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono-tech text-foreground">{col.title}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-foreground/10 pt-6 font-mono-tech text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} COUNTERPART NETWORK · ALL RIGHTS RESERVED</span>
          <span className="flex items-center gap-4">
            <a href="#" className="transition-colors hover:text-foreground">PRIVACY</a>
            <a href="#" className="transition-colors hover:text-foreground">TERMS</a>
            <a href="#" className="transition-colors hover:text-foreground">SECURITY</a>
          </span>
        </div>
      </div>
    </footer>
  );
}