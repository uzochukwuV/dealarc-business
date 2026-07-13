import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const PLANS = {
  Workspaces: [
    "Workspace shell with persistent participant header",
    "Chat with message → requirement/proposal conversion",
    "Requirements, proposals, term sheets, approvals",
    "Contract handoff and execution tracking",
  ],
  Contracts: [
    "Cross-workspace contract register",
    "Template library: Simple Escrow, Milestone, PO, Subscription, Revenue Share",
    "Plain-language fund-flow descriptions per template",
  ],
  Payments: [
    "Business balance card in business language",
    "Escrow vs. available balance split",
    "Transaction history linked to workspaces",
    "Fund, withdraw, and add-funds actions",
  ],
  Organization: [
    "Public + private profile management",
    "Team members, roles, and authorized-signer flags",
    "Verification status and document resubmission",
    "Approval-policy tiers by deal value",
  ],
  Reputation: [
    "Aggregate scores: on-time %, communication, dispute rate",
    "Completed deal count and repeat-customer rate",
    "Reviews tied to specific completed workspaces",
  ],
  Settings: [
    "Personal account and security (password / 2FA)",
    "Granular notification preferences",
  ],
};

export default function ComingSoon({ area }) {
  const items = PLANS[area] || ["This surface is being forged."];
  return (
    <div className="mx-auto max-w-[1000px] px-6 py-16">
      <div className="font-mono-tech text-muted-foreground">SURFACE / {area.toUpperCase()}</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        {area} — in development.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
        This area is part of the verified deal network but has not been built yet.
        Here's what it will contain when it ships.
      </p>

      <div className="mt-12 border border-foreground/15 bg-card">
        <div className="border-b border-foreground/10 px-6 py-4 font-mono-tech text-muted-foreground">
          PLANNED CONTENTS
        </div>
        <ul className="divide-y divide-foreground/10">
          {items.map((t, i) => (
            <li key={t} className="flex items-start gap-4 px-6 py-4">
              <span className="font-mono-tech text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm text-foreground">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <Link
          to="/discover"
          className="inline-flex min-h-[44px] items-center bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to discover
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}