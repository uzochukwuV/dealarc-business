import React from "react";
import { WORKSPACE_STATUS } from "@/lib/workspace-utils";

export default function WorkspaceStatusBadge({ status }) {
  const cfg = WORKSPACE_STATUS[status] || WORKSPACE_STATUS.NEGOTIATING;
  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-medium ${cfg.style}`}>
      {cfg.label}
    </span>
  );
}