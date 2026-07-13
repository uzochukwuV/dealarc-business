import React from "react";
import SiteNav from "@/components/marketing/SiteNav";
import Hero from "@/components/marketing/Hero";
import SolutionRows from "@/components/marketing/SolutionRows";
import SocialProof from "@/components/marketing/SocialProof";
import Testimonial from "@/components/marketing/Testimonial";
import FinalCta from "@/components/marketing/FinalCta";
import Footer from "@/components/marketing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Verification thread — animated top line */}
      <div className="h-1 w-full overflow-hidden bg-foreground/10">
        <div className="animate-thread h-1 w-full bg-primary" />
      </div>

      <SiteNav />
      <main>
        <Hero />
        <SolutionRows />
        <SocialProof />
        <Testimonial />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}