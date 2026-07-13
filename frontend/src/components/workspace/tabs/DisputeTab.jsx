import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getDispute, openDispute, resolveDispute } from "@/backend/disputes";

export default function DisputeTab() {
  const { workspace, org } = useOutletContext();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItem(await getDispute(workspace.id)); } catch { setItem(null); }
  };

  useEffect(() => {
    (async () => { try { await load(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  const open = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const next = await openDispute(workspace.id, org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "", reason.trim());
      setItem(next);
      setReason("");
      toast({ title: "Dispute opened" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const close = async () => {
    if (!resolution.trim()) return;
    setBusy(true);
    try {
      const next = await resolveDispute(workspace.id, resolution.trim());
      setItem(next);
      setResolution("");
      toast({ title: "Dispute resolved" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8 space-y-6">
      <div><div className="font-mono-tech text-muted-foreground">DISPUTE</div><p className="mt-1 text-sm text-muted-foreground">Open and resolve disputes against the backend.</p></div>

      {!item ? (
        <div className="border border-foreground/15 bg-card p-6 space-y-4">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for dispute" className="h-11 rounded-none border-foreground/20" />
          <div className="flex justify-end"><Button disabled={busy || !reason.trim()} onClick={open} className="h-11 rounded-none bg-destructive px-5 text-white hover:bg-destructive/90">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-1.5 h-4 w-4" />} Open dispute</Button></div>
        </div>
      ) : (
        <div className="border border-foreground/15 bg-card p-6 space-y-4">
          <div className="flex items-center justify-between"><div className="font-medium">{item.reason}</div><span className="text-xs uppercase text-muted-foreground">{item.status}</span></div>
          <div className="text-sm text-muted-foreground">Opened by {item.openedByOrgId}</div>
          {item.status !== "RESOLVED" && (
            <div className="space-y-3 border-t border-foreground/10 pt-4">
              <Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution text" className="h-11 rounded-none border-foreground/20" />
              <div className="flex justify-end"><Button disabled={busy || !resolution.trim()} onClick={close} className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Resolve dispute</Button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
