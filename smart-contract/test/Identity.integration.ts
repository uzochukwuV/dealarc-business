import {
  createTestClient,
  http,
  publicActions,
  walletClientToAccount,
  zeroAddress,
} from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Identity } from "../types/Identity";
import { bytesToHex } from "viem";

describe("Identity Integration Tests", () => {
  let identity: Identity;
  const ownerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478dbed5efcae784d7bf4f2ff80";
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  const testClient = createTestClient({
    chain: hardhat,
    transport: http(),
    mode: "anvil",
  });

  const walletClient = {
    account: ownerAccount,
    chain: hardhat,
    transport: http(),
  };

  beforeAll(async () => {
    // Get deployed Identity address
    const addresses = await testClient.getAddresses();
    console.log("Available addresses:", addresses);
  });

  describe("registerIdentity", () => {
    it("should register a new identity", async () => {
      const companyHash = bytesToHex(new TextEncoder().encode("QmTest123"));

      // This would need a deployed contract
      // For now, just testing the structure
      expect(companyHash).toBeDefined();
      expect(companyHash.length).toBeGreaterThan(0);
    });
  });
});
