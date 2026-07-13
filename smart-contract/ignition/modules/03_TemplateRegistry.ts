import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ReputationModule } from "./02_Reputation";

export const TemplateRegistryModule = buildModule(
  "TemplateRegistryModule",
  (m) => {
    const { reputation } = m.useModule(ReputationModule);

    const registry = m.contract("TemplateRegistry", [reputation]);

    return { registry, reputation };
  }
);
