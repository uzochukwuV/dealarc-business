/**
 * Document encryption service (AES-256-GCM)
 *
 * Envelope encryption model (simplified for MVP):
 *   - Each document gets a unique DEK (data encryption key).
 *   - The DEK is encrypted with the server's master key (derived from
 *     SESSION_SECRET via PBKDF2). In production this master key would
 *     come from AWS KMS / GCP KMS — the swap is trivial since the
 *     encrypt/decrypt functions are isolated here.
 *   - The encrypted DEK (encryptedDek) and its IV (dekIv) are stored
 *     in Postgres as encryption_key_ref and encryption_iv.
 *   - The encrypted file content (with its own IV prepended) is what
 *     gets pinned to IPFS.
 *
 * Wire format stored on IPFS:
 *   [ 12 bytes IV ][ N bytes AES-256-GCM ciphertext + 16 bytes auth tag ]
 */

import crypto from "node:crypto";

const MASTER_KEY_SALT = "b2b-deal-network-dek-salt-v1";

/** Derive a 32-byte AES key from the SESSION_SECRET master key */
function deriveMasterKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.pbkdf2Sync(secret, MASTER_KEY_SALT, 100_000, 32, "sha256");
}

export interface EncryptedDocument {
  /** Ciphertext blob ready to pin to IPFS (IV prepended) */
  encryptedBuffer: Buffer;
  /** SHA-256 of the original plaintext (for integrity proofs) */
  contentHash: string;
  /** Base64-encoded encrypted DEK — store in Postgres as encryption_key_ref */
  encryptedDek: string;
  /** Base64-encoded IV used to encrypt the DEK */
  dekIv: string;
}

/**
 * Encrypt a plaintext file buffer before pinning to IPFS.
 */
export function encryptDocument(plaintext: Buffer): EncryptedDocument {
  // 1. Hash the plaintext for integrity proof
  const contentHash = crypto.createHash("sha256").update(plaintext).digest("hex");

  // 2. Generate a random per-document DEK
  const dek = crypto.randomBytes(32); // 256-bit AES key

  // 3. Encrypt the file with the DEK
  const fileIv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, fileIv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Wire format: [12-byte IV][ciphertext][16-byte auth tag]
  const encryptedBuffer = Buffer.concat([fileIv, ciphertext, authTag]);

  // 4. Envelope-encrypt the DEK with the master key
  const masterKey = deriveMasterKey();
  const dekIvBytes = crypto.randomBytes(12);
  const dekCipher = crypto.createCipheriv("aes-256-gcm", masterKey, dekIvBytes);
  const encryptedDekBytes = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
  const dekAuthTag = dekCipher.getAuthTag();
  // Store IV + ciphertext + auth tag together as the key ref
  const encryptedDekFull = Buffer.concat([dekIvBytes, encryptedDekBytes, dekAuthTag]);

  return {
    encryptedBuffer,
    contentHash,
    encryptedDek: encryptedDekFull.toString("base64"),
    dekIv: dekIvBytes.toString("base64"), // kept for legacy compat; full IV is in encryptedDek
  };
}

/**
 * Decrypt a document fetched from IPFS.
 * @param encryptedBuffer The raw bytes fetched from IPFS
 * @param encryptedDek    The stored encryption_key_ref from Postgres
 */
export function decryptDocument(encryptedBuffer: Buffer, encryptedDek: string): Buffer {
  const masterKey = deriveMasterKey();

  // 1. Unwrap the DEK
  const encryptedDekFull = Buffer.from(encryptedDek, "base64");
  const dekIvBytes = encryptedDekFull.subarray(0, 12);
  const dekCiphertext = encryptedDekFull.subarray(12, encryptedDekFull.length - 16);
  const dekAuthTagBytes = encryptedDekFull.subarray(encryptedDekFull.length - 16);

  const dekDecipher = crypto.createDecipheriv("aes-256-gcm", masterKey, dekIvBytes);
  dekDecipher.setAuthTag(dekAuthTagBytes);
  const dek = Buffer.concat([dekDecipher.update(dekCiphertext), dekDecipher.final()]);

  // 2. Decrypt the file content
  const fileIv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  const ciphertext = encryptedBuffer.subarray(12, encryptedBuffer.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, fileIv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Verify a decrypted file matches its stored sha256 hash.
 */
export function verifyContentHash(plaintext: Buffer, storedHash: string): boolean {
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return hash === storedHash;
}
