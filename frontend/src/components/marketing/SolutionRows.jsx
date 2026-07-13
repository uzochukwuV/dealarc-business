import React from "react";
import { Search, Layers, ShieldCheck } from "lucide-react";

const ROWS = [
  {
    id: "01",
    title: "Discovery with proof of identity",
    body: "Search a verified network of organizations by industry, region, and reputation. Every counterparty carries a KYB attestation — you negotiate with real companies, not anonymous profiles.",
    tag: "DISCOVERY LAYER",
    accent: "hsl(21,100%,56%)",
    icon: Search,
  },
  {
    id: "02",
    title: "Structured deal workspaces",
    body: "Move from chat to contracts inside a shared workspace. Requirements, proposals, and term sheets are first-class objects — every version preserved, every transition logged to an immutable activity ledger.",
    tag: "WORKSPACE LAYER",
    accent: "hsl(217,91%,60%)",
    icon: Layers,
  },
  {
    id: "03",
    title: "Settlement anchored to evidence",
    body: "Funds move through escrow with milestone-based release, gated by verification status. Delivery evidence and agreement hashes are provably what was signed — disputes resolve against the record, not the recollection.",
    tag: "SETTLEMENT LAYER",
    accent: "hsl(142,69%,45%)",
    icon: ShieldCheck,
  },
];

export default function SolutionRows() {
  return (
    <section id="network" className="border-b border-foreground/15 bg-background">
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mb-16 flex items-end justify-between border-b border-foreground/15 pb-8">
          <h2 className="max-w-xl font-heading text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium leading-[1.1] text-foreground">
            One infrastructure, three load-bearing layers.
          </h2>
          <span className="hidden font-mono-tech text-muted-foreground sm:block">
            ARCHITECTURE / 03 LAYERS
          </span>
        </div>

        <div>
          {ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <article
                key={row.id}
                className="grid grid-cols-12 items-start gap-6 border-t border-foreground/15 py-12 last:border-b"
              >
                <div className="col-span-12 md:col-span-1 font-mono-tech text-muted-foreground">
                  {row.id}
                </div>
                <div className="col-span-12 md:col-span-7">
                  <h3 className="font-heading text-2xl font-medium leading-tight text-foreground md:text-[2rem]">
                    {row.title}
                  </h3>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                    {row.body}
                  </p>
                </div>
                <div className="col-span-12 flex items-center gap-3 md:col-span-4 md:justify-end">
                  <span className="font-mono-tech text-muted-foreground">{row.tag}</span>
                  <span
                    className="block h-12 w-12 rounded-xl"
                    style={{ backgroundColor: row.accent }}
                    aria-hidden="true"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}