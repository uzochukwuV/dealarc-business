import React from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, Copy, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

function fmtMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
}

export default function OrganizationWallets() {
  const { org } = useOutletContext();
  const wallets = org?.wallets?.length ? org.wallets : [];

  const copyAddress = (addr) => {
    navigator.clipboard?.writeText(addr);
    toast({ title: "Address copied" });
  };

  return (
    <div className="mx-auto max-w-[800px] px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">ORGANIZATION / WALLETS</div>
          <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
            Wallets
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            On-chain treasury wallets provisioned automatically for your organization by the platform.
            These are the addresses backing your business balance.
          </p>
        </div>
      </div>

      {wallets.length === 0 ? (
        <div className="mt-8 border border-foreground/15 bg-card py-16 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-mono-tech text-muted-foreground">NO WALLETS PROVISIONED</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Wallets are created during organization setup. If none appear, re-run onboarding or contact support.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-px border border-foreground/15">
          {wallets.map((w, i) => (
            <div key={i} className="bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-foreground text-background">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-medium text-foreground">
                      {w.blockchainAddress ? "Treasury" : "Wallet"}
                    </h3>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {w.chain || "—"} · {w.purpose || "TREASURY"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-xl font-medium text-foreground">{fmtMoney(0)}</div>
                  <div className="font-mono-tech text-muted-foreground">BALANCE</div>
                </div>
              </div>
              <div className="mt-4 border border-foreground/10 bg-background p-3">
                <div className="font-mono-tech text-muted-foreground">ADDRESS</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="break-all font-mono text-xs text-foreground">
                    {w.blockchainAddress || "— not generated —"}
                  </code>
                  {w.blockchainAddress && (
                    <button
                      onClick={() => copyAddress(w.blockchainAddress)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {w.circleWalletId && (
                  <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                    walletId: {w.circleWalletId}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
