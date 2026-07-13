import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const LEDGER = [
  { ref: "DLS-00428", party: "Accra Logistics Ltd.", value: "$184,000", status: "SETTLED" },
  { ref: "DLS-00427", party: "Nairobi Textiles Co.", value: "$92,500", status: "ESCROWED" },
  { ref: "DLS-00426", party: "Lagos Cold Chain Inc.", value: "$410,000", status: "VERIFIED" },
  { ref: "DLS-00425", party: "Cape Town Pharma", value: "$67,800", status: "SETTLED" },
  { ref: "DLS-00424", party: "Dar Steelworks", value: "$1,240,000", status: "ESCROWED" },
  { ref: "DLS-00423", party: "Kampala Agrics", value: "$48,200", status: "SETTLED" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-foreground/15 bg-background">
      {/* Hairline grid backdrop */}
      <div className="pointer-events-none absolute inset-0 grid-truth opacity-40" />

      <div className="relative mx-auto max-w-[1200px] px-6">
        <div className="grid min-h-[78vh] grid-cols-1 items-stretch md:grid-cols-2">
          {/* Left — live ledger */}
          <div className="flex flex-col justify-center rounded-2xl border-b border-foreground/15 bg-card px-6 py-16 md:border-b-0 md:border-r md:bg-transparent md:px-0 md:py-0 md:pr-12">
            <div className="font-mono-tech text-muted-foreground">
              LIVE TRANSACTION LEDGER
            </div>
            <ul className="mt-6 space-y-px">
              {LEDGER.map((row, i) => (
                <li
                  key={row.ref}
                  className="animate-ledger grid grid-cols-12 items-center border-t border-foreground/10 py-3 font-mono text-[12px] text-foreground/80 last:border-b"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span className="col-span-3 text-muted-foreground">{row.ref}</span>
                  <span className="col-span-5 truncate">{row.party}</span>
                  <span className="col-span-3 text-right text-foreground">{row.value}</span>
                  <span
                    className={`col-span-1 text-right text-[10px] ${
                      row.status === "SETTLED"
                        ? "text-[hsl(142,69%,40%)]"
                        : "text-[hsl(217,91%,55%)]"
                    }`}
                  >
                    ●
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 font-mono-tech text-muted-foreground">
              {LEDGER.length} RECORDS // ANONYMIZED PARTIES
            </div>
          </div>

          {/* Right — value proposition */}
          <div className="flex flex-col justify-center py-16 md:py-0 md:pl-12">
            <div className="font-mono-tech text-muted-foreground">THE VERIFIED DEAL NETWORK</div>
            <h1 className="mt-6 font-heading text-[clamp(2.75rem,6vw,4.5rem)] font-medium leading-[1.04] text-foreground">
              Where verified
              <br />
              commerce begins.
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
              Counterpart is the trust layer for high-value B2B trade. Discover
              vetted counterparties, negotiate structured deals, and settle with
              cryptographic certainty — every transaction anchored to proof.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex min-h-[48px] items-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Request access
                <ArrowRight className="ml-2.5 h-4 w-4" />
              </Link>
              <span className="font-mono-tech text-muted-foreground">
                NO WALLET REQUIRED · ONBOARDING IN UNDER 5 MIN
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}