import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";

export default function OpportunityDetail() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-20">
      <Link
        to="/discover"
        className="inline-flex items-center font-mono-tech text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> BACK TO DISCOVER
      </Link>

      <div className="mt-6 border border-foreground/15 bg-card p-8">
        <div className="flex items-center gap-3 font-mono-tech text-muted-foreground">
          <Lock className="h-4 w-4" /> OPPORTUNITY MARKETPLACE
        </div>
        <h1 className="mt-4 font-heading text-3xl font-medium text-foreground">
          Opportunity detail is not wired to the backend yet.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The current API exposes verified organizations and connections. The opportunity marketplace is still a frontend placeholder, so this route now fails closed instead of calling the removed Base44 entity.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className="h-11 rounded-none bg-primary px-6 font-medium hover:bg-primary/90">
            <Link to="/discover">Browse verified organizations</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-none border-foreground/25 px-6 font-medium hover:bg-foreground/5">
            <Link to="/connections">Open connections</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
