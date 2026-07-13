import React, { useState } from "react";
import { requestConnection } from "@/backend/connections";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const CATEGORIES = ["Procurement", "Logistics", "Manufacturing", "Services", "Partnership", "Other"];

export default function ConnectionRequestDialog({ open, onOpenChange, targetOrg, onSubmitted }) {
  const [form, setForm] = useState({
    reason: "",
    proposedDealCategory: "Procurement",
    approxValue: "",
    timeline: "",
    requiresNda: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.reason.trim()) {
      setError("Tell your counterparty why you're reaching out.");
      return;
    }

    setLoading(true);
    try {
      await requestConnection({
        targetOrgId: targetOrg.id,
        reason: form.reason.trim(),
        proposedDealCategory: form.proposedDealCategory,
        approxValue: form.approxValue.trim(),
        timeline: form.timeline.trim(),
        requiresNda: form.requiresNda,
      });
      toast({
        title: "Connection requested",
        description: `${targetOrg.legalName} has been notified.`,
      });
      setForm({
        reason: "",
        proposedDealCategory: "Procurement",
        approxValue: "",
        timeline: "",
        requiresNda: false,
      });
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      setError(err.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-sm border-foreground/15 bg-background p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-heading text-2xl font-medium">Request connection</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Reach out to {targetOrg?.legalName}. A workspace is created once they accept with intent to transact.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 px-6 pb-6">
          {error && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-mono-tech text-foreground">Reason for contact</Label>
            <Textarea
              value={form.reason}
              onChange={update("reason")}
              placeholder="We're sourcing cold-chain logistics between Lagos and Accra for a Q3 rollout."
              className="min-h-[80px] rounded-none border-foreground/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">Deal category</Label>
              <select
                value={form.proposedDealCategory}
                onChange={update("proposedDealCategory")}
                className="h-11 w-full rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">Approx. value</Label>
              <Input
                value={form.approxValue}
                onChange={update("approxValue")}
                placeholder="$50,000 - $120,000"
                className="h-11 rounded-none border-foreground/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono-tech text-foreground">Timeline</Label>
            <Input
              value={form.timeline}
              onChange={update("timeline")}
              placeholder="30-60 days"
              className="h-11 rounded-none border-foreground/20"
            />
          </div>

          <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.requiresNda}
              onChange={update("requiresNda")}
              className="h-4 w-4 accent-[hsl(213,56%,23%)]"
            />
            Require NDA before sharing private details
          </label>

          <div className="flex items-center justify-between border-t border-foreground/15 pt-5">
            <span className="flex items-center gap-2 font-mono-tech text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> REQUEST SENT THROUGH BACKEND
            </span>
            <Button
              type="submit"
              className="h-11 rounded-none bg-primary px-6 font-medium hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  Send request <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
