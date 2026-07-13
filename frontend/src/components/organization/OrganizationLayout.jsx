import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Building2, Users, ShieldCheck, Wallet, CheckSquare } from "lucide-react";

const ORG_NAV = [
  { to: "profile", label: "Profile", icon: Building2 },
  { to: "team", label: "Team", icon: Users },
  { to: "verification", label: "Verification", icon: ShieldCheck },
  { to: "wallets", label: "Wallets", icon: Wallet },
  { to: "approval-policies", label: "Approval policies", icon: CheckSquare },
];

export default function OrganizationLayout() {
  return (
    <div className="lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-foreground/15 lg:block">
        <div className="p-4">
          <div className="px-3 pb-3 font-mono-tech text-muted-foreground">ORGANIZATION</div>
          <nav className="space-y-1">
            {ORG_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="border-b border-foreground/15 lg:hidden">
        <nav className="flex gap-1 overflow-x-auto px-2 py-2">
          {ORG_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 border px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 text-muted-foreground"
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}