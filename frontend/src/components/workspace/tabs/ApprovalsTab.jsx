import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { listApprovals, addApprover, decideApproval } from "@/backend/approvals";

export default function ApprovalsTab() {
  const { workspace } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ name: "", role: "", org: "" });
  const [notes, setNotes] = useState({});

  const load = async () => setItems(await listApprovals(workspace.id));

  useEffect(() => {
    (async () => { try { await load(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addApprover(workspace.id, form.name, form.role, form.org, 1);
      toast({ title: "Approver added" });
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const decide = async (item, decision) => {
    setBusy(item.id);
    try {
      await decideApproval(workspace.id, item.id, decision, notes[item.id] || "");
      toast({ title: `Approval ${decision.toLowerCase()}` });
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
        <div><div className="font-mono-tech text-muted-foreground">APPROVALS</div><p className="mt-1 text-sm text-muted-foreground">Internal approval workflow.</p></div>
        <Button onClick={() => setOpen(true)} className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> Add approver</Button>
      </div>

      <div className="mt-8 space-y-4">
        {items.length === 0 ? <div className="border border-foreground/15 bg-card py-20 text-center text-sm text-muted-foreground">No approvals yet.</div> : items.map((item) => (
          <div key={item.id} className="border border-foreground/15 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{item.requiredApprovers?.[0]?.name || item.organizationId}</div>
                <div className="text-sm text-muted-foreground">{item.requiredApprovers?.[0]?.role || item.policyTier || "Standard"}</div>
              </div>
              <span className="text-xs uppercase text-muted-foreground">{item.status}</span>
            </div>
            {item.status === "PENDING" && (
              <div className="mt-4 flex gap-2">
                <Input placeholder="Notes" value={notes[item.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))} className="h-11 rounded-none border-foreground/20" />
                <Button className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90" disabled={busy === item.id} onClick={() => decide(item, "APPROVED")}>
                  {busy === item.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Approve
                </Button>
                <Button variant="outline" className="h-11 rounded-none border-foreground/25" disabled={busy === item.id} onClick={() => decide(item, "REJECTED")}><X className="mr-1.5 h-4 w-4" /> Reject</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-sm border-foreground/15 bg-background p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle className="font-heading text-xl font-medium">Add approver</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 px-6 pb-6">
            {[["Name", "name"], ["Role", "role"], ["Organization ID", "org"]].map(([label, key]) => (
              <div key={key} className="space-y-2"><Label className="font-mono-tech text-foreground">{label}</Label><Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="h-11 rounded-none border-foreground/20" /></div>
            ))}
            <div className="flex justify-end border-t border-foreground/15 pt-4"><Button type="submit" disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
