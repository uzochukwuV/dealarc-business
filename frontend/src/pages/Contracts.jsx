import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, FileText, ArrowRight } from "lucide-react";
import { CONTRACT_TEMPLATES } from "@/lib/workspace-utils";
import { listWorkspaces } from "@/backend/workspaces";

const CONTRACT_STATUS = {
  DRAFT: { label: "Draft", style: "border-foreground/20 bg-secondary text-muted-foreground" },
  REVIEW: { label: "In review", style: "border-[hsl(213,56%,30%)]/30 bg-[hsl(213,56%,95%)] text-[hsl(213,56%,25%)]" },
  SIGNING: { label: "Awaiting signature", style: "border-[hsl(43,74%,50%)]/40 bg-[hsl(43,74%,95%)] text-[hsl(35,80%,30%)]" },
  SIGNED: { label: "Signed / Active", style: "border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)] text-[hsl(190,88%,21%)]" },
};

export default function Contracts() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await listWorkspaces();
        setWorkspaces(list.filter((workspace) => workspace.contract_status && workspace.contract_status !== "NOT_STARTED"));
      } catch {
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">CONTRACTS</div>
          <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
            Contract register
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Cross-workspace view of all contracts - drafts, pending signature, active, and completed.
          </p>
        </div>
        <Link
          to="/contracts/templates"
          className="hidden h-11 shrink-0 items-center border border-foreground/25 px-5 text-sm text-foreground transition-colors hover:bg-foreground/5 sm:flex"
        >
          <FileText className="mr-2 h-4 w-4" /> Browse templates
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="mt-8 border border-foreground/15 bg-card py-20 text-center">
          <p className="font-mono-tech text-muted-foreground">NO CONTRACTS YET</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Contracts appear here once a workspace moves past negotiation.
          </p>
        </div>
      ) : (
        <div className="mt-8 border border-foreground/15">
          <div className="grid grid-cols-12 gap-4 border-b border-foreground/15 bg-secondary px-5 py-3 font-mono-tech text-muted-foreground">
            <div className="col-span-4">CONTRACT</div>
            <div className="col-span-2">TEMPLATE</div>
            <div className="col-span-2">COUNTERPARTY</div>
            <div className="col-span-2">VALUE</div>
            <div className="col-span-2">STATUS</div>
          </div>
          {workspaces.map((ws) => {
            const tmpl = CONTRACT_TEMPLATES.find((template) => template.id === ws.contract_template);
            const cfg = CONTRACT_STATUS[ws.contract_status] || CONTRACT_STATUS.DRAFT;
            return (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}/contract`}
                className="group grid grid-cols-12 items-center gap-4 border-b border-foreground/10 p-5 transition-colors last:border-b-0 hover:bg-foreground/[0.02]"
              >
                <div className="col-span-12 md:col-span-4">
                  <div className="text-sm font-medium text-foreground">{ws.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{ws.id.slice(0, 12).toUpperCase()}</div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="text-sm text-foreground">{tmpl?.name || "Custom"}</div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="text-sm text-foreground">{ws.counterparty_org_name}</div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="text-sm text-foreground">{ws.approx_value || "-"}</div>
                </div>
                <div className="col-span-6 flex items-center justify-between md:col-span-2">
                  <span className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-medium ${cfg.style}`}>
                    {cfg.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        to="/contracts/templates"
        className="mt-6 inline-flex h-11 items-center border border-foreground/25 px-5 text-sm text-foreground transition-colors hover:bg-foreground/5 sm:hidden"
      >
        <FileText className="mr-2 h-4 w-4" /> Browse templates
      </Link>
    </div>
  );
}
