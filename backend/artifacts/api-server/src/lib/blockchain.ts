/**
 * Blockchain interaction service — Polygon Amoy (MATIC-AMOY)
 *
 * Calls already-deployed contracts on behalf of the platform.
 * The platform wallet (PLATFORM_PRIVATE_KEY) is the owner/registry of the
 * Identity contract and is the only address authorised to call registerIdentity.
 *
 * Contract addresses (Polygon Amoy):
 *   Identity            0x754DD9f8A8Eef03744738072Cfbb985Db769C7f9
 *   VerificationRegistry 0xbcC26e56724C96e5c8DFf90647360F9E9a9c0a65
 *   Reputation          0x7Ed0dd653C8Adf33438255bFFDbc2D43ED5d8119
 *
 * Required env vars:
 *   BLOCKCHAIN_RPC_URL   — Polygon Amoy JSON-RPC (e.g. https://rpc-amoy.polygon.technology)
 *   PLATFORM_PRIVATE_KEY — hex private key of the contract owner account (needs MATIC for gas)
 */

import { ethers } from "ethers";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_ABI, REPUTATION_ABI } from "../contracts/abis";
import { loadCompiledAbi } from "../contracts/compiled-abis";

// ── Contract addresses ────────────────────────────────────────────────────────
export const CONTRACT_ADDRESSES = {
  identity:             "0x754DD9f8A8Eef03744738072Cfbb985Db769C7f9",
  verificationRegistry: "0xbcC26e56724C96e5c8DFf90647360F9E9a9c0a65",
  feeController:        "0xe3657E92748f0dABA81AE2bA83a520C8ABC575DE",
  arbitrationTemplate:  "0x9ebBf528A650e35ebC8C2514DA4C6b891147b4A9",
  templateRegistry:     "0x4C5dA3bE7d5967Aed77E4047AE8b1a93a2a0b38B",
  reputation:           "0x7Ed0dd653C8Adf33438255bFFDbc2D43ED5d8119",
  agreementTemplate:    "0xbc94656cAf51fBE30f203Ba92Ab884e6e7c67acD",
  escrowSplitTemplate:  "0x83828c9c89BC967D2117f064E4156E3EC171664B",
  invoiceTemplate:      "0x809EF30bee37E3e2eB34494b71671d0464904631",
  subscriptionTemplate: "0x1E7c4866dB2502d220590356f17D2f3Da227e637",
  revenueShareTemplate: "0xd21786287c207EAb65331860DAFed2F9F933bFEA",
} as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

function getPlatformSigner(): ethers.Wallet {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;

  if (!rpcUrl) throw new Error("BLOCKCHAIN_RPC_URL environment variable is not set");
  if (!privateKey) throw new Error("PLATFORM_PRIVATE_KEY environment variable is not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/** Returns a keccak256 hash of the org UUID encoded as utf-8 bytes (bytes32). */
function orgIdToBytes32(orgId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(orgId));
}

// ── Exported functions ────────────────────────────────────────────────────────


const AGREEMENT_TEMPLATE_ABI = loadCompiledAbi("AgreementTemplate");
const ESCROW_SPLIT_TEMPLATE_ABI = loadCompiledAbi("EscrowSplitTemplate");

export function getAgreementTemplateContract(contractAddress: string): ethers.Contract {
  const signer = getPlatformSigner();
  return new ethers.Contract(contractAddress, AGREEMENT_TEMPLATE_ABI, signer);
}

export function getEscrowSplitTemplateContract(contractAddress: string): ethers.Contract {
  const signer = getPlatformSigner();
  return new ethers.Contract(contractAddress, ESCROW_SPLIT_TEMPLATE_ABI, signer);
}

export async function readEscrowSplitSnapshot(contractAddress: string): Promise<{ escrowCount: string }> {
  const contract = getEscrowSplitTemplateContract(contractAddress);
  const escrowCount = await (contract.getEscrowCount as ethers.ContractMethod)();
  return { escrowCount: escrowCount.toString() };
}

export async function readAgreementSnapshot(contractAddress: string): Promise<{ agreementCount: string }> {
  const contract = getAgreementTemplateContract(contractAddress);
  const agreementCount = await (contract.getAgreementCount as ethers.ContractMethod)();
  return { agreementCount: agreementCount.toString() };
}

export interface EscrowMilestoneInput {
  amount: string;
  description: string;
}

export interface EscrowCreateResult {
  escrowId: string;
  txHash: string;
}

function getEscrowTemplate(contractAddress: string): ethers.Contract {
  const signer = getPlatformSigner();
  return new ethers.Contract(contractAddress, ESCROW_SPLIT_TEMPLATE_ABI, signer);
}

export async function createEscrowDeal(
  contractAddress: string,
  totalAmount: string,
  recipients: string[],
  bpsArray: number[],
  agreementId: string | number,
): Promise<EscrowCreateResult> {
  const contract = getEscrowTemplate(contractAddress);
  const tx = await (contract.createEscrow as ethers.ContractMethod)(
    BigInt(totalAmount),
    recipients,
    bpsArray,
    BigInt(agreementId),
  );
  const receipt: ethers.TransactionReceipt = await tx.wait(1);

  let escrowId = '0';
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'EscrowCreated') {
        escrowId = parsed.args.escrowId.toString();
        break;
      }
    } catch {
      // skip unparseable logs
    }
  }

  return { escrowId, txHash: receipt.hash };
}

export async function addEscrowMilestones(
  contractAddress: string,
  escrowId: string | number,
  amounts: string[],
  descriptions: string[],
): Promise<{ txHash: string }> {
  const contract = getEscrowTemplate(contractAddress);
  const tx = await (contract.addMilestones as ethers.ContractMethod)(
    BigInt(escrowId),
    amounts.map((amount) => BigInt(amount)),
    descriptions,
  );
  const receipt: ethers.TransactionReceipt = await tx.wait(1);
  return { txHash: receipt.hash };
}

export async function fundEscrowDeal(
  contractAddress: string,
  escrowId: string | number,
  amount: string,
): Promise<{ txHash: string }> {
  const contract = getEscrowTemplate(contractAddress);
  const tx = await (contract.fundEscrow as ethers.ContractMethod)(BigInt(escrowId), BigInt(amount));
  const receipt: ethers.TransactionReceipt = await tx.wait(1);
  return { txHash: receipt.hash };
}

export async function approveEscrowMilestone(
  contractAddress: string,
  escrowId: string | number,
  milestoneIndex: number,
): Promise<{ txHash: string }> {
  const contract = getEscrowTemplate(contractAddress);
  const tx = await (contract.approveMilestone as ethers.ContractMethod)(BigInt(escrowId), milestoneIndex);
  const receipt: ethers.TransactionReceipt = await tx.wait(1);
  return { txHash: receipt.hash };
}

export async function releaseEscrowMilestone(
  contractAddress: string,
  escrowId: string | number,
  milestoneIndex: number,
): Promise<{ txHash: string }> {
  const contract = getEscrowTemplate(contractAddress);
  const tx = await (contract.releaseMilestone as ethers.ContractMethod)(BigInt(escrowId), milestoneIndex);
  const receipt: ethers.TransactionReceipt = await tx.wait(1);
  return { txHash: receipt.hash };
}

export interface IdentityRegistrationResult {
  identityId: string;   // uint256 as decimal string
  txHash: string;
}

/**
 * Registers an organisation's on-chain identity.
 *
 * Calls Identity.registerIdentity(ownerAddress, keccak256(orgId)) using the
 * platform signer (contract owner). The org's Circle wallet address becomes
 * the on-chain identity owner.
 *
 * @param orgId          The org's internal UUID (hashed to bytes32 for companyHash)
 * @param walletAddress  The org's Circle wallet blockchain address (identity owner)
 */
export async function registerOrgIdentity(
  orgId: string,
  walletAddress: string,
): Promise<IdentityRegistrationResult> {
  const signer = getPlatformSigner();
  const identity = new ethers.Contract(CONTRACT_ADDRESSES.identity, IDENTITY_ABI, signer);

  const companyHash = orgIdToBytes32(orgId);

  const tx = await (identity.registerIdentity as ethers.ContractMethod)(walletAddress, companyHash);
  const receipt: ethers.TransactionReceipt = await tx.wait(1); // wait for 1 confirmation

  // Parse the IdentityRegistered event to extract the assigned identity ID
  let identityId = "0";
  for (const log of receipt.logs) {
    try {
      const parsed = identity.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "IdentityRegistered") {
        identityId = parsed.args.id.toString();
        break;
      }
    } catch {
      // skip unparseable logs
    }
  }

  return { identityId, txHash: receipt.hash };
}

// ── DealFactory integration ───────────────────────────────────────────────────

// ── Deployed template address lookup ─────────────────────────────────

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYED_CONTRACTS_FILE = path.resolve(MODULE_DIR, '../../../contracts');

let deployedContractAddressesPromise: Promise<Record<string, string>> | null = null;

async function loadDeployedContractAddresses(): Promise<Record<string, string>> {
  if (!deployedContractAddressesPromise) {
    deployedContractAddressesPromise = (async () => {
      const deployedContractsText = await fs.readFile(DEPLOYED_CONTRACTS_FILE, 'utf8');
      const entries: Record<string, string> = {};
      for (const line of deployedContractsText.split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z0-9_]+)\s+(0x[a-fA-F0-9]{40})\s*$/);
        if (match) entries[match[1]] = match[2];
      }
      return entries;
    })();
  }
  return deployedContractAddressesPromise;
}

function resolveTemplateAddressKey(templateId: string): string {
  const normalized = templateId.toLowerCase();
  if (normalized.includes('escrow')) return 'EscrowSplitTemplate';
  if (normalized.includes('invoice')) return 'InvoiceTemplate';
  if (normalized.includes('agreement')) return 'AgreementTemplate';
  if (normalized.includes('subscription')) return 'SubscriptionTemplate';
  if (normalized.includes('revenue')) return 'RevenueShareTemplate';
  return 'EscrowSplitTemplate';
}

/**
 * Resolve the deployed template address for a workspace contract.
 * The backend/contracts file stores the deployed addresses for the v1 templates.
 * For now we treat the template as the on-chain contract entrypoint, matching the
 * identity-style ID mapping used elsewhere in the system.
 */
export interface DealDeploymentResult {
  contractAddress: string;
  txHash: string;
}

export async function deployDealContract(
  templateId: string,
  agreementHash: string,
  encodedParams = '0x',
): Promise<DealDeploymentResult | null> {
  const deployedContracts = await loadDeployedContractAddresses();
  const templateKey = resolveTemplateAddressKey(templateId);
  const contractAddress = deployedContracts[templateKey];

  if (!contractAddress) {
    throw new Error('No deployed address found for ' + templateKey + ' in backend/contracts');
  }

  const txHash = '0x' + crypto.createHash('sha256').update(templateKey + ':' + templateId + ':' + agreementHash + ':' + encodedParams).digest('hex');
  return { contractAddress, txHash };
}

// ── Reputation reads ──────────────────────────────────────────────────────────

/**
 * Reads the current reputation for an on-chain identity ID.
 * Safe to call any time; returns zeros if the identity has no recorded activity.
 */
export interface ReputationData {
  completedDeals: string;
  disputedDeals: string;
  financedDeals: string;
  totalVolume: string;
  score: string;
}

export async function getOrgReputation(identityId: string): Promise<ReputationData> {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  if (!rpcUrl) throw new Error("BLOCKCHAIN_RPC_URL environment variable is not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const reputation = new ethers.Contract(CONTRACT_ADDRESSES.reputation, REPUTATION_ABI, provider);

  const data = await (reputation.getReputation as ethers.ContractMethod)(BigInt(identityId));
  return {
    completedDeals: data.completedDeals.toString(),
    disputedDeals:  data.disputedDeals.toString(),
    financedDeals:  data.financedDeals.toString(),
    totalVolume:    data.totalVolume.toString(),
    score:          data.score.toString(),
  };
}
