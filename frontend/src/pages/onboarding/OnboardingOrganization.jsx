import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrganization, getActiveOrganizationId, getCurrentUser, getOrganization } from "@/lib/backend-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight } from "lucide-react";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

const INDUSTRIES = [
  "Manufacturing",
  "Logistics & Supply Chain",
  "Agriculture & Agri-processing",
  "Energy & Utilities",
  "Pharmaceuticals",
  "Construction",
  "Technology & Software",
  "Financial Services",
  "Retail & Wholesale",
  "Other",
];

export default function OnboardingOrganization() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    legalName: "",
    tradingName: "",
    industry: "",
    regionsServed: "",
    productsServices: "",
    description: "",
    website: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const activeOrgId = getActiveOrganizationId();
        if (!activeOrgId) {
          return;
        }

        const org = await getOrganization(activeOrgId);
        if (org.verificationStatus === "VERIFIED") {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (org.verificationStatus === "PENDING") {
          navigate("/onboarding/pending", { replace: true });
          return;
        }
        navigate("/onboarding/documents", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  const update = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.legalName.trim()) {
      setError("Legal name is required.");
      return;
    }
    setLoading(true);
    try {
      const regionsServed = form.regionsServed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      await createOrganization({
        legalName: form.legalName.trim(),
        tradingName: form.tradingName.trim() || undefined,
        country: regionsServed[0] || "Nigeria",
        industry: form.industry || "Other",
        regionsServed,
        publicProfile: {
          description: form.description.trim() || undefined,
          website: form.website.trim() || undefined,
          productsServices: form.productsServices.trim() || undefined,
        },
      });

      navigate("/onboarding/documents", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to create organization");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingShell step="organization">
      <div className="font-mono-tech text-muted-foreground">STEP 01 / ORGANIZATION PROFILE</div>
      <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-foreground">
        Register your organization
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The backend provisions a Circle developer wallet and on-chain identity when the organization is created.
      </p>

      {error && (
        <div className="mt-6 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Legal name" required>
            <Input
              value={form.legalName}
              onChange={update("legalName")}
              placeholder="Acme Industrial Ltd."
              className="h-12 rounded-none border-foreground/20"
              required
            />
          </Field>
          <Field label="Trading name">
            <Input
              value={form.tradingName}
              onChange={update("tradingName")}
              placeholder="Acme"
              className="h-12 rounded-none border-foreground/20"
            />
          </Field>
          <Field label="Industry">
            <select
              value={form.industry}
              onChange={update("industry")}
              className="h-12 w-full rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Select industry…</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </Field>
          <Field label="Regions served">
            <Input
              value={form.regionsServed}
              onChange={update("regionsServed")}
              placeholder="Nigeria, Ghana, Kenya"
              className="h-12 rounded-none border-foreground/20"
            />
          </Field>
        </div>

        <Field label="Products / services">
          <Input
            value={form.productsServices}
            onChange={update("productsServices")}
            placeholder="Cold-chain logistics, warehousing, last-mile distribution"
            className="h-12 rounded-none border-foreground/20"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={update("description")}
            placeholder="A brief, accurate description of what your organization does."
            className="min-h-[96px] rounded-none border-foreground/20"
          />
        </Field>

        <Field label="Website">
          <Input
            value={form.website}
            onChange={update("website")}
            placeholder="https://"
            className="h-12 rounded-none border-foreground/20"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-foreground/15 pt-6">
          <span className="font-mono-tech text-muted-foreground">WALLET AUTO-PROVISIONED</span>
          <Button
            type="submit"
            className="h-12 rounded-none bg-primary px-7 font-medium hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-2">
      <Label className="font-mono-tech text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
