import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Globe, MapPin, Award } from "lucide-react";
import VerificationBadge from "@/components/app/VerificationBadge";
import ConnectionRequestDialog from "@/components/discover/ConnectionRequestDialog";
import { getOrganizationStats } from "@/lib/backend-auth";

export default function BusinessProfile() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrganizationStats(orgId);
        setOrg(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-24 text-center">
        <h1 className="font-heading text-3xl font-medium">Organization not found</h1>
        <Link
          to="/discover"
          className="mt-6 inline-flex items-center text-primary hover:underline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to discover
        </Link>
      </div>
    );
  }

  const regions = org.regionsServed || [];
  const profile = org.publicProfile || {};
  const certs = profile.certifications || [];
  const reputation = org.stats?.reputation || {};

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10">
      <Link
        to="/discover"
        className="inline-flex items-center font-mono-tech text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> BACK TO DISCOVER
      </Link>

      <div className="mt-6 border border-foreground/15 bg-card p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <span className="flex h-16 w-16 items-center justify-center bg-foreground text-xl font-medium text-background">
              {monogram(org.legalName)}
            </span>
            <div>
              <h1 className="font-heading text-3xl font-medium leading-tight text-foreground">
                {org.legalName}
              </h1>
              {org.tradingName && (
                <div className="mt-1 text-sm text-muted-foreground">
                  Trading as {org.tradingName}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <VerificationBadge status={org.verificationStatus} />
                <span className="font-mono-tech text-muted-foreground">
                  {org.industry || "-"}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-12 rounded-none bg-primary px-7 font-medium hover:bg-primary/90"
          >
            Request connection
          </Button>
        </div>
      </div>

      <div className="mt-px grid grid-cols-1 lg:grid-cols-3">
        <div className="border border-foreground/15 bg-card p-8 lg:col-span-1">
          <div className="font-mono-tech text-muted-foreground">REPUTATION</div>
          <div className="mt-6 space-y-px">
            <Metric label="Completed deals" value={reputation.completedDeals || 0} />
            <Metric label="Financed deals" value={reputation.financedDeals || 0} />
            <Metric label="Total volume" value={reputation.totalVolume || 0} />
            <Metric label="Score" value={reputation.score || 0} last />
          </div>
          <p className="mt-6 font-mono text-[11px] leading-relaxed text-muted-foreground">
            Reputation reflects verified deal activity and on-chain attestation.
          </p>
        </div>

        <div className="border border-foreground/15 bg-card p-8 lg:col-span-2 lg:border-l-0">
          <div className="font-mono-tech text-muted-foreground">ORGANIZATION PROFILE</div>

          {profile.description && (
            <p className="mt-5 text-base leading-relaxed text-foreground">{profile.description}</p>
          )}

          {profile.productsServices && (
            <div className="mt-6">
              <h3 className="font-mono-tech text-foreground">PRODUCTS / SERVICES</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {profile.productsServices}
              </p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {regions.length > 0 && (
              <div>
                <h3 className="font-mono-tech text-foreground">MARKETS SERVED</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {regions.map((region) => (
                    <li key={region} className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {region}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {certs.length > 0 && (
              <div>
                <h3 className="font-mono-tech text-foreground">CERTIFICATIONS</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {certs.map((cert) => (
                    <li key={cert} className="flex items-center gap-2">
                      <Award className="h-3.5 w-3.5" /> {cert}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.website && (
              <div>
                <h3 className="font-mono-tech text-foreground">WEBSITE</h3>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConnectionRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        targetOrg={org}
        onSubmitted={() => navigate("/connections")}
      />
    </div>
  );
}

function Metric({ label, value, last }) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${last ? "" : "border-b border-foreground/10"}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-medium text-foreground">{value}</span>
    </div>
  );
}

function monogram(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
