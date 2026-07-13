import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, Lock } from "lucide-react";

export default function OpportunityCard({ opp }) {
  return (
    <Link
      to={`/discover/opportunities/${opp.id}`}
      className="group flex flex-col border border-foreground/15 bg-card p-6 transition-colors hover:border-foreground/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-lg font-medium leading-tight text-foreground">
          {opp.title}
        </h3>
        {opp.sealed_bid && (
          <span className="inline-flex items-center gap-1 border border-foreground/20 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" /> SEALED
          </span>
        )}
      </div>

      <div className="mt-2 font-mono-tech text-muted-foreground">
        {opp.category || "Procurement"}
      </div>

      <div className="mt-5 space-y-2 text-sm text-muted-foreground">
        {opp.quantity && <Row label="Quantity" value={opp.quantity} />}
        {opp.delivery_location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" /> {opp.delivery_location}
          </div>
        )}
        {opp.deadline && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(opp.deadline).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-foreground/10 pt-4">
        <div>
          <div className="text-sm text-foreground">{opp.poster_org_name || "—"} </div>
          <div className="font-mono-tech text-muted-foreground">
            {opp.poster_industry || ""}
          </div>
        </div>
        {opp.budget_range && (
          <div className="text-right">
            <div className="font-mono text-[11px] text-muted-foreground">BUDGET</div>
            <div className="text-sm text-foreground">{opp.budget_range}</div>
          </div>
        )}
      </div>
    </Link>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-mono-tech text-muted-foreground">{label.toUpperCase()}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}