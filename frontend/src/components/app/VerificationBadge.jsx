import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default function VerificationBadge({ status, compact = false }) {
  const s = status || "UNVERIFIED";
  const verified = s === "VERIFIED";

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)] px-2.5 py-1 text-[11px] font-medium text-[hsl(190,88%,21%)]">
        <ShieldCheck className="h-3.5 w-3.5" />
        {compact ? "Verified" : "Verified organization"}
      </span>
    );
  }

  const label = s === "PENDING" ? "Under review" : s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5 border border-foreground/15 bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <ShieldAlert className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}