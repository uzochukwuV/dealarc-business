# Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. A wallet with funds on testnets

## Step 1: Generate a Deployment Wallet

```bash
node generate-wallet.mjs
```

**Important**: Save the private key securely - you'll need it for deployment.

## Step 2: Fund Your Wallet

Get test MATIC for Polygon Amoy:
- https://faucet.polygon.technology/

Get test ETH for ARC Testnet:
- https://www.arcana.network/ (check their faucet)

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```
DEPLOYER_PRIVATE_KEY=0x_your_private_key_here
POLYGON_AMOY_RPC_URL=https://polygon-amoy.drpc.org
ARC_TESTNET_RPC_URL=https://arc-testnet.drpc.org
POLYGONSCAN_API_KEY=your_api_key
ARC_SCAN_API_KEY=your_api_key
```

## Step 4: Deploy to Polygon Amoy

```bash
# Set USDC address (use a test token address or deploy your own)
export USDC_ADDRESS=0x0000000000000000000000000000000000000000

# Deploy
npx hardhat run scripts/deploy-full-protocol.ts --network polygonAmoy
```

## Step 5: Deploy to ARC Testnet

```bash
# Deploy
npx hardhat run scripts/deploy-full-protocol.ts --network arcTestnet
```

## Contract Addresses (After Deployment)

The deployment script will output all contract addresses. Save these for your frontend.

### Example Output:
```
Contract Addresses:
  VerificationRegistry:  0x...
  FeeController:        0x...
  ArbitrationTemplate:  0x...
  Identity:            0x...
  Reputation:          0x...
  TemplateRegistry:    0x...
  AgreementTemplate:   0x...
  EscrowSplitTemplate: 0x...
  InvoiceTemplate:     0x...
  SubscriptionTemplate: 0x...
  RevenueShareTemplate: 0x...
```

## Post-Deployment Configuration

### Set Platform Fee
```javascript
const FeeController = await ethers.getContractFactory("FeeController");
const feeController = await FeeController.attach("FEE_CONTROLLER_ADDRESS");
await feeController.setFeeBps(25); // 0.25% fee
```

### Authorize Arbitrators
```javascript
const ArbitrationTemplate = await ethers.getContractFactory("ArbitrationTemplate");
const arbitration = await ArbitrationTemplate.attach("ARBITRATION_ADDRESS");
await arbitration.authorizeArbitrator("ARBITRATOR_ADDRESS");
```

### Set Organization Verification
```javascript
const VerificationRegistry = await ethers.getContractFactory("VerificationRegistry");
const verification = await VerificationRegistry.attach("VERIFICATION_ADDRESS");
await verification.setAttestation("ORG_ADDRESS", {
  claim: ethers.id("KYC_VERIFIED"),
  issuer: "ISSUER_ADDRESS",
  expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
});
```

### Verify Contracts on Explorer
```bash
npx hardhat verify --network polygonAmoy <contract_address> <constructor_args>
npx hardhat verify --network arcTestnet <contract_address> <constructor_args>
```

## Network Details

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Polygon Amoy | 80002 | https://polygon-amoy.drpc.org | https://amoy.polygonscan.com |
| ARC Testnet | TBD | https://arc-testnet.drpc.org | TBD |

## Troubleshooting

### "insufficient funds for gas"
- Make sure your wallet has test tokens from the faucet

### "nonce too low"
- Clear your pending transactions in MetaMask or use a fresh wallet

### Contract verification
- After deployment, verify contracts on the block explorer for transparency
