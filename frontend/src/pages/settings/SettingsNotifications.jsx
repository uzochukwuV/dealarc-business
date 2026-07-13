import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Save, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const PREFERENCES = [
  { key: "new_connection", label: "New connection request", desc: "Someone sends you a connection request or accepts yours." },
  { key: "proposal_update", label: "Proposal submitted or countered", desc: "A counterparty submits or updates a proposal in a workspace." },
  { key: "approval_needed", label: "Approval required", desc: "You're added to an approval chain and action is needed." },
  { key: "funding_required", label: "Funding required", desc: "A workspace reaches the escrow-funding stage." },
  { key: "dispute_opened", label: "Dispute opened", desc: "A dispute is opened in one of your workspaces." },
  { key: "milestone_submitted", label: "Milestone submitted for review", desc: "A counterparty submits a milestone for your approval." },
  { key: "message_received", label: "New chat message", desc: "A new message arrives in a workspace thread." },
];

const DEFAULTS = PREFERENCES.reduce(
  (acc, p) => ({ ...acc, [p.key]: p.key === "message_received" ? false : true }),
  {},
);

const STORAGE_KEY = "sme.notification.prefs";

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export default function SettingsNotifications() {
  const { user } = useOutletContext();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggle = (key) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // The backend does not yet persist notification preferences, so we store
      // them locally. This keeps the UI functional without a silent failed request.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      toast({ title: "Preferences saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[700px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">SETTINGS / NOTIFICATIONS</div>
      <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
        Notifications
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Choose which events trigger email and in-app notifications. Preferences are stored on this device.
      </p>

      <div className="mt-8 border border-foreground/15">
        {PREFERENCES.map((p, i) => (
          <div
            key={p.key}
            className={`flex items-center justify-between gap-4 p-5 ${
              i < PREFERENCES.length - 1 ? "border-b border-foreground/10" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{p.label}</div>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            </div>
            <Switch checked={!!prefs[p.key]} onCheckedChange={() => toggle(p.key)} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
