const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  // Read existing deployment info
  const deploymentPath = path.join(__dirname, 'deployment-upgradeable.json');
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('❌ No deployment info found. Deploy the contract first.');
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const proxyAddress = deploymentInfo.proxyAddress;
  
  console.log('🔄 Updating Fee Tiers...');
  console.log('📍 Contract Address:', proxyAddress);
  
  // Get the contract instance
  const contract = await ethers.getContractAt('NedaPayProtocolUpgradeable', proxyAddress);
  
  // Define new fee tiers (example - modify as needed)
  const newFeeTiers = [
    {
      minAmount: ethers.utils.parseUnits('0', 6),           // $0
      maxAmount: ethers.utils.parseUnits('100', 6),         // $100
      feeRate: 100  // 1.0%
    },
    {
      minAmount: ethers.utils.parseUnits('100.01', 6),      // $100.01
      maxAmount: ethers.utils.parseUnits('500', 6),         // $500
      feeRate: 75   // 0.75%
    },
    {
      minAmount: ethers.utils.parseUnits('500.01', 6),      // $500.01
      maxAmount: ethers.utils.parseUnits('2000', 6),        // $2000
      feeRate: 50   // 0.5%
    },
    {
      minAmount: ethers.utils.parseUnits('2000.01', 6),     // $2000.01
      maxAmount: ethers.utils.parseUnits('5000', 6),        // $5000
      feeRate: 30   // 0.3%
    },
    {
      minAmount: ethers.utils.parseUnits('5000.01', 6),     // $5000.01
      maxAmount: ethers.constants.MaxUint256,               // No limit
      feeRate: 20   // 0.2%
    }
  ];
  
  console.log('');
  console.log('📊 New Fee Tiers:');
  newFeeTiers.forEach((tier, index) => {
    const minUSD = ethers.utils.formatUnits(tier.minAmount, 6);
    const maxUSD = tier.maxAmount.eq(ethers.constants.MaxUint256) 
      ? 'Infinity' 
      : ethers.utils.formatUnits(tier.maxAmount, 6);
    const feePercent = (tier.feeRate / 100).toFixed(2);
    console.log(`   Tier ${index + 1}: $${minUSD} - $${maxUSD} → ${feePercent}%`);
  });
  
  console.log('');
  console.log('🔄 Updating fee tiers on contract...');
  
  // Update fee tiers
  const tx = await contract.updateFeeTiers(newFeeTiers);
  console.log('📝 Transaction Hash:', tx.hash);
  
  // Wait for confirmation
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✅ Fee tiers updated successfully!');
  console.log('⛽ Gas Used:', receipt.gasUsed.toString());
  
  // Verify the update
  console.log('');
  console.log('🔍 Verifying update...');
  const tiersLength = await contract.getFeeTiersLength();
  console.log('📊 New Fee Tiers Count:', tiersLength.toString());
  
  // Test fee calculations with new tiers
  console.log('');
  console.log('🧮 Testing New Fee Calculations:');
  const testAmounts = [
    { amount: '50', label: '$50' },
    { amount: '300', label: '$300' },
    { amount: '1000', label: '$1,000' },
    { amount: '3000', label: '$3,000' },
    { amount: '10000', label: '$10,000' }
  ];
  
  for (const test of testAmounts) {
    const amount = ethers.utils.parseUnits(test.amount, 6);
    const fee = await contract.calculateFee(
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      amount
    );
    const feeUSD = ethers.utils.formatUnits(fee, 6);
    const feeRate = await contract.calculateDynamicFeeRate(amount);
    const feePercent = (feeRate / 100).toFixed(2);
    console.log(`   ${test.label} → $${feeUSD} fee (${feePercent}%)`);
  }
  
  console.log('');
  console.log('🎉 Fee tiers update completed successfully!');
  
  return {
    transactionHash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    newTiersCount: tiersLength.toString()
  };
}

// Handle both direct execution and module export
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fee tiers update failed:', error);
      process.exit(1);
    });
}

module.exports = main;
