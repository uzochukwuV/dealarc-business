import React from "react";
import { Link } from "react-router-dom";

export default function SplitAuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_32%),linear-gradient(180deg,#f7f5ef_0%,#efe9df_100%)]">
      <div className="relative hidden overflow-hidden lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#10231f_0%,#17312d_45%,#25483c_100%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.20),transparent_24%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.14),transparent_18%),radial-gradient(circle_at_60%_80%,rgba(255,255,255,0.10),transparent_20%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(6,18,15,0.55)_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="text-2xl font-medium tracking-tight">
            Counterpart
          </Link>
          <div className="max-w-md">
            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Deal flow</p>
            <p className="mt-4 text-3xl font-normal leading-tight">
              Authenticate once, then move straight into onboarding and workspace setup.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              A clean entry point for organizations, wallets, and the first deal workspace without any legacy Base44 surface area.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-2xl font-medium tracking-tight text-foreground lg:hidden">
            Counterpart
          </Link>

          <div className="mb-8">
            <h1 className="text-foreground text-3xl md:text-4xl font-medium tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-base text-foreground/60">{subtitle}</p>}
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-background/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
            {children}
          </div>

          {footer && <p className="mt-6 text-center text-sm text-foreground/60">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
