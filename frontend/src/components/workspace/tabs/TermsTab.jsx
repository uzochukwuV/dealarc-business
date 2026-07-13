import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { listProposals } from "@/backend/proposals";
import { finalizeTermSheet } from "@/backend/workspaces";

export default function TermsTab() {
  const { workspace } = useOutletContext();
  const [acceptedProposal, setAcceptedProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const list = await listProposals(workspace.id);
    setAcceptedProposal(list.find((p) => p.status === "ACCEPTED") || null);
  };

  useEffect(() => {
    (async () => { try { await load(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  const lock = async () => {
    if (!acceptedProposal) return;
    setSaving(true);
    try {
      await finalizeTermSheet(workspace.id, acceptedProposal.id, acceptedProposal.terms || {});
      toast({ title: "Terms finalized" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8 space-y-6">
      <div><div className="font-mono-tech text-muted-foreground">TERMS</div><p className="mt-1 text-sm text-muted-foreground">The accepted proposal becomes the term sheet for approvals.</p></div>
      {acceptedProposal ? (
        <div className="border border-foreground/15 bg-card p-6 space-y-3">
          <div className="flex items-center justify-between"><div className="font-medium">Accepted proposal v{acceptedProposal.version}</div><span className="text-xs uppercase text-muted-foreground">{acceptedProposal.status}</span></div>
          <div className="text-sm text-muted-foreground">Price: {acceptedProposal.price || "—"}</div>
          <div className="text-sm text-muted-foreground">Quantity: {acceptedProposal.quantity || "—"}</div>
          <div className="text-sm text-muted-foreground">Delivery: {acceptedProposal.delivery_terms || "—"}</div>
          <div className="flex justify-end border-t border-foreground/10 pt-4"><Button disabled={saving} onClick={lock} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />} Finalize terms</Button></div>
        </div>
      ) : (
        <div className="border border-foreground/15 bg-card py-20 text-center text-sm text-muted-foreground">No accepted proposal yet.</div>
      )}
    </div>
  );
}
