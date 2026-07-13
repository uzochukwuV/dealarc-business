const { ethers } = require("ethers");

async function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    
    console.log("🔐 Generated EVM Wallet");
    console.log("=".repeat(50));
    console.log("📝 Mnemonic (12 words):");
    console.log(wallet.mnemonic.phrase);
    console.log("");
    console.log("🔑 Private Key:");
    console.log(wallet.privateKey);
    console.log("");
    console.log("📬 Address:");
    console.log(wallet.address);
    console.log("=".repeat(50));
    
    const derivedWallet = ethers.Wallet.fromPhrase(wallet.mnemonic.phrase);
    console.log("\n✅ Verification - Derived wallet address matches:", derivedWallet.address === wallet.address);
}

generateWallet().catch(console.error);
