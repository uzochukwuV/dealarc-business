import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.replace(/^\//, "") || "home";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-muted-foreground/30">404</h1>
          <div className="mx-auto h-0.5 w-16 bg-muted-foreground/20" />
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="font-heading text-2xl font-medium text-foreground">Page not found</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The route <span className="font-medium text-foreground">"{pageName}"</span> does not exist in this app.
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-none bg-primary px-5 font-medium hover:bg-primary/90">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" /> Go home
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-none border-foreground/25 px-5 font-medium hover:bg-foreground/5">
            <Link to="/discover">
              <Search className="mr-2 h-4 w-4" /> Explore
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
