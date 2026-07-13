/**
 * Circle wallet service
 * Wraps Circle's Programmable Wallets REST API (developer-controlled wallets).
 *
 * Docs: https://developers.circle.com/w3s/reference
 *
 * Developer-controlled wallets require an Entity Secret — a 32-byte hex string
 * that you generate once and register in the Circle console. Each API call that
 * mutates wallet state must include an entitySecretCiphertext: the entity secret
 * encrypted with Circle's RSA-4096 public key (OAEP-SHA256).
 *
 * Required env vars:
 *   CIRCLE_API_KEY        — API key from Circle console
 *   CIRCLE_WALLET_SET_ID  — default wallet set ID
 *   CIRCLE_ENTITY_SECRET  — 32-byte hex entity secret (generated once, stored in Circle console)
 */

import crypto from "node:crypto";

const CIRCLE_API_KEY      = process.env.CIRCLE_API_KEY;
const CIRCLE_API_BASE     = process.env.CIRCLE_API_BASE ?? "https://api.circle.com/v1/w3s";
const CIRCLE_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

// ── Shared headers ────────────────────────────────────────────────────────────

function circleHeaders(): Record<string, string> {
  if (!CIRCLE_API_KEY) throw new Error("CIRCLE_API_KEY environment variable is not set");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${CIRCLE_API_KEY}`,
  };
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

// ── Entity secret cipher text ─────────────────────────────────────────────────

/**
 * Fetches Circle's RSA-4096 public key and encrypts the entity secret with it
 * using RSA-OAEP-SHA256. The resulting base64 string is sent as
 * `entitySecretCiphertext` with every developer-controlled wallet mutation.
 *
 * The public key changes rarely (only on Circle's key rotation), so we cache it
 * in memory for the lifetime of the process to avoid an extra round-trip on
 * every wallet operation.
 */
let _cachedCirclePublicKey: string | null = null;

async function getCirclePublicKey(): Promise<string> {
  if (_cachedCirclePublicKey) return _cachedCirclePublicKey;

  const res = await fetch(`${CIRCLE_API_BASE}/config/entity/publicKey`, {
    headers: circleHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Circle getPublicKey failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { data: { publicKey: string } };
  _cachedCirclePublicKey = data.data.publicKey;
  return _cachedCirclePublicKey!;
}

/**
 * Returns a fresh entity secret cipher text for inclusion in Circle API calls.
 * Encrypts CIRCLE_ENTITY_SECRET (32-byte hex) with Circle's RSA-4096 public key.
 */
export async function createEntitySecretCipherText(): Promise<string> {
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!entitySecret) throw new Error("CIRCLE_ENTITY_SECRET environment variable is not set");

  // Entity secret must be exactly 32 bytes (64 hex chars)
  if (!/^[0-9a-fA-F]{64}$/.test(entitySecret)) {
    throw new Error("CIRCLE_ENTITY_SECRET must be a 64-character hex string (32 bytes)");
  }

  const publicKey = await getCirclePublicKey();
  const entitySecretBuffer = Buffer.from(entitySecret, "hex");

  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    entitySecretBuffer,
  );

  return encrypted.toString("base64");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CircleWallet {
  id: string;
  state: string;
  walletSetId: string;
  custodyType: string;
  blockchain: string;
  accountType: string;
  address?: string;
  name?: string;
}

export interface CircleBalance {
  amount: string;
  token: { symbol: string; name: string; blockchain: string };
}

export interface CircleTransfer {
  id: string;
  state: string;
  txHash?: string;
}

// ── Developer wallet set management ──────────────────────────────────────────

/**
 * Creates a new developer-controlled wallet set via Circle's API.
 * Run once during platform setup; save the returned id as CIRCLE_DEV_WALLET_SET_ID.
 */
export async function createDeveloperWalletSet(name = "B2B Platform Dev Wallets"): Promise<{
  id: string;
  name: string;
  custodyType: string;
}> {
  const entitySecretCiphertext = await createEntitySecretCipherText();

  const response = await fetch(`${CIRCLE_API_BASE}/developer/walletSets`, {
    method: "POST",
    headers: circleHeaders(),
    body: JSON.stringify({
      idempotencyKey: idempotencyKey(),
      entitySecretCiphertext,
      name,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle createDeveloperWalletSet failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { walletSet: { id: string; name: string; custodyType: string } } };
  return data.data.walletSet;
}

// ── Wallet operations ─────────────────────────────────────────────────────────

/**
 * Create a developer-controlled wallet for an organisation.
 * Requires CIRCLE_DEV_WALLET_SET_ID (a developer-controlled wallet set —
 * different from CIRCLE_WALLET_SET_ID which is for user-controlled wallets).
 * Run POST /api/admin/setup/circle to create the wallet set on first use.
 *
 * @param orgId      Internal org UUID — used as wallet metadata refId
 * @param blockchain Target blockchain (default: MATIC-AMOY)
 */
export async function createOrgWallet(
  orgId: string,
  blockchain = "MATIC-AMOY",
): Promise<CircleWallet> {
  const devWalletSetId = process.env.CIRCLE_DEV_WALLET_SET_ID;
  if (!devWalletSetId) {
    throw new Error(
      "CIRCLE_DEV_WALLET_SET_ID is not set. Call POST /api/admin/setup/circle to create one.",
    );
  }

  const entitySecretCiphertext = await createEntitySecretCipherText();

  const response = await fetch(`${CIRCLE_API_BASE}/developer/wallets`, {
    method: "POST",
    headers: circleHeaders(),
    body: JSON.stringify({
      idempotencyKey: idempotencyKey(),
      entitySecretCiphertext,
      blockchains: [blockchain],
      count: 1,
      walletSetId: devWalletSetId,
      metadata: [{ name: `org-ctrl-${orgId.slice(0, 36)}`, refId: orgId }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle createOrgWallet failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { wallets: CircleWallet[] } };
  const wallet = data.data?.wallets?.[0];
  if (!wallet) throw new Error("Circle returned no wallet in response");
  return wallet;
}

/**
 * Fetch wallet details by Circle wallet ID.
 */
export async function getWallet(circleWalletId: string): Promise<CircleWallet> {
  const response = await fetch(`${CIRCLE_API_BASE}/wallets/${circleWalletId}`, {
    headers: circleHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle getWallet failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { wallet: CircleWallet } };
  return data.data.wallet;
}

/**
 * Get balances for a wallet.
 */
export async function getWalletBalances(circleWalletId: string): Promise<CircleBalance[]> {
  const response = await fetch(`${CIRCLE_API_BASE}/wallets/${circleWalletId}/balances`, {
    headers: circleHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle getBalances failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { tokenBalances: CircleBalance[] } };
  return data.data?.tokenBalances ?? [];
}

/**
 * Initiate a transfer from a developer-controlled wallet.
 * Requires entity secret cipher text.
 */
export async function initiateTransfer(opts: {
  sourceWalletId: string;
  destinationAddress: string;
  blockchain: string;
  amount: string;
  tokenAddress?: string;
  idempotencyKey?: string;
}): Promise<CircleTransfer> {
  const entitySecretCiphertext = await createEntitySecretCipherText();

  const response = await fetch(`${CIRCLE_API_BASE}/developer/transactions/transfer`, {
    method: "POST",
    headers: circleHeaders(),
    body: JSON.stringify({
      idempotencyKey: opts.idempotencyKey ?? idempotencyKey(),
      entitySecretCiphertext,
      sourceWalletId: opts.sourceWalletId,
      destinationAddress: opts.destinationAddress,
      blockchain: opts.blockchain,
      amounts: [opts.amount],
      ...(opts.tokenAddress ? { tokenAddress: opts.tokenAddress } : {}),
      feeLevel: "MEDIUM",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle transfer failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { id: string; state: string; txHash?: string } };
  return { id: data.data.id, state: data.data.state, txHash: data.data.txHash };
}

/**
 * Create a platform wallet (fee treasury or automation).
 * Run once at deploy time; store the resulting wallet ID in env.
 */
export async function createPlatformWallet(
  purpose: "PLATFORM_FEE_TREASURY" | "PLATFORM_AUTOMATION",
  blockchain = "MATIC-AMOY",
): Promise<CircleWallet> {
  if (!CIRCLE_WALLET_SET_ID) throw new Error("CIRCLE_WALLET_SET_ID environment variable is not set");

  const entitySecretCiphertext = await createEntitySecretCipherText();

  const response = await fetch(`${CIRCLE_API_BASE}/developer/wallets`, {
    method: "POST",
    headers: circleHeaders(),
    body: JSON.stringify({
      idempotencyKey: idempotencyKey(),
      entitySecretCiphertext,
      blockchains: [blockchain],
      count: 1,
      walletSetId: CIRCLE_WALLET_SET_ID,
      metadata: [{ name: purpose }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle createPlatformWallet failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { wallets: CircleWallet[] } };
  const wallet = data.data?.wallets?.[0];
  if (!wallet) throw new Error("Circle returned no wallet in response");
  return wallet;
}
