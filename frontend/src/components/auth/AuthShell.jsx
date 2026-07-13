import React from "react";
import { Link } from "react-router-dom";

export default function AuthShell({ eyebrow, title, subtitle, footer, children }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Verification thread */}
      <div className="h-px w-full overflow-hidden bg-foreground/10">
        <div className="animate-thread h-px w-full bg-primary" />
      </div>

      {/* Top bar */}
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="block h-6 w-6 bg-foreground" />
            <span className="font-heading text-xl font-medium tracking-tight text-foreground">
              Counterpart
            </span>
          </Link>
          <span className="font-mono-tech text-muted-foreground">SECURE SESSION</span>
        </div>
      </header>

      {/* Main pane */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[460px]">
          <div className="border border-foreground/15 bg-card p-8 md:p-12">
            <div className="font-mono-tech text-muted-foreground">{eyebrow}</div>
            <h1 className="mt-4 font-heading text-[2rem] font-medium leading-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
            <div className="mt-8">{children}</div>
          </div>

          {footer && (
            <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
          )}
        </div>
      </div>

      {/* Bottom micro-data cluster */}
      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3 font-mono-tech text-muted-foreground">
          <span>AES-256 // TLS 1.3</span>
          <span className="hidden sm:inline">END-TO-END ENCRYPTED CHANNEL</span>
        </div>
      </footer>
    </div>
  );
}