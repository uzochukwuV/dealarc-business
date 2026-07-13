import React from "react";

const STEPS = [
  { key: "organization", label: "Profile" },
  { key: "documents", label: "Documents" },
  { key: "team", label: "Team" },
  { key: "pending", label: "Review" },
];

export default function StructuralStack({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div>
      <div className="font-mono-tech text-muted-foreground">VERIFICATION STACK</div>
      <ol className="mt-6 space-y-3">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.key} className="flex items-center gap-4">
              <span
                className={`flex h-9 w-9 items-center justify-center border text-[13px] font-mono transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 bg-transparent text-muted-foreground"
                }`}
              >
                {done ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <div
                  className={`text-sm font-medium ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </div>
                {active && (
                  <div className="mt-1.5 h-px w-full overflow-hidden bg-foreground/10">
                    <div className="animate-thread h-px w-full bg-primary" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}