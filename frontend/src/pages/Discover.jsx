import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listOrganizations } from "@/lib/backend-auth";
import { Loader2, Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BusinessCard from "@/components/discover/BusinessCard";

const INDUSTRIES = [
  "All",
  "Manufacturing",
  "Logistics & Supply Chain",
  "Agriculture & Agri-processing",
  "Energy & Utilities",
  "Pharmaceuticals",
  "Construction",
  "Technology & Software",
  "Financial Services",
  "Retail & Wholesale",
];

export default function Discover() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("All");
  const [location, setLocation] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const [matchQuery, setMatchQuery] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResults, setMatchResults] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const records = await listOrganizations({ limit: 50 });
        setOrgs(records);
      } catch {
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredOrgs = useMemo(() => {
    console.log(orgs)
    return orgs.filter((org) => {
      if (verifiedOnly && org.verificationStatus !== "VERIFIED") return false;
      if (industry !== "All" && org.industry !== industry) return false;
      if (location) {
        const regions = (org.regionsServed || []).join(" ").toLowerCase();
        if (!regions.includes(location.toLowerCase())) return false;
      }
      if (query) {
        const haystack = [
          org.legalName,
          org.tradingName,
          org.industry,
          org.publicProfile?.productsServices,
          org.publicProfile?.description,
          ...(org.regionsServed || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [orgs, query, industry, location, verifiedOnly]);

  const runMatch = async () => {
    const prompt = matchQuery.trim();
    if (!prompt) return;

    setMatchLoading(true);
    setMatchResults(null);

    try {
      const scored = orgs
        .filter((org) => org.verificationStatus === "VERIFIED")
        .map((org) => {
          const haystack = [
            org.legalName,
            org.tradingName,
            org.industry,
            org.publicProfile?.productsServices,
            org.publicProfile?.description,
            ...(org.regionsServed || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const terms = prompt.toLowerCase().split(/\s+/).filter(Boolean);
          const hits = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
          const bonus = org.industry && prompt.toLowerCase().includes(org.industry.toLowerCase()) ? 2 : 0;
          return {
            org,
            score: Math.min(100, hits * 18 + bonus * 10 + Math.round((org.stats?.reputation?.score || 0) / 10)),
            reason: buildMatchReason(org, prompt),
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setMatchResults(scored);
    } finally {
      setMatchLoading(false);
    }
  };

  const opportunityTab = (
    <EmptyState
      title="Opportunity marketplace is not connected yet."
      text="Verified organizations are available now. Opportunity listings will appear once the backend exposes that resource."
    />
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">DISCOVER / NETWORK</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        Find your counterparty.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Search verified organizations and prepare connection requests. Every listed counterparty carries a KYB attestation and a reputation record.
      </p>

      <div className="mt-10 border border-foreground/15 bg-card p-6">
        <div className="flex items-center gap-2 font-mono-tech text-muted-foreground">
          <Sparkles className="h-4 w-4" /> MATCH ASSIST
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe what you need in plain language.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={matchQuery}
            onChange={(e) => setMatchQuery(e.target.value)}
            placeholder="Find a logistics provider that handles cold-chain between Lagos and Accra"
            className="h-12 flex-1 rounded-none border-foreground/20"
            onKeyDown={(e) => e.key === "Enter" && runMatch()}
          />
          <Button
            onClick={runMatch}
            disabled={matchLoading || !matchQuery.trim()}
            className="h-12 rounded-none bg-primary px-6 font-medium hover:bg-primary/90"
          >
            {matchLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Find matches
              </>
            )}
          </Button>
        </div>

        {matchResults && (
          <div className="mt-6 border-t border-foreground/10 pt-6">
            {matchResults.length === 0 ? (
              <p className="font-mono-tech text-muted-foreground">NO RANKED MATCHES</p>
            ) : (
              <ul className="space-y-3">
                {matchResults.map(({ org, score, reason }, index) => (
                  <li
                    key={org.id}
                    className="flex cursor-pointer items-start gap-4 border border-foreground/15 p-4 transition-colors hover:bg-foreground/5"
                    onClick={() => navigate(`/discover/business/${org.id}`)}
                  >
                    <span className="font-mono-tech mt-0.5 text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{org.legalName}</span>
                        <span className="font-mono text-[11px] text-[hsl(170,60%,30%)]">
                          {Math.round(score)}% MATCH
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-col gap-4 border-y border-foreground/15 py-5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, product, or service..."
            className="h-11 rounded-none border-foreground/20 pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="h-11 rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
          >
            {INDUSTRIES.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All industries" : item}
              </option>
            ))}
          </select>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="h-11 w-40 rounded-none border-foreground/20"
          />
          <label className="flex h-11 cursor-pointer items-center gap-2 border border-foreground/20 px-3 text-sm">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-4 w-4 accent-[hsl(213,56%,23%)]"
            />
            Verified only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="businesses" className="mt-8">
          <TabsList className="rounded-none border border-foreground/15 bg-transparent p-1">
            <TabsTrigger
              value="businesses"
              className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              Businesses ({filteredOrgs.length})
            </TabsTrigger>
            <TabsTrigger
              value="opportunities"
              className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              Opportunities (0)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="businesses">
            {filteredOrgs.length === 0 ? (
              <EmptyState title="No businesses match your filters." text="Try broadening the search." />
            ) : (
              <div className="grid grid-cols-1 gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOrgs.map((org) => (
                  <div key={org.id} className="bg-background">
                    <BusinessCard org={org} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="opportunities">{opportunityTab}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="border border-foreground/15 bg-card py-20 text-center">
      <p className="font-mono-tech text-muted-foreground">{title.toUpperCase()}</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function buildMatchReason(org, query) {
  const reasons = [];
  const normalized = query.toLowerCase();
  const profile = org.publicProfile || {};
  const regions = org.regionsServed || [];

  if (org.industry && normalized.includes(org.industry.toLowerCase())) {
    reasons.push(`industry match with ${org.industry}`);
  }
  if (profile.productsServices && profile.productsServices.toLowerCase().includes(normalized.split(/\s+/)[0] || "")) {
    reasons.push("product/service overlap");
  }
  if (regions.some((region) => normalized.includes(region.toLowerCase()))) {
    reasons.push("location overlap");
  }

  if (reasons.length === 0) {
    reasons.push("best available fit from verified organization catalog");
  }

  return reasons[0];
}
