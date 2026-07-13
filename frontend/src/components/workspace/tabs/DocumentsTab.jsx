import React from "react";

export default function DocumentsTab() {
  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      <div className="font-mono-tech text-muted-foreground">DOCUMENTS</div>
      <div className="mt-4 border border-foreground/15 bg-card p-6 text-sm text-muted-foreground">
        Document storage is still wired through the organization upload flow. For the workspace demo,
        use the agreement and evidence tabs instead.
      </div>
    </div>
  );
}
