import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { TemplateRegistryModule } from "./03_TemplateRegistry";

export const InvoiceTemplateModule = buildModule(
  "InvoiceTemplateModule",
  (m) => {
    const { registry, reputation } = m.useModule(TemplateRegistryModule);

    // Token address - in production, use mainnet/testnet USDC address
    const token = m.getParameter(
      "token",
      "0x0000000000000000000000000000000000000000"
    );

    const invoiceTemplate = m.contract("InvoiceTemplate", [
      reputation,
      registry,
      token,
    ]);

    // Register and authorize the template
    m.call(registry, "registerTemplate", [
      invoiceTemplate,
      "Invoice Template",
    ]);
    m.call(registry, "authorizeTemplate", [invoiceTemplate]);

    return { invoiceTemplate, registry, reputation, token };
  }
);
