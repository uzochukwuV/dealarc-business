/**
 * JWT authentication utilities
 * Signs tokens with SESSION_SECRET.
 */

import crypto from "node:crypto";

const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtPayload {
  sub: string;   // user ID
  email: string;
  iat: number;
  exp: number;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** Issue a signed JWT for a user */
export function signJwt(userId: string, email: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ sub: userId, email, iat: now, exp: now + JWT_EXPIRY_SECONDS }),
  );
  const signingInput = `${header}.${payload}`;
  const sig = base64url(
    crypto.createHmac("sha256", getSecret()).update(signingInput).digest(),
  );
  return `${signingInput}.${sig}`;
}

/** Verify and decode a JWT. Returns the payload or throws. */
export function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [header, payload, sig] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSig = base64url(
    crypto.createHmac("sha256", getSecret()).update(signingInput).digest(),
  );
  if (sig !== expectedSig) throw new Error("Invalid token signature");

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as JwtPayload;
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return decoded;
}

/** Simple bcrypt-like password hashing using PBKDF2 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}
