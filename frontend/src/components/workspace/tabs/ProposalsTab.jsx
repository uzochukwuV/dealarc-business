import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { fmtDateTime } from "@/lib/workspace-utils";
import { listProposals, createProposal, acceptProposal, rejectProposal } from "@/backend/proposals";

export default function ProposalsTab() {
  const { workspace, user, org } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ price: "", quantity: "", deliveryTerms: "", paymentStructure: "", warranty: "", validity: "", changeSummary: "" });

  const load = async () => {
    setItems(await listProposals(workspace.id));
  };

  useEffect(() => {
    (async () => {
      try { await load(); } catch {} finally { setLoading(false); }
    })();
  }, [workspace.id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nextVersion = (items[0]?.version || 0) + 1;
      await createProposal(workspace.id, form, nextVersion, org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "", user?.full_name || "You");
      toast({ title: `Proposal v${nextVersion} created` });
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const act = async (proposal, decision) => {
    setBusy(proposal.id);
    try {
      if (decision === "ACCEPTED") await acceptProposal(workspace.id, proposal.id);
      else await rejectProposal(workspace.id, proposal.id);
      toast({ title: `Proposal ${decision.toLowerCase()}` });
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">PROPOSALS</div>
          <p className="mt-1 text-sm text-muted-foreground">Backend-backed proposal lifecycle.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> New proposal</Button>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 border border-foreground/15 bg-card py-20 text-center text-sm text-muted-foreground">No proposals yet.</div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((proposal) => (
            <div key={proposal.id} className="border border-foreground/15 bg-card">
              <div className="flex items-center justify-between border-b border-foreground/10 px-6 py-4">
                <div className="flex items-center gap-3"><span className="font-heading text-lg font-medium">v{proposal.version}</span><span className="text-xs uppercase text-muted-foreground">{proposal.status}</span></div>
                <span className="font-mono text-[10px] text-muted-foreground">{proposal.created_by_name} · {fmtDateTime(proposal.created_date)}</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-foreground/10 sm:grid-cols-3">
                {[
                  ["price", proposal.price],
                  ["quantity", proposal.quantity],
                  ["delivery", proposal.delivery_terms],
                  ["payment", proposal.payment_structure],
                  ["warranty", proposal.warranty],
                  ["validity", proposal.validity],
                ].map(([label, value]) => (
                  <div key={label} className="bg-card px-5 py-4"><div className="font-mono-tech text-muted-foreground">{String(label).toUpperCase()}</div><div className="mt-1 text-sm">{value || "—"}</div></div>
                ))}
              </div>
              {proposal.change_summary && <div className="border-t border-foreground/10 px-6 py-3 text-sm text-muted-foreground">{proposal.change_summary}</div>}
              {(proposal.status === "DRAFT" || proposal.status === "SUBMITTED" || proposal.status === "COUNTERED") && (
                <div className="flex justify-end gap-2 border-t border-foreground/10 px-6 py-4">
                  <Button variant="outline" className="h-10 rounded-none border-foreground/25" disabled={busy === proposal.id} onClick={() => act(proposal, "REJECTED")}><X className="mr-1.5 h-4 w-4" /> Reject</Button>
                  <Button className="h-10 rounded-none bg-primary px-5 hover:bg-primary/90" disabled={busy === proposal.id} onClick={() => act(proposal, "ACCEPTED")}>
                    {busy === proposal.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Accept
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-sm border-foreground/15 bg-background p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle className="font-heading text-xl font-medium">New proposal</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 px-6 pb-6">
            {[
              ["Price", "price"], ["Quantity", "quantity"], ["Delivery terms", "deliveryTerms"], ["Payment structure", "paymentStructure"], ["Warranty", "warranty"], ["Validity", "validity"],
            ].map(([label, key]) => (
              <div key={String(key)} className="space-y-2"><Label className="font-mono-tech text-foreground">{label}</Label><Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="h-11 rounded-none border-foreground/20" /></div>
            ))}
            <div className="space-y-2"><Label className="font-mono-tech text-foreground">WHAT CHANGED</Label><Textarea value={form.changeSummary} onChange={(e) => setForm((f) => ({ ...f, changeSummary: e.target.value }))} className="min-h-[80px] rounded-none border-foreground/20" /></div>
            <div className="flex justify-end border-t border-foreground/15 pt-4"><Button type="submit" disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
