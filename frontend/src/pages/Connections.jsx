import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Check, X, MessageSquareText, Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { listConnections, respondToConnection } from "@/backend/connections";

const STATUS_STYLE = {
  PENDING: "border-foreground/20 bg-secondary text-muted-foreground",
  ACCEPTED: "border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)] text-[hsl(190,88%,21%)]",
  DECLINED: "border-destructive/30 bg-destructive/5 text-destructive",
  PROFILE_ONLY: "border-foreground/15 bg-background text-muted-foreground",
  MORE_INFO: "border-[hsl(213,56%,30%)]/30 bg-[hsl(213,56%,95%)] text-[hsl(213,56%,25%)]",
};

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const list = await listConnections();
    setConnections(list);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const received = useMemo(
    () => connections.filter((c) => c.direction === "RECEIVED"),
    [connections]
  );
  const sent = useMemo(
    () => connections.filter((c) => c.direction === "SENT"),
    [connections]
  );
  const accepted = useMemo(
    () => connections.filter((c) => c.status === "ACCEPTED"),
    [connections]
  );

  const act = async (conn, status, label) => {
    setBusy(conn.id);
    try {
      await respondToConnection(conn.id, { response: status });
      await load();
      toast({ title: `Connection ${label.toLowerCase()}` });
    } catch (err) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">CONNECTIONS / INBOX</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        Relationship requests
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Review who's reaching out and what you've sent. Accepting with intent to
        transact opens a deal workspace.
      </p>

      <Tabs defaultValue="received" className="mt-8">
        <TabsList className="rounded-none border border-foreground/15 bg-transparent p-1">
          <TabsTrigger
            value="received"
            className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            Received ({received.length})
          </TabsTrigger>
          <TabsTrigger
            value="sent"
            className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            Sent ({sent.length})
          </TabsTrigger>
          <TabsTrigger
            value="accepted"
            className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            Accepted ({accepted.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <ConnectionList
            items={received}
            type="received"
            busy={busy}
            onAct={act}
          />
        </TabsContent>
        <TabsContent value="sent">
          <ConnectionList items={sent} type="sent" busy={busy} onAct={act} />
        </TabsContent>
        <TabsContent value="accepted">
          <ConnectionList items={accepted} type="accepted" busy={busy} onAct={act} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionList({ items, type, busy, onAct }) {
  if (items.length === 0) {
    return (
      <div className="border border-foreground/15 bg-card py-20 text-center">
        <p className="font-mono-tech text-muted-foreground">NO CONNECTIONS HERE</p>
      </div>
    );
  }
  return (
    <div className="mt-px border border-foreground/15">
      {items.map((c) => (
        <article
          key={c.id}
          className="grid grid-cols-12 items-center gap-4 border-b border-foreground/10 p-5 last:border-b-0"
        >
          <div className="col-span-12 md:col-span-4">
            <div className="text-sm font-medium text-foreground">
              {c.counterparty_org_name}
            </div>
            <div className="font-mono-tech text-muted-foreground">
              {c.counterparty_org_industry || "—"}
            </div>
          </div>
          <div className="col-span-12 md:col-span-2">
            <div className="font-mono-tech text-muted-foreground">CATEGORY</div>
            <div className="mt-1 text-sm text-foreground">
              {c.proposed_deal_category || "—"}
            </div>
          </div>
          <div className="col-span-6 md:col-span-2">
            <div className="font-mono-tech text-muted-foreground">VALUE</div>
            <div className="mt-1 text-sm text-foreground">{c.approx_value || "—"}</div>
          </div>
          <div className="col-span-6 md:col-span-1">
            <div className="font-mono-tech text-muted-foreground">TIMELINE</div>
            <div className="mt-1 text-sm text-foreground">{c.timeline || "—"}</div>
          </div>
          <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-3">
            <span
              className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-medium ${
                STATUS_STYLE[c.status] || STATUS_STYLE.PENDING
              }`}
            >
              {c.status.replace("_", " ").toLowerCase()}
            </span>
            {type === "received" && c.status === "PENDING" && (
              <div className="flex items-center gap-1.5">
                <ActButton
                  label="Accept"
                  icon={Check}
                  onClick={() => onAct(c, "ACCEPTED", "Accepted")}
                  disabled={busy === c.id}
                  primary
                />
                <ActButton
                  label="Decline"
                  icon={X}
                  onClick={() => onAct(c, "DECLINED", "Declined")}
                  disabled={busy === c.id}
                />
                <ActButton
                  label="More info"
                  icon={MessageSquareText}
                  onClick={() => onAct(c, "MORE_INFO", "More info requested")}
                  disabled={busy === c.id}
                />
                <ActButton
                  label="Profile only"
                  icon={Eye}
                  onClick={() => onAct(c, "PROFILE_ONLY", "Set to profile-only")}
                  disabled={busy === c.id}
                />
              </div>
            )}
          </div>

          {c.reason && (
            <p className="col-span-12 -mt-1 text-sm leading-relaxed text-muted-foreground">
              <span className="font-mono-tech">REASON · </span>
              {c.reason}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function ActButton({ label, icon: Icon, onClick, disabled, primary }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 rounded-none border-foreground/25 px-3 text-xs font-medium ${
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-transparent text-foreground hover:bg-foreground/5"
      }`}
    >
      <Icon className="mr-1.5 h-3.5 w-3.5" /> {label}
    </Button>
  );
}