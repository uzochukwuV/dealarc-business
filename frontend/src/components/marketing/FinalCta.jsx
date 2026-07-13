import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function FinalCta() {
  return (
    <section id="security" className="border-b border-foreground/15 bg-background">
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div>
            <span className="font-mono-tech text-muted-foreground">
              VERIFICATION · ENCRYPTION · PROOF
            </span>
            <h2 className="mt-6 font-heading text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.08] text-foreground">
              Built like a vault.
              <br />
              Transparent as glass.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Documents are encrypted client-side and pinned to content-addressed
              storage. Agreement hashes are anchorable onchain. Every action is
              logged to an audit ledger. Your counterparties see your reputation —
              never your private data.
            </p>
            <Link
              to="/register"
              className="mt-9 inline-flex min-h-[48px] items-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Begin verification
              <ArrowRight className="ml-2.5 h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-foreground/15 bg-card p-8">
            <div className="font-mono-tech text-muted-foreground">SECURITY POSTURE</div>
            <dl className="mt-6 divide-y divide-foreground/10">
              {[
                ["Identity", "KYB attestation per organization"],
                ["Documents", "AES-256-GCM, pinned to IPFS"],
                ["Agreements", "SHA-256 hash, anchorable onchain"],
                ["Funds", "Escrow-gated, verification-enforced"],
                ["Audit", "Immutable activity log per workspace"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-4">
                  <dt className="font-mono-tech text-foreground">{k}</dt>
                  <dd className="text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}