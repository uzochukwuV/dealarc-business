import fs from "node:fs";
import path from "node:path";

const ABI_BUNDLE_CANDIDATES = [
  path.resolve(process.cwd(), "smart-contract/abis/index.json"),
  path.resolve(process.cwd(), "../smart-contract/abis/index.json"),
  path.resolve(process.cwd(), "../../smart-contract/abis/index.json"),
  path.resolve(process.cwd(), "../../../smart-contract/abis/index.json"),
];

let cachedBundle: Record<string, { abi: unknown[] }> | null = null;

function resolveAbiBundlePath(): string {
  for (const candidate of ABI_BUNDLE_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to locate compiled smart-contract ABI bundle. Looked in: " + ABI_BUNDLE_CANDIDATES.join(", "),
  );
}

function loadBundle(): Record<string, { abi: unknown[] }> {
  if (!cachedBundle) {
    const bundlePath = resolveAbiBundlePath();
    const raw = fs.readFileSync(bundlePath, "utf8");
    cachedBundle = JSON.parse(raw) as Record<string, { abi: unknown[] }>;
  }

  return cachedBundle;
}

export function loadCompiledAbi(contractName: string): unknown[] {
  const bundle = loadBundle();
  const artifact = bundle[contractName];
  if (!artifact?.abi) {
    throw new Error("ABI for " + contractName + " was not found in the compiled bundle");
  }
  return artifact.abi;
}
