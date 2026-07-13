import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { UserCircle, Bell } from "lucide-react";

const SETTINGS_NAV = [
  { to: "account", label: "Account", icon: UserCircle },
  { to: "notifications", label: "Notifications", icon: Bell },
];

export default function SettingsLayout() {
  return (
    <div className="lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-foreground/15 lg:block">
        <div className="p-4">
          <div className="px-3 pb-3 font-mono-tech text-muted-foreground">SETTINGS</div>
          <nav className="space-y-1">
            {SETTINGS_NAV.map((item) => {
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

      <div className="border-b border-foreground/15 lg:hidden">
        <nav className="flex gap-1 overflow-x-auto px-2 py-2">
          {SETTINGS_NAV.map((item) => {
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