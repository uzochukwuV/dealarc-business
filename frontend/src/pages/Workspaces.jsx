import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WORKSPACE_STATUS, NEXT_ACTION_PROMPTS } from "@/lib/workspace-utils";
import WorkspaceStatusBadge from "@/components/workspace/WorkspaceStatusBadge";
import { listWorkspaces } from "@/backend/workspaces";

function getWorkspaceCounterparty(workspace) {
  return (
    workspace.counterparty_org_name ||
    workspace.counterpartyOrgName ||
    workspace.counterparty_name ||
    workspace.title
  );
}

function getWorkspaceValue(workspace) {
  return workspace.approx_value || workspace.approxValue || "—";
}

function getWorkspaceNextAction(workspace) {
  return workspace.next_action || workspace.nextAction || NEXT_ACTION_PROMPTS[workspace.status] || "—";
}

function getWorkspaceStatus(workspace) {
  return workspace.status || workspace.workspaceStatus || "UNKNOWN";
}

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await listWorkspaces();
        setWorkspaces(Array.isArray(list) ? list : []);
      } catch {
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return workspaces.filter((w) => {
      const status = getWorkspaceStatus(w);
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (search) {
        const hay = `${w.title} ${getWorkspaceCounterparty(w)} ${w.category || w.dealCategory || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [workspaces, statusFilter, search]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">WORKSPACES</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        Deal workspaces
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Active and past deal workspaces for your organization. Each workspace
        carries its own negotiation, documents, approvals, and execution tracker.
      </p>

      <div className="mt-8 flex flex-col gap-4 border-y border-foreground/15 py-5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or counterparty..."
            className="h-11 rounded-none border-foreground/20 pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
        >
          <option value="ALL">All statuses</option>
          {Object.entries(WORKSPACE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-px border border-foreground/15 bg-card py-20 text-center">
          <p className="font-mono-tech text-muted-foreground">NO WORKSPACES FOUND</p>
        </div>
      ) : (
        <div className="mt-px border border-foreground/15">
          {filtered.map((ws) => {
            const status = getWorkspaceStatus(ws);

            return (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}/chat`}
                className="group grid grid-cols-12 items-center gap-4 border-b border-foreground/10 p-5 transition-colors last:border-b-0 hover:bg-foreground/[0.02]"
              >
                <div className="col-span-12 md:col-span-4">
                  <div className="text-base font-medium text-foreground">{ws.title}</div>
                  <div className="mt-0.5 font-mono-tech text-muted-foreground">
                    {getWorkspaceCounterparty(ws)} · {ws.category || ws.dealCategory || "—"}
                  </div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <WorkspaceStatusBadge status={status} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="font-mono-tech text-muted-foreground">VALUE</div>
                  <div className="mt-1 text-sm text-foreground">{getWorkspaceValue(ws)}</div>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <div className="font-mono-tech text-muted-foreground">NEXT ACTION</div>
                  <div className="mt-1 text-sm text-foreground">{getWorkspaceNextAction(ws)}</div>
                </div>
                <div className="col-span-12 flex items-center justify-end md:col-span-1">
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
