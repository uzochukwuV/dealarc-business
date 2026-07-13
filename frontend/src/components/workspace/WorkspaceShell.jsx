import React, { useEffect, useState } from "react";
import { useParams, Outlet, NavLink, useOutletContext, Link } from "react-router-dom";
import { Loader2, ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import { monogram } from "@/lib/workspace-utils";
import WorkspaceStatusBadge from "@/components/workspace/WorkspaceStatusBadge";
import { getWorkspace } from "@/backend/workspaces";

const TABS = [
  { path: "chat", label: "Chat" },
  { path: "requirements", label: "Requirements" },
  { path: "proposals", label: "Proposals" },
  { path: "documents", label: "Documents" },
  { path: "terms", label: "Terms" },
  { path: "approvals", label: "Approvals" },
  { path: "contract", label: "Contract" },
  { path: "execution", label: "Execution" },
];

export default function WorkspaceShell() {
  const { workspaceId } = useParams();
  const parentCtx = useOutletContext();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    const ws = await getWorkspace(workspaceId);
    setWorkspace(ws);
  };

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setWorkspace(null);

    (async () => {
      try {
        await load();
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !workspace) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-24 text-center">
        <h1 className="font-heading text-3xl font-medium">Workspace not found</h1>
        <Link to="/workspaces" className="mt-6 inline-flex items-center text-primary hover:underline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to workspaces
        </Link>
      </div>
    );
  }

  const reload = async () => {
    await load();
  };

  const workspaceStatus = workspace.status || workspace.workspaceStatus || "UNKNOWN";
  const disputeStatus = workspace.dispute_status || workspace.disputeStatus || "NONE";
  const counterpartyName =
    workspace.counterparty_org_name ||
    workspace.counterpartyOrgName ||
    workspace.counterparty_name ||
    "Counterparty pending";
  const objective = workspace.objective || workspace.objectiveSummary || workspace.objective_summary;
  const participants = workspace.participants || workspace.participantDetails || [];
  const approxValue = workspace.approx_value || workspace.approxValue;

  const allTabs = [...TABS];
  if (disputeStatus !== "NONE") {
    allTabs.push({ path: "dispute", label: "Dispute" });
  }

  return (
    <div>
      <header className="border-b border-foreground/15 bg-card">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <Link
            to="/workspaces"
            className="inline-flex items-center font-mono-tech text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> WORKSPACES
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-tight text-foreground">
                {workspace.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <WorkspaceStatusBadge status={workspaceStatus} />
                <span className="font-mono-tech text-muted-foreground">{counterpartyName}</span>
                {approxValue && (
                  <span className="font-mono-tech text-muted-foreground">· {approxValue}</span>
                )}
                {disputeStatus !== "NONE" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> DISPUTE OPEN
                  </span>
                )}
              </div>
            </div>
          </div>
          {objective && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{objective}</p>
          )}

          {participants.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 font-mono-tech text-muted-foreground">PARTICIPANTS</div>
              <div className="flex flex-wrap gap-3">
                {participants.map((p, i) => (
                  <ParticipantChip key={i} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <nav className="sticky top-14 z-30 border-b border-foreground/15 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex gap-1 overflow-x-auto">
            {allTabs.map((t) => (
              <NavLink
                key={t.path}
                to={t.path}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors ${
                    isActive
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <Outlet context={{ workspace, reload, user: parentCtx?.user, org: parentCtx?.org }} />
    </div>
  );
}

function ParticipantChip({ p }) {
  const name = p.name || p.fullName || p.org || p.organizationName || "Participant";
  const org = p.org || p.organizationName || p.companyName || "Org";
  return (
    <div className="flex items-center gap-3 border border-foreground/15 bg-background px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-foreground text-[11px] font-medium text-background">
        {monogram(name)}
      </span>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {name}
          {p.verified && <ShieldCheck className="h-3.5 w-3.5 text-[hsl(170,60%,30%)]" />}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {org} · {p.role || "Member"}
          {p.authority ? ` · ${p.authority}` : ""}
        </div>
      </div>
    </div>
  );
}
