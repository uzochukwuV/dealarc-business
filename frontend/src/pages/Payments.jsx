import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Loader2, ArrowDownToLine, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrganizationWallet } from "@/lib/backend-auth";
import { listWorkspaces } from "@/backend/workspaces";

function fmtMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
}

export default function Payments() {
  const { org } = useOutletContext();
  const [wallet, setWallet] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [walletData, workspaceData] = await Promise.all([
          org?.id ? getOrganizationWallet(org.id) : Promise.resolve(null),
          listWorkspaces(),
        ]);
        setWallet(walletData);
        setWorkspaces(workspaceData);
      } catch {
        setWallet(null);
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [org?.id]);

  const pendingWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.status === "AWAITING_FUNDING"),
    [workspaces],
  );

  const balances = wallet?.balances || [];
  const totalUsdc = balances.reduce((sum, balance) => {
    const amount = Number(balance.amount || 0);
    return balance.currency === "USDC" ? sum + amount : sum;
  }, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">PAYMENTS</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">
        Wallet overview
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        The backend currently exposes wallet balances and workspace funding state. A full transaction ledger is not available yet, so this page shows the real wallet surface instead of a fake history.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-3">
        <div className="bg-card p-7">
          <div className="font-mono-tech text-muted-foreground">AVAILABLE BALANCE</div>
          <div className="mt-3 font-heading text-3xl font-medium text-foreground">{fmtMoney(totalUsdc)}</div>
          <div className="mt-2 text-sm text-muted-foreground">From the active organization wallet</div>
        </div>
        <div className="bg-card p-7">
          <div className="font-mono-tech text-muted-foreground">PENDING FUNDING</div>
          <div className="mt-3 font-heading text-3xl font-medium text-foreground">{pendingWorkspaces.length}</div>
          <div className="mt-2 text-sm text-muted-foreground">Workspaces waiting for escrow funding</div>
        </div>
        <div className="bg-card p-7">
          <div className="font-mono-tech text-muted-foreground">WALLET STATUS</div>
          <div className="mt-3 font-heading text-3xl font-medium text-foreground">{wallet ? "LIVE" : "MISSING"}</div>
          <div className="mt-2 text-sm text-muted-foreground">Circle developer wallet</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild className="h-12 rounded-none bg-primary px-6 font-medium hover:bg-primary/90">
          <Link to="/workspaces">
            <ShieldCheck className="mr-2 h-4 w-4" /> Review workspaces
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-none border-foreground/25 hover:bg-foreground/5">
          <a href={wallet?.circleWalletId ? `https://portal.circle.com/wallets/${wallet.circleWalletId}` : "#"} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Open Circle wallet
          </a>
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <div className="font-mono-tech text-muted-foreground">BALANCE BREAKDOWN</div>
          <div className="mt-4 border border-foreground/15 bg-card">
            {balances.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">No wallet balances returned by the backend.</div>
            ) : (
              balances.map((balance, index) => (
                <div key={`${balance.currency}-${index}`} className={`flex items-center justify-between px-5 py-4 ${index !== balances.length - 1 ? "border-b border-foreground/10" : ""}`}>
                  <div>
                    <div className="text-sm text-foreground">{balance.currency}</div>
                    <div className="font-mono-tech text-muted-foreground">CIRCLE BALANCE</div>
                  </div>
                  <div className="font-heading text-xl font-medium text-foreground">{fmtMoney(Number(balance.amount || 0))}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="font-mono-tech text-muted-foreground">AWAITING FUNDING</div>
          <div className="mt-4 border border-foreground/15 bg-card">
            {pendingWorkspaces.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">No workspaces are waiting for funding.</div>
            ) : (
              pendingWorkspaces.map((workspace, index) => (
                <Link
                  key={workspace.id}
                  to={`/workspaces/${workspace.id}/contract`}
                  className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-foreground/5 ${index !== pendingWorkspaces.length - 1 ? "border-b border-foreground/10" : ""}`}
                >
                  <div>
                    <div className="text-sm text-foreground">{workspace.title}</div>
                    <div className="font-mono-tech text-muted-foreground">{workspace.counterparty_org_name || "Counterparty pending"}</div>
                  </div>
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {wallet && (
        <div className="mt-10 border border-foreground/15 bg-secondary p-5">
          <div className="font-mono-tech text-muted-foreground">WALLET DETAILS</div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="font-mono-tech text-muted-foreground">CIRCLE WALLET ID</div>
              <div className="mt-1 break-all font-mono text-sm text-foreground">{wallet.circleWalletId}</div>
            </div>
            <div>
              <div className="font-mono-tech text-muted-foreground">BLOCKCHAIN ADDRESS</div>
              <div className="mt-1 break-all font-mono text-sm text-foreground">{wallet.blockchainAddress || "-"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
