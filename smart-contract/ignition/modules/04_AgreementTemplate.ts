import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { TemplateRegistryModule } from "./03_TemplateRegistry";

export const AgreementTemplateModule = buildModule(
  "AgreementTemplateModule",
  (m) => {
    const { registry, reputation } = m.useModule(TemplateRegistryModule);

    const agreementTemplate = m.contract("AgreementTemplate", [
      reputation,
      registry,
    ]);

    // Register and authorize the template
    m.call(registry, "registerTemplate", [
      agreementTemplate,
      "Agreement Template",
    ]);
    m.call(registry, "authorizeTemplate", [agreementTemplate]);

    return { agreementTemplate, registry, reputation };
  }
);
