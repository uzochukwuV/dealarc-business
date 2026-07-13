import React from "react";
import { Link } from "react-router-dom";
import StructuralStack from "@/components/onboarding/StructuralStack";

const TITLES = {
  organization: "Organization profile",
  documents: "Verification documents",
  team: "Invite your team",
  pending: "Under review",
};

export default function OnboardingShell({ step, children }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="h-px w-full overflow-hidden bg-foreground/10">
        <div className="animate-thread h-px w-full bg-primary" />
      </div>

      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="block h-6 w-6 bg-foreground" />
            <span className="font-heading text-xl font-medium tracking-tight text-foreground">
              Counterpart
            </span>
          </Link>
          <span className="font-mono-tech text-muted-foreground">
            ONBOARDING // {TITLES[step]?.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left rail — structural stack */}
          <aside className="lg:col-span-4">
            <div className="font-mono-tech text-muted-foreground">VERIFICATION CHAMBER</div>
            <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.1] text-foreground">
              Forge a verified
              <br />
              organization.
            </h1>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Your organization is provisioned in stages. Each layer must validate
              before the next unlocks — the same way trust is built.
            </p>
            <div className="mt-10 border-t border-foreground/15 pt-8">
              <StructuralStack current={step} />
            </div>
          </aside>

          {/* Right — monolith card */}
          <main className="lg:col-span-8">
            <div className="border border-foreground/15 bg-card p-8 md:p-12">
              {children}
            </div>
          </main>
        </div>
      </div>

      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3 font-mono-tech text-muted-foreground">
          <span>AES-256 // ENCRYPTED INGEST</span>
          <span className="hidden sm:inline">DOCUMENTS PINNED TO IPFS</span>
        </div>
      </footer>
    </div>
  );
}