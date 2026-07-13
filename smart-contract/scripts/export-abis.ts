import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CONTRACTS = [
  "Identity",
  "VerificationRegistry",
  "Reputation",
  "TemplateRegistry",
  "AgreementTemplate",
  "EscrowSplitTemplate",
  "InvoiceTemplate",
  "ArbitrationTemplate",
  "SubscriptionTemplate",
  "RevenueShareTemplate",
];

async function main() {
  console.log("Exporting ABIs...\n");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputDir = path.join(__dirname, "..", "abis");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const contractName of CONTRACTS) {
    try {
      const artifact = await hre.artifacts.readArtifact(contractName);
      const outputPath = path.join(outputDir, contractName + ".json");

      fs.writeFileSync(
        outputPath,
        JSON.stringify(
          {
            contractName: artifact.contractName,
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            sourceName: artifact.sourceName,
          },
          null,
          2,
        ),
      );

      console.log("  ? " + contractName + " ABI exported to " + outputPath);
    } catch (error) {
      console.error("  ? Failed to export " + contractName + ": " + error);
    }
  }

  const combinedPath = path.join(outputDir, "index.json");
  const combined: Record<string, unknown> = {};

  for (const contractName of CONTRACTS) {
    try {
      const artifact = await hre.artifacts.readArtifact(contractName);
      combined[contractName] = {
        abi: artifact.abi,
        bytecode: artifact.bytecode,
      };
    } catch (error) {
      console.error("  ? Failed to include " + contractName + " in combined export");
    }
  }

  fs.writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
  console.log("\n  ? Combined ABIs exported to " + combinedPath);
  console.log("\nDone!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
