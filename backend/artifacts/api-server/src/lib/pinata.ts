/**
 * Pinata IPFS service
 * Handles encrypted document upload and retrieval via Pinata's pinning API.
 * Documents are NEVER uploaded in plaintext — encryption happens before pinning.
 */

import crypto from "node:crypto";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const PINATA_MOCK = process.env.PINATA_MOCK === "true" || process.env.PINATA_MOCK === "1";

export interface PinataUploadResult {
  ipfsCid: string;
}

/**
 * Pin an encrypted buffer to IPFS via Pinata.
 * @param encryptedBuffer The AES-256-GCM encrypted file content
 * @param filename        Opaque filename (no sensitive info)
 * @param metadata        Key/value metadata stored with the pin
 */
export async function pinEncryptedFile(
  encryptedBuffer: Buffer,
  filename: string,
  metadata: Record<string, string> = {},
): Promise<PinataUploadResult> {
  if (PINATA_MOCK) {
    const digest = crypto
      .createHash("sha256")
      .update(encryptedBuffer)
      .update(filename)
      .update(JSON.stringify(metadata))
      .digest("hex");
    return { ipfsCid: `mock-${digest.slice(0, 46)}` };
  }

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT environment variable is not set");
  }

  const formData = new FormData();
  const blob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
  formData.append("file", blob, filename);

  const pinataMetadata = JSON.stringify({ name: filename, keyvalues: metadata });
  formData.append("pinataMetadata", pinataMetadata);

  const pinataOptions = JSON.stringify({ cidVersion: 1 });
  formData.append("pinataOptions", pinataOptions);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${text}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return { ipfsCid: result.IpfsHash };
}

/**
 * Fetch an encrypted file from IPFS via Pinata gateway.
 * Returns the raw encrypted bytes — caller must decrypt.
 */
export async function fetchEncryptedFile(ipfsCid: string): Promise<Buffer> {
  if (PINATA_MOCK) {
    throw new Error("PINATA_MOCK mode does not support fetchEncryptedFile");
  }

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT environment variable is not set");
  }

  const url = `${PINATA_GATEWAY}/ipfs/${ipfsCid}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
  });

  if (!response.ok) {
    throw new Error(`IPFS fetch failed (${response.status}) for CID ${ipfsCid}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Unpin a CID from Pinata (e.g. for document deletion).
 */
export async function unpinFile(ipfsCid: string): Promise<void> {
  if (PINATA_MOCK) {
    return;
  }

  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT environment variable is not set");
  }

  const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${ipfsCid}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Pinata unpin failed (${response.status})`);
  }
}
