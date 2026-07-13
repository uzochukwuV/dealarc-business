import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Plus, Upload, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { createMilestone, listMilestones, submitMilestoneEvidence, approveMilestone } from "@/backend/milestones";
import { openDispute } from "@/backend/disputes";

export default function ExecutionTab() {
  const { workspace, org } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", dueDate: "" });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [openDisputeLoading, setOpenDisputeLoading] = useState(false);

  const load = async () => setItems(await listMilestones(workspace.id));

  useEffect(() => {
    (async () => { try { await load(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createMilestone(workspace.id, form);
      toast({ title: "Milestone added" });
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (item) => {
    const input = document.getElementById(`file-${item.id}`);
    const file = input?.files?.[0];
    if (!file) return toast({ title: "Pick a file first", variant: "destructive" });
    setBusy(`submit-${item.id}`);
    try {
      await submitMilestoneEvidence(workspace.id, item.id, file, org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "");
      toast({ title: "Evidence submitted" });
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const review = async (item, decision) => {
    setBusy(`${decision}-${item.id}`);
    try {
      await approveMilestone(workspace.id, item.id, decision, "");
      toast({ title: `Milestone ${decision.toLowerCase()}` });
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const openDisputeNow = async () => {
    if (!disputeReason.trim()) return;
    setOpenDisputeLoading(true);
    try {
      await openDispute(workspace.id, org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "", disputeReason.trim());
      toast({ title: "Dispute opened" });
      setDisputeReason("");
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setOpenDisputeLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">EXECUTION</div>
          <p className="mt-1 text-sm text-muted-foreground">Milestones, evidence, and approvals are backed by the API.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> Add milestone</Button>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? <div className="border border-foreground/15 bg-card py-20 text-center text-sm text-muted-foreground">No milestones yet.</div> : items.map((item) => (
          <div key={item.id} className="border border-foreground/15 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{item.description}</div>
                <div className="text-sm text-muted-foreground">{item.amount || "—"} · {item.status}</div>
              </div>
              <span className="text-xs uppercase text-muted-foreground">#{item.sequence || 1}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input id={`file-${item.id}`} type="file" className="h-11 rounded-none border-foreground/20" />
              <Button disabled={busy === `submit-${item.id}`} onClick={() => submit(item)} className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90">{busy === `submit-${item.id}` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />} Submit evidence</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 rounded-none border-foreground/25" disabled={busy === `APPROVED-${item.id}` || item.status !== "SUBMITTED"} onClick={() => review(item, "APPROVED")}><Check className="mr-1.5 h-4 w-4" /> Approve</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-foreground/15 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Open a dispute</div>
        <Input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Reason for dispute" className="h-11 rounded-none border-foreground/20" />
        <div className="flex justify-end"><Button disabled={openDisputeLoading || !disputeReason.trim()} onClick={openDisputeNow} className="h-11 rounded-none bg-destructive px-5 text-white hover:bg-destructive/90">{openDisputeLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Open dispute</Button></div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-sm border-foreground/15 bg-background p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle className="font-heading text-xl font-medium">Add milestone</DialogTitle></DialogHeader>
          <form onSubmit={add} className="space-y-4 px-6 pb-6">
            {[["Description", "description"], ["Amount", "amount"], ["Due date", "dueDate"]].map(([label, key]) => <div key={key} className="space-y-2"><Label className="font-mono-tech text-foreground">{label}</Label><Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="h-11 rounded-none border-foreground/20" /></div>)}
            <div className="flex justify-end border-t border-foreground/15 pt-4"><Button type="submit" disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
