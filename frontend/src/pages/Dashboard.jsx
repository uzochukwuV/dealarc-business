import React, { useOutletContext } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowRight, Lock } from "lucide-react";
import VerificationBadge from "@/components/app/VerificationBadge";

const AREAS = [
  { to: "/discover", label: "Discover", note: "Search verified counterparties and opportunities" },
  { to: "/connections", label: "Connections", note: "Manage relationship requests" },
  { to: "/workspaces", label: "Workspaces", note: "Active and past deal workspaces" },
  { to: "/contracts", label: "Contracts", note: "Cross-workspace contract register" },
  { to: "/payments", label: "Payments", note: "Business balance and escrow" },
  { to: "/organization", label: "Organization", note: "Profile, team, and verification" },
  { to: "/reputation", label: "Reputation", note: "Your trust profile and reviews" },
];

export default function Dashboard() {
  const { org } = useOutletContext();
  const verified = org?.verification_status === "VERIFIED";
  const readOnly = !verified;

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">OVERVIEW</div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
          {org?.legal_name}
        </h1>
        <VerificationBadge status={org?.verification_status} />
      </div>

      {/* Status banner */}
      <div
        className={`mt-8 flex items-center gap-4 border px-5 py-4 ${
          verified ? "border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)]" : "border-foreground/20 bg-secondary"
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center ${
            verified ? "bg-[hsl(170,60%,30%)]" : "bg-foreground"
          } text-background`}
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-medium text-foreground">
            {verified
              ? "Verified — full network access"
              : "Under review — read-only access until verified"}
          </div>
          <div className="font-mono-tech text-muted-foreground">
            ORG_ID // {(org?.id || "").slice(0, 12).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Balance / status grid */}
      <div className="mt-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Business balance", value: "$0.00" },
          { label: "Escrow in flight", value: "$0.00" },
          { label: "Connections", value: "0" },
          { label: "Deal workspaces", value: "0" },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`border border-foreground/15 bg-card p-5 ${
              i % 4 !== 0 ? "sm:border-l-0" : ""
            } ${readOnly ? "opacity-70" : ""}`}
          >
            <div className="font-mono-tech text-muted-foreground">{s.label.toUpperCase()}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-heading text-2xl font-medium text-foreground">
                {s.value}
              </span>
              {readOnly && <Lock className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        ))}
      </div>

      {/* Area quick links */}
      <div className="mt-10">
        <div className="font-mono-tech text-muted-foreground">NETWORK AREAS</div>
        <div className="mt-5 grid grid-cols-1 gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-center justify-between bg-background p-6 transition-colors hover:bg-secondary"
            >
              <div>
                <div className="text-base font-medium text-foreground">{a.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{a.note}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>

      {readOnly && (
        <p className="mt-8 font-mono text-[12px] leading-relaxed text-muted-foreground">
          WHAT YOU CAN DO NOW: VIEW BALANCE ONLY · NO ESCROW FUNDING · DISCOVERY IS AVAILABLE
        </p>
      )}
    </div>
  );
}