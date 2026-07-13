import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { updateOrganization } from "@/backend/organisations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Lock, Save } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function OrganizationProfile() {
  const { org, reload } = useOutletContext();
  const pp = org?.publicProfile || {};
  const [form, setForm] = useState({
    tradingName: org?.tradingName || "",
    website: pp.website || "",
    productsServices: pp.productsServices || "",
    description: pp.description || "",
    regionsServed: (org?.regionsServed || []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateOrganization(org.id, {
        tradingName: form.tradingName || null,
        regionsServed: form.regionsServed.split(",").map((s) => s.trim()).filter(Boolean),
        publicProfile: {
          description: form.description,
          website: form.website,
          productsServices: form.productsServices,
        },
      });
      await reload();
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // legalName, country, industry, registrationNumber, taxId are set at creation
  // and are not editable via the org PATCH endpoint — shown read-only.
  const Legal = ({ label, value }) => (
    <div className="space-y-2">
      <Label className="font-mono-tech text-foreground">{label}</Label>
      <Input value={value || "—"} readOnly className="rounded-none border-foreground/15 bg-secondary/40 text-muted-foreground" />
    </div>
  );

  return (
    <div className="mx-auto max-w-[800px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">ORGANIZATION / PROFILE</div>
      <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
        Profile
      </h1>

      <form onSubmit={save} className="mt-8 space-y-px">
        {/* Identity (read-only) */}
        <div className="border border-foreground/15 bg-card p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-heading text-lg font-medium text-foreground">Identity</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Set at onboarding and managed by your verification team. Contact support to change.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Legal label="LEGAL NAME" value={org?.legalName} />
            <Legal label="COUNTRY" value={org?.country} />
            <Legal label="INDUSTRY" value={org?.industry} />
            <Legal label="REGISTRATION NUMBER" value={org?.registrationNumber} />
            <Legal label="TAX ID" value={org?.taxId} />
          </div>
        </div>

        {/* Public section */}
        <div className="border border-foreground/15 bg-card p-6">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-heading text-lg font-medium text-foreground">Public profile</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Visible to all verified counterparties in the network.
          </p>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-mono-tech text-foreground">TRADING NAME</Label>
                <Input value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} className="rounded-none border-foreground/20" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono-tech text-foreground">WEBSITE</Label>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} className="rounded-none border-foreground/20" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">COUNTRIES SERVED (comma-separated)</Label>
              <Input value={form.regionsServed} onChange={(e) => set("regionsServed", e.target.value)} className="rounded-none border-foreground/20" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">PRODUCTS / SERVICES</Label>
              <Input value={form.productsServices} onChange={(e) => set("productsServices", e.target.value)} className="rounded-none border-foreground/20" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">DESCRIPTION</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-[100px] rounded-none border-foreground/20" />
            </div>
          </div>
        </div>

        <div className="flex justify-end border border-foreground/15 bg-background p-5">
          <Button type="submit" disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}
