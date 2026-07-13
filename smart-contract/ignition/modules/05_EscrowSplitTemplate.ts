import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { TemplateRegistryModule } from "./03_TemplateRegistry";

export const EscrowSplitTemplateModule = buildModule(
  "EscrowSplitTemplateModule",
  (m) => {
    const { registry, reputation } = m.useModule(TemplateRegistryModule);

    // USDC address - in production, use mainnet/testnet address
    const usdc = m.getParameter(
      "usdc",
      "0x0000000000000000000000000000000000000000"
    );

    const escrowTemplate = m.contract("EscrowSplitTemplate", [
      reputation,
      registry,
      usdc,
    ]);

    // Register and authorize the template
    m.call(registry, "registerTemplate", [
      escrowTemplate,
      "Escrow Split Template",
    ]);
    m.call(registry, "authorizeTemplate", [escrowTemplate]);

    return { escrowTemplate, registry, reputation, usdc };
  }
);
