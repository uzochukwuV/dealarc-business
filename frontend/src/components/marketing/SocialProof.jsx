import React from "react";

const LOGOS = [
  "MERIDIAN",
  "NORTHGATE",
  "AXIOM",
  "VANTA",
  "HELIOS",
  "CIPHER",
  "QUORUM",
  "ATLAS",
  "VANGUARD",
  "ORION",
];

export default function SocialProof() {
  return (
    <section id="trust" className="border-b border-foreground/15 bg-background">
      <div className="mx-auto max-w-[1200px] px-6 py-20">
        <div className="mb-12 text-center">
          <span className="font-mono-tech text-muted-foreground">
            TRUSTED BY VERIFIED ORGANIZATIONS
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center py-3 text-center font-heading text-xl font-medium tracking-tight text-foreground/55 transition-colors hover:text-foreground"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}