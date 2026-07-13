import { ethers } from "ethers";
import * as fs from "fs";

const RPC_URL = "https://arc-testnet.drpc.org";
const PRIVATE_KEY = "0x3dce888d4a577a85840387dd0ce844f3648760107b089c7346e0a6de64d0d5e2";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log("Wallet:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  // Deploy VerificationRegistry with minimal gas
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/VerificationRegistry.sol/VerificationRegistry.json", "utf-8"));
  
  console.log("Deploying VerificationRegistry...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy({ gasLimit: 5000000 });
  console.log("TX sent:", contract.deploymentTransaction()?.hash);
  const receipt = await contract.waitForDeployment();
  console.log("Deployed to:", await contract.getAddress());
}

main().catch(console.error);
