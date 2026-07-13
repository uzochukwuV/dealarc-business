import { ethers } from "ethers";

async function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    
    console.log("🔐 Generated EVM Wallet for Deployments");
    console.log("=".repeat(60));
    console.log("");
    console.log("📝 Mnemonic (12 words):");
    console.log(`   ${wallet.mnemonic.phrase}`);
    console.log("");
    console.log("🔑 Private Key:");
    console.log(`   ${wallet.privateKey}`);
    console.log("");
    console.log("📬 Address:");
    console.log(`   ${wallet.address}`);
    console.log("=".repeat(60));
    console.log("");
    console.log("⚠️  IMPORTANT SECURITY NOTES:");
    console.log("   - NEVER share your private key or mnemonic");
    console.log("   - Store them securely (hardware wallet, password manager)");
    console.log("   - Add to .env file as DEPLOYER_PRIVATE_KEY");
    console.log("");
    console.log("🔗 Faucet Links:");
    console.log("   - Polygon Amoy: https://faucet.polygon.technology/");
    console.log("   - ARC Testnet: https://www.arcana.network/");
    console.log("");
    
    // Verify the wallet
    const derivedWallet = ethers.Wallet.fromPhrase(wallet.mnemonic.phrase);
    console.log("✅ Verification - Derived wallet address matches:", derivedWallet.address === wallet.address);
}

generateWallet().catch(console.error);
