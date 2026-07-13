import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";

const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

// Get network from command line
const NETWORK = process.env.HARDHAT_NETWORK || 
  process.argv.includes("arcTestnet") ? "arcTestnet" :
  process.argv.includes("polygonAmoy") ? "polygonAmoy" : "unknown";

// Select RPC URL based on network - use direct URLs
const RPC_URL = NETWORK === "arcTestnet" 
  ? "https://arc-testnet.drpc.org"
  : "https://rpc-amoy.polygon.technology";

// Helper to load artifact
function loadArtifact(name: string) {
  const artifact = JSON.parse(fs.readFileSync(`./artifacts/contracts/${name}.sol/${name}.json`, "utf-8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

async function main() {
  console.log(`Deploying RWA/Trade Finance Protocol to ${NETWORK}...\n`);
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Private Key loaded: ${PRIVATE_KEY ? 'Yes' : 'No'}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deploying with account: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Deploy VerificationRegistry
  console.log("1. Deploying VerificationRegistry...");
  const vrArtifact = loadArtifact("VerificationRegistry");
  const VerificationRegistry = new ethers.ContractFactory(vrArtifact.abi, vrArtifact.bytecode, wallet);
  const verification = await VerificationRegistry.deploy({ gasLimit: 5000000 });
  await verification.waitForDeployment();
  const verificationAddress = await verification.getAddress();
  console.log(`   VerificationRegistry deployed to: ${verificationAddress}`);

  // Deploy FeeController
  console.log("2. Deploying FeeController...");
  const fcArtifact = loadArtifact("FeeController");
  const FeeController = new ethers.ContractFactory(fcArtifact.abi, fcArtifact.bytecode, wallet);
  const feeController = await FeeController.deploy(TREASURY_ADDRESS || wallet.address, { gasLimit: 5000000 });
  await feeController.waitForDeployment();
  const feeControllerAddress = await feeController.getAddress();
  console.log(`   FeeController deployed to: ${feeControllerAddress}`);

  // Deploy ArbitrationTemplate
  console.log("3. Deploying ArbitrationTemplate...");
  const arbArtifact = loadArtifact("ArbitrationTemplate");
  const ArbitrationTemplate = new ethers.ContractFactory(arbArtifact.abi, arbArtifact.bytecode, wallet);
  const arbitration = await ArbitrationTemplate.deploy({ gasLimit: 5000000 });
  await arbitration.waitForDeployment();
  const arbitrationAddress = await arbitration.getAddress();
  console.log(`   ArbitrationTemplate deployed to: ${arbitrationAddress}`);

  // Deploy Identity
  console.log("4. Deploying Identity...");
  const idArtifact = loadArtifact("Identity");
  const Identity = new ethers.ContractFactory(idArtifact.abi, idArtifact.bytecode, wallet);
  const identity = await Identity.deploy({ gasLimit: 5000000 });
  await identity.waitForDeployment();
  const identityAddress = await identity.getAddress();
  console.log(`   Identity deployed to: ${identityAddress}`);

  // Deploy Reputation
  console.log("5. Deploying Reputation...");
  const repArtifact = loadArtifact("Reputation");
  const Reputation = new ethers.ContractFactory(repArtifact.abi, repArtifact.bytecode, wallet);
  const reputation = await Reputation.deploy(identityAddress, { gasLimit: 5000000 });
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log(`   Reputation deployed to: ${reputationAddress}`);

  // Deploy TemplateRegistry
  console.log("6. Deploying TemplateRegistry...");
  const trArtifact = loadArtifact("TemplateRegistry");
  const TemplateRegistry = new ethers.ContractFactory(trArtifact.abi, trArtifact.bytecode, wallet);
  const registry = await TemplateRegistry.deploy(reputationAddress, { gasLimit: 5000000 });
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   TemplateRegistry deployed to: ${registryAddress}`);

  // Deploy AgreementTemplate
  console.log("7. Deploying AgreementTemplate...");
  const agArtifact = loadArtifact("AgreementTemplate");
  const AgreementTemplate = new ethers.ContractFactory(agArtifact.abi, agArtifact.bytecode, wallet);
  const agreementTemplate = await AgreementTemplate.deploy(
    reputationAddress, 
    registryAddress, 
    verificationAddress,
    { gasLimit: 5000000 }
  );
  await agreementTemplate.waitForDeployment();
  const agreementTemplateAddress = await agreementTemplate.getAddress();
  console.log(`   AgreementTemplate deployed to: ${agreementTemplateAddress}`);

  // Register and authorize AgreementTemplate
  await registry.registerTemplate(agreementTemplateAddress, "Agreement Template", { gasLimit: 200000 });
  await registry.authorizeTemplate(agreementTemplateAddress, { gasLimit: 200000 });
  console.log("   AgreementTemplate registered and authorized");

  // Deploy EscrowSplitTemplate
  console.log("8. Deploying EscrowSplitTemplate...");
  const esArtifact = loadArtifact("EscrowSplitTemplate");
  const EscrowSplitTemplate = new ethers.ContractFactory(esArtifact.abi, esArtifact.bytecode, wallet);
  const escrowTemplate = await EscrowSplitTemplate.deploy(
    reputationAddress, 
    registryAddress,
    verificationAddress,
    feeControllerAddress,
    arbitrationAddress,
    USDC_ADDRESS,
    { gasLimit: 5000000 }
  );
  await escrowTemplate.waitForDeployment();
  const escrowTemplateAddress = await escrowTemplate.getAddress();
  console.log(`   EscrowSplitTemplate deployed to: ${escrowTemplateAddress}`);

  // Register and authorize EscrowSplitTemplate
  await registry.registerTemplate(escrowTemplateAddress, "Escrow Split Template", { gasLimit: 200000 });
  await registry.authorizeTemplate(escrowTemplateAddress, { gasLimit: 200000 });
  console.log("   EscrowSplitTemplate registered and authorized");

  // Deploy InvoiceTemplate
  console.log("9. Deploying InvoiceTemplate...");
  const invArtifact = loadArtifact("InvoiceTemplate");
  const InvoiceTemplate = new ethers.ContractFactory(invArtifact.abi, invArtifact.bytecode, wallet);
  const invoiceTemplate = await InvoiceTemplate.deploy(
    reputationAddress, 
    registryAddress,
    verificationAddress,
    USDC_ADDRESS,
    { gasLimit: 5000000 }
  );
  await invoiceTemplate.waitForDeployment();
  const invoiceTemplateAddress = await invoiceTemplate.getAddress();
  console.log(`   InvoiceTemplate deployed to: ${invoiceTemplateAddress}`);

  // Register and authorize InvoiceTemplate
  await registry.registerTemplate(invoiceTemplateAddress, "Invoice Template", { gasLimit: 200000 });
  await registry.authorizeTemplate(invoiceTemplateAddress, { gasLimit: 200000 });
  console.log("   InvoiceTemplate registered and authorized");

  // Deploy SubscriptionTemplate
  console.log("10. Deploying SubscriptionTemplate...");
  const subArtifact = loadArtifact("SubscriptionTemplate");
  const SubscriptionTemplate = new ethers.ContractFactory(subArtifact.abi, subArtifact.bytecode, wallet);
  const subscriptionTemplate = await SubscriptionTemplate.deploy(
    reputationAddress,
    registryAddress,
    verificationAddress,
    USDC_ADDRESS,
    { gasLimit: 5000000 }
  );
  await subscriptionTemplate.waitForDeployment();
  const subscriptionTemplateAddress = await subscriptionTemplate.getAddress();
  console.log(`   SubscriptionTemplate deployed to: ${subscriptionTemplateAddress}`);

  // Register and authorize SubscriptionTemplate
  await registry.registerTemplate(subscriptionTemplateAddress, "Subscription Template", { gasLimit: 200000 });
  await registry.authorizeTemplate(subscriptionTemplateAddress, { gasLimit: 200000 });
  console.log("   SubscriptionTemplate registered and authorized");

  // Deploy RevenueShareTemplate
  console.log("11. Deploying RevenueShareTemplate...");
  const rsArtifact = loadArtifact("RevenueShareTemplate");
  const RevenueShareTemplate = new ethers.ContractFactory(rsArtifact.abi, rsArtifact.bytecode, wallet);
  const revenueShareTemplate = await RevenueShareTemplate.deploy(
    reputationAddress,
    registryAddress,
    verificationAddress,
    USDC_ADDRESS,
    { gasLimit: 5000000 }
  );
  await revenueShareTemplate.waitForDeployment();
  const revenueShareTemplateAddress = await revenueShareTemplate.getAddress();
  console.log(`   RevenueShareTemplate deployed to: ${revenueShareTemplateAddress}`);

  // Register and authorize RevenueShareTemplate
  await registry.registerTemplate(revenueShareTemplateAddress, "Revenue Share Template", { gasLimit: 200000 });
  await registry.authorizeTemplate(revenueShareTemplateAddress, { gasLimit: 200000 });
  console.log("   RevenueShareTemplate registered and authorized");

  console.log("\n========================================");
  console.log("PROTOCOL DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  console.log(`Network: ${NETWORK}`);
  console.log("");
  console.log("Contract Addresses:");
  console.log(`  VerificationRegistry:  ${verificationAddress}`);
  console.log(`  FeeController:         ${feeControllerAddress}`);
  console.log(`  ArbitrationTemplate:   ${arbitrationAddress}`);
  console.log(`  Identity:              ${identityAddress}`);
  console.log(`  Reputation:            ${reputationAddress}`);
  console.log(`  TemplateRegistry:      ${registryAddress}`);
  console.log(`  AgreementTemplate:     ${agreementTemplateAddress}`);
  console.log(`  EscrowSplitTemplate:   ${escrowTemplateAddress}`);
  console.log(`  InvoiceTemplate:      ${invoiceTemplateAddress}`);
  console.log(`  SubscriptionTemplate: ${subscriptionTemplateAddress}`);
  console.log(`  RevenueShareTemplate:  ${revenueShareTemplateAddress}`);
  console.log(`  USDC:                 ${USDC_ADDRESS}`);
  console.log(`  Treasury:             ${TREASURY_ADDRESS || wallet.address}`);
  console.log("");
  console.log("Deployer: " + wallet.address);
  console.log("");

  // Save addresses to file
  const addresses = {
    network: NETWORK,
    verificationRegistry: verificationAddress,
    feeController: feeControllerAddress,
    arbitrationTemplate: arbitrationAddress,
    identity: identityAddress,
    reputation: reputationAddress,
    registry: registryAddress,
    agreementTemplate: agreementTemplateAddress,
    escrowTemplate: escrowTemplateAddress,
    invoiceTemplate: invoiceTemplateAddress,
    subscriptionTemplate: subscriptionTemplateAddress,
    revenueShareTemplate: revenueShareTemplateAddress,
    usdc: USDC_ADDRESS,
    treasury: TREASURY_ADDRESS || wallet.address,
    deployer: wallet.address,
  };

  fs.writeFileSync(`deployments-${NETWORK}.json`, JSON.stringify(addresses, null, 2));
  console.log(`Saved deployment addresses to deployments-${NETWORK}.json`);

  console.log("\nNext steps:");
  console.log("1. Verify contracts on explorer:");
  console.log(`   npx hardhat verify --network ${NETWORK} <contract_address> <constructor_args>`);
  console.log("2. Set platform fee: FeeController.setFeeBps(25) // 0.25%");
  console.log("3. Authorize arbitrators: ArbitrationTemplate.authorizeArbitrator(arb_address)");
  console.log("4. Set verification attestations for organizations");
  
  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
