import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { CONTRACT_TEMPLATE_DETAILS } from "@/lib/workspace-utils";

export default function ContractTemplates() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-12">
      <Link
        to="/contracts"
        className="inline-flex items-center font-mono-tech text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> BACK TO CONTRACTS
      </Link>

      <div className="mt-6 font-mono-tech text-muted-foreground">CONTRACT TEMPLATES</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        Available templates
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Each template defines the fund flow and legal structure for a deal.
        Templates are selected per workspace and can be overridden.
      </p>

      <div className="mt-10 space-y-px border border-foreground/15">
        {CONTRACT_TEMPLATE_DETAILS.map((t, i) => (
          <div key={t.id} className="bg-card p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-foreground text-background">
                <FileText className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-heading text-xl font-medium text-foreground">{t.name}</h2>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")} / {String(CONTRACT_TEMPLATE_DETAILS.length).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.for}</p>

                <div className="mt-5 border border-foreground/10 bg-background p-4">
                  <div className="font-mono-tech text-muted-foreground">FUND FLOW</div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{t.fund_flow}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}