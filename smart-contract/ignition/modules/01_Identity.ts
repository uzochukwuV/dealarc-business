import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const IdentityModule = buildModule("IdentityModule", (m) => {
  const identity = m.contract("Identity");

  return { identity };
});
