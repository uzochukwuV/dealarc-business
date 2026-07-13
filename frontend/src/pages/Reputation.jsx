import React from "react";

export default function Reputation() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">REPUTATION</div>
      <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] text-foreground">Deal reputation</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Reputation is updated from settled workspaces on the backend. The workspace flow is wired;
        this page is kept as a lightweight placeholder for the demo.
      </p>
    </div>
  );
}
