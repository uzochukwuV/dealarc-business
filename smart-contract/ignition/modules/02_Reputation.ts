import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { IdentityModule } from "./01_Identity";

export const ReputationModule = buildModule("ReputationModule", (m) => {
  const { identity } = m.useModule(IdentityModule);

  // TemplateRegistry needs to be deployed first, but we pass a placeholder
  // In production, deploy in order: Identity -> TemplateRegistry -> Reputation
  const registry = m.getParameter("registry", "0x0000000000000000000000000000000000000000");

  const reputation = m.contract("Reputation", [registry]);

  return { reputation, identity };
});
