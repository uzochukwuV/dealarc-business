import React from "react";
import { Link } from "react-router-dom";
import { MapPin, TrendingUp } from "lucide-react";
import VerificationBadge from "@/components/app/VerificationBadge";

export function monogram(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function BusinessCard({ org }) {
  const regions = (org.regionsServed || []).join(", ");
  const reputation = org.stats?.reputation || {};

  return (
    <Link
      to={`/discover/business/${org.id}`}
      className="group flex flex-col border border-foreground/15 bg-card p-6 transition-colors hover:border-foreground/40"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center bg-foreground text-sm font-medium text-background">
            {monogram(org.legalName)}
          </span>
          <div>
            <h3 className="font-heading text-lg font-medium leading-tight text-foreground">
              {org.legalName}
            </h3>
            <div className="font-mono-tech text-muted-foreground">{org.industry || "-"}</div>
          </div>
        </div>
        <VerificationBadge status={org.verificationStatus} compact />
      </div>

      {org.publicProfile?.productsServices && (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {org.publicProfile.productsServices}
        </p>
      )}

      {regions && (
        <div className="mt-4 flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {regions}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-px border-t border-foreground/10 pt-4 text-center">
        <Stat label="DEALS" value={reputation.completedDeals || 0} />
        <Stat label="SCORE" value={reputation.score || 0} />
        <Stat label="VOLUME" value={reputation.totalVolume || 0} />
      </div>

      {org.publicProfile?.typicalDealSize && (
        <div className="mt-4 flex items-center justify-between font-mono text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> TYPICAL DEAL
          </span>
          <span className="text-foreground">{org.publicProfile.typicalDealSize}</span>
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-heading text-xl font-medium text-foreground">{value}</div>
      <div className="font-mono-tech text-muted-foreground">{label}</div>
    </div>
  );
}
