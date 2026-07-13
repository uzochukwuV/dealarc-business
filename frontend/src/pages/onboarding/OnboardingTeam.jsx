import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveOrganizationId, getCurrentUser, getOrganization } from "@/lib/backend-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, UserPlus, X } from "lucide-react";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

const ROLES = ["Owner", "Admin", "Finance", "Sales", "Legal", "Viewer"];

export default function OnboardingTeam() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Sales");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const activeOrgId = getActiveOrganizationId();
        if (!activeOrgId) {
          navigate("/onboarding/organization", { replace: true });
          return;
        }

        setOrg(await getOrganization(activeOrgId));
      } catch {
        navigate("/onboarding/organization", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const addInvite = (e) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (invites.some((invite) => invite.email === email)) {
      setError("That email is already on the list.");
      return;
    }
    setInvites((current) => [...current, { email, role }]);
    setEmail("");
  };

  const removeInvite = (address) => setInvites((current) => current.filter((invite) => invite.email !== address));

  const finish = async () => {
    setSubmitting(true);
    try {
      navigate("/onboarding/pending", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingShell step="team">
      <div className="font-mono-tech text-muted-foreground">STEP 03 / TEAM INVITES</div>
      <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-foreground">
        Invite your team
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Team invites are currently queued locally. You can finish onboarding now and wire org-member invites next.
      </p>

      {error && (
        <div className="mt-6 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={addInvite} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-7">
          <Label htmlFor="invite-email" className="sr-only">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="h-12 rounded-none border-foreground/20"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-12 w-full rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="outline"
            className="h-12 w-full rounded-none border-foreground/25 hover:bg-foreground/5"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-foreground/15 pt-6">
        {invites.length === 0 ? (
          <p className="font-mono-tech text-muted-foreground">NO INVITES QUEUED</p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {invites.map((invite) => (
              <li key={invite.email} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-foreground">{invite.email}</span>
                  <span className="border border-foreground/20 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {invite.role}
                  </span>
                </div>
                <button
                  onClick={() => removeInvite(invite.email)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${invite.email}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-foreground/15 pt-6">
        <div className="text-sm text-muted-foreground">
          {org?.legalName ? `Active org: ${org.legalName}` : "Active org loaded"}
        </div>
        <Button
          onClick={finish}
          className="h-12 rounded-none bg-primary px-7 font-medium hover:bg-primary/90"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </OnboardingShell>
  );
}
