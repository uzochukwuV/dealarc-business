import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const NAV_LINKS = [
  { label: "Network", href: "#network" },
  { label: "Process", href: "#process" },
  { label: "Trust", href: "#trust" },
  { label: "Security", href: "#security" },
];

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
      {/* Status strip — micro-data cluster */}
      <div className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-2 font-mono-tech text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(142,69%,45%)] animate-blink" />
            VERIFIED LEDGER ONLINE
          </span>
          <span className="hidden sm:inline">AES-256 ENCRYPTED // NODE_04 // v1.0</span>
        </div>
      </div>

      <header
        className={`border-b transition-colors duration-300 ${
          scrolled ? "border-foreground/10" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Counterpart home">
            <span className="block h-6 w-6 rounded-md bg-primary" />
            <span className="font-heading text-xl font-medium tracking-tight text-foreground">
              Counterpart
            </span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-foreground/80 transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <Link
              to="/login"
              className="hidden text-sm text-foreground/80 transition-colors hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Request access
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}