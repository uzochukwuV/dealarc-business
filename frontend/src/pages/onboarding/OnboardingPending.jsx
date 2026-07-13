import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveOrganizationId, getActiveOrganizationProvisioning, getCurrentUser, getOrganizationStats } from "@/lib/backend-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

const TIMELINE = [
  { label: "Organization created", detail: "Backend wallet and identity provisioned", done: true },
  { label: "Document review", detail: "Encrypted uploads and verification case submitted", done: true },
  { label: "KYB validation", detail: "Identity attestation in progress", done: false, active: true },
  { label: "Final approval", detail: "Verification attestation issued", done: false },
];

const PREVIEW = [
  { label: "Business balance", value: "$0.00", note: "View-only until verified" },
  { label: "Escrow in flight", value: "$0.00", note: "No active workspaces" },
  { label: "Network connections", value: "0", note: "Discoverable post-approval" },
  { label: "Deal workspaces", value: "0", note: "Unlocked on verification" },
];

export default function OnboardingPending() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [provisioning, setProvisioning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const activeOrgId = getActiveOrganizationId();
        if (!activeOrgId) {
          navigate("/onboarding/organization", { replace: true });
          return;
        }

        const stats = await getOrganizationStats(activeOrgId);
        setOrg(stats);
        setProvisioning(getActiveOrganizationProvisioning());

        if (stats.verificationStatus === "VERIFIED") {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        navigate("/onboarding/organization", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingShell step="pending">
      <div className="font-mono-tech text-muted-foreground">STEP 03 / VERIFICATION REVIEW</div>
      <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-foreground">
        Your organization is under review
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        We are validating your documents and authority to transact. The Circle wallet and on-chain identity are already provisioned for this organization.
      </p>

      <div className="mt-8 flex flex-col gap-4 border border-foreground/20 bg-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">
              Status: <span className="font-mono text-[hsl(213,56%,30%)]">{org?.verificationStatus || "PENDING"}</span>
            </div>
            <div className="font-mono-tech text-muted-foreground">
              ORG_ID // {(org?.id || "").slice(0, 12).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground sm:text-right">
          <div>CIRCLE_WALLET_ID // {provisioning?.circleWalletId || "pending"}</div>
          <div>ONCHAIN_ID // {provisioning?.onChainIdentityId || org?.stats?.identityId || "pending"}</div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <div className="font-mono-tech text-muted-foreground">SECURITY TIMELINE</div>
          <ol className="mt-6 space-y-0">
            {TIMELINE.map((item) => (
              <li key={item.label} className="flex gap-4 border-l border-foreground/15 pb-6 pl-5 last:pb-0">
                <span
                  className={`-ml-[26px] mt-0.5 flex h-4 w-4 items-center justify-center border ${
                    item.done
                      ? "border-foreground bg-foreground"
                      : item.active
                      ? "border-primary bg-background"
                      : "border-foreground/20 bg-background"
                  }`}
                >
                  {item.active && <span className="h-1.5 w-1.5 animate-blink bg-primary" />}
                </span>
                <div>
                  <div className={`text-sm font-medium ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </div>
                  <div className="font-mono-tech text-muted-foreground">{item.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <div className="font-mono-tech text-muted-foreground">READ-ONLY COMMAND CENTER</div>
          <div className="mt-6 border border-foreground/15 bg-card opacity-70">
            {PREVIEW.map((item, index) => (
              <div
                key={item.label}
                className={`flex items-center justify-between px-5 py-4 ${index !== PREVIEW.length - 1 ? "border-b border-foreground/10" : ""}`}
              >
                <div>
                  <div className="text-sm text-foreground">{item.label}</div>
                  <div className="font-mono-tech text-muted-foreground">{item.note}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-heading text-xl font-medium text-muted-foreground">{item.value}</span>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono-tech text-muted-foreground">
            WHAT YOU CAN DO NOW: VIEW BALANCE ONLY · NO ESCROW FUNDING
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-foreground/15 pt-6 sm:flex-row sm:items-center">
        <span className="flex items-center gap-2 font-mono-tech text-muted-foreground">
          <Clock className="h-4 w-4" /> EST. TURNAROUND &lt; 2 BUSINESS DAYS
        </span>
        <Button
          onClick={() => navigate("/dashboard")}
          variant="outline"
          className="h-12 rounded-none border-foreground/25 hover:bg-foreground/5"
        >
          Enter read-only dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </OnboardingShell>
  );
}
