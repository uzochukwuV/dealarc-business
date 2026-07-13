import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { listRequirements, saveRequirement } from "@/backend/requirements";

export default function RequirementsTab() {
  const { workspace, org } = useOutletContext();
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ item: "", quantity: "", specs: "", delivery: "", deadline: "", budget_range: "", certifications: "" });

  const load = async () => {
    const list = await listRequirements(workspace.id);
    const current = list[0] || null;
    setReq(current);
    setForm({
      item: current?.item || "",
      quantity: current?.quantity || "",
      specs: current?.specs || "",
      delivery: current?.delivery || "",
      deadline: current?.deadline ? String(current.deadline).split("T")[0] : "",
      budget_range: current?.budget_range || "",
      certifications: Array.isArray(current?.certifications) ? current.certifications.join(", ") : (current?.certifications || ""),
    });
  };

  useEffect(() => {
    (async () => { try { await load(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveRequirement(workspace.id, req?.id || null, {
        createdByOrgId: org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "",
        fields: {
          item: form.item,
          quantity: form.quantity,
          specs: form.specs,
          delivery: form.delivery,
          deadline: form.deadline || null,
          budgetRange: form.budget_range,
          certifications: form.certifications ? form.certifications.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      });
      toast({ title: "Requirement saved" });
      await load();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      <div className="flex items-center justify-between"><div className="font-mono-tech text-muted-foreground">REQUIREMENTS</div>{req && <span className="text-xs uppercase text-muted-foreground">Saved</span>}</div>
      <form onSubmit={save} className="mt-6 space-y-5 border border-foreground/15 bg-card p-6">
        {[["Item", "item"], ["Quantity", "quantity"], ["Delivery location", "delivery"], ["Budget range", "budget_range"], ["Certifications", "certifications"]].map(([label, key]) => (
          <div key={key} className="space-y-2"><Label className="font-mono-tech text-foreground">{label.toUpperCase()}</Label><Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="h-11 rounded-none border-foreground/20" /></div>
        ))}
        <div className="space-y-2"><Label className="font-mono-tech text-foreground">SPECIFICATIONS</Label><Textarea value={form.specs} onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))} className="min-h-[100px] rounded-none border-foreground/20" /></div>
        <div className="space-y-2"><Label className="font-mono-tech text-foreground">DEADLINE</Label><Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="h-11 rounded-none border-foreground/20" /></div>
        <div className="flex justify-end border-t border-foreground/15 pt-4"><Button type="submit" disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : req ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />} {req ? "Save changes" : "Create requirement"}</Button></div>
      </form>
    </div>
  );
}
