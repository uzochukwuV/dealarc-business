import React from "react";
import { useOutletContext } from "react-router-dom";
import { CheckSquare } from "lucide-react";

export default function OrganizationApprovalPolicies() {
  const { org } = useOutletContext();
  // The backend does not yet persist approval_policies or expose an endpoint for

  return (
    <div className="mx-auto max-w-[800px] px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">ORGANIZATION / APPROVAL POLICIES</div>
          <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
            Approval policies
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Deal-approval authority is granted by organization role. Any member holding one of the
            approver roles below can approve deals and payments on behalf of the organization.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-px border border-foreground/15">
        {roles.map((role) => (
          <div key={role} className="flex items-center justify-between bg-card p-5">
            <div>
              <h3 className="font-heading text-base font-medium text-foreground">{role}</h3>
              <p className="text-sm text-muted-foreground">
                {role === "OWNER"
                  ? "Full control, including deleting the organization."
                  : role === "ADMIN"
                    ? "Can manage team, workspaces, and approve."
                    : "Can approve payments and finances."}
              </p>
            </div>
            <span className="font-mono-tech text-[11px] text-[hsl(170,60%,33%)]">APPROVER</span>
          </div>
        ))}
      </div>

      <div className="mt-px border border-[hsl(35,80%,30%)]/20 bg-[hsl(35,80%,30%)]/5 p-5">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-[hsl(35,80%,30%)]" />
          <span className="font-mono-tech text-[hsl(35,80%,30%)]">EDITOR NOT YET AVAILABLE</span>
        </div>
        <p className="mt-2 text-sm text-foreground">
          Value-tier policies with custom approver lists are not yet backed by a backend endpoint.
          Manage approver access via the Team page (role assignment) for now.
        </p>
      </div>
    </div>
  );
}
