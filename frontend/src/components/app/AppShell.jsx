import React, { useEffect, useState } from "react";
import { Link, Outlet, Navigate, useLocation } from "react-router-dom";
import { clearAuthSession, getActiveOrganizationId, getCurrentUser, getOrganization } from "@/lib/backend-auth";
import { Loader2, LogOut, Search, Users, Layers, FileText, Wallet, Building2, Award, Settings, LayoutGrid } from "lucide-react";
import VerificationBadge from "@/components/app/VerificationBadge";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/discover", label: "Discover", icon: Search },
  { to: "/connections", label: "Connections", icon: Users },
  { to: "/workspaces", label: "Workspaces", icon: Layers },
  { to: "/contracts", label: "Contracts", icon: FileText },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/organization", label: "Organization", icon: Building2 },
  { to: "/reputation", label: "Reputation", icon: Award },
];

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function NavItem({ item, onNavigate }) {
  const location = useLocation();
  const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex min-h-[44px] items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export default function AppShell() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const me = await getCurrentUser();
    setUser(me);

    const activeOrgId = getActiveOrganizationId(me.id);
    if (!activeOrgId) {
      setOrg(null);
      return null;
    }

    const organization = await getOrganization(activeOrgId);
    setOrg(organization);
    return organization;
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        clearAuthSession();
        setOrg(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return <Navigate to="/onboarding/organization" replace />;
  }

  const reload = async () => {
    const organization = await load();
    setOrg(organization);
  };

  const logout = () => {
    clearAuthSession();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-foreground/15 bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="block h-6 w-6 bg-foreground" />
            <span className="font-heading text-lg font-medium tracking-tight">Counterpart</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center bg-foreground text-[11px] font-medium text-background">
                {initials(org.legalName)}
              </span>
              <div className="leading-tight">
                <div className="text-sm text-foreground">{org.legalName}</div>
                <VerificationBadge status={org.verificationStatus} compact />
              </div>
            </div>
            <button
              onClick={logout}
              className="flex min-h-[40px] items-center gap-2 border border-foreground/20 px-3 text-sm text-foreground transition-colors hover:bg-foreground/5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:hidden">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
      </header>

      <div className="lg:flex">
        <aside className="hidden w-60 shrink-0 border-r border-foreground/15 lg:block">
          <nav className="space-y-1 p-4">
            {NAV.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
            <div className="my-3 border-t border-foreground/10" />
            <NavItem item={{ to: "/settings", label: "Settings", icon: Settings }} />
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet context={{ user, org, reload }} />
        </main>
      </div>
    </div>
  );
}
