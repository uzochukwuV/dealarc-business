import React from "react";

export default function Testimonial() {
  return (
    <section id="process" className="border-b border-foreground/15 bg-background">
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-2">
            <span className="font-heading text-6xl leading-none text-foreground/25">“</span>
          </div>
          <blockquote className="col-span-12 md:col-span-9">
            <p className="font-heading text-[clamp(1.5rem,3.2vw,2.6rem)] font-normal leading-[1.18] text-foreground">
              We closed a six-figure cross-border order in days, not months.
              Counterpart replaced three tools and two intermediaries — and for
              the first time, we had a single provable record of who agreed to what.
            </p>
            <footer className="mt-9 flex flex-col gap-1 border-t border-foreground/15 pt-6 text-base text-muted-foreground">
              <span className="font-medium text-foreground">Adaeze Okonkwo</span>
              <span>Director of Procurement · Meridian Industrial Group</span>
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}