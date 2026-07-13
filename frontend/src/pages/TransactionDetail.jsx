import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function TransactionDetail() {
  return (
    <div className="mx-auto max-w-[800px] px-6 py-24 text-center">
      <div className="inline-flex items-center gap-2 font-mono-tech text-muted-foreground">
        <FileText className="h-4 w-4" /> TRANSACTION DETAIL
      </div>
      <h1 className="mt-4 font-heading text-3xl font-medium text-foreground">
        Transaction history is not exposed by the backend yet.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        This route used to read from Base44. The current backend exposes wallet balances and workspace funding state, but not a transaction ledger or receipt lookup.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild className="h-11 rounded-none bg-primary px-6 font-medium hover:bg-primary/90">
          <Link to="/payments">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to payments
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-none border-foreground/25 px-6 font-medium hover:bg-foreground/5">
          <Link to="/workspaces">Open workspaces</Link>
        </Button>
      </div>
    </div>
  );
}
