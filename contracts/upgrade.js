const { ethers, upgrades } = require('hardhat');
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
  
  console.log('🔄 Upgrading NedaPay Protocol...');
  console.log('📍 Proxy Address:', proxyAddress);
  
  // Get the new contract factory
  const NedaPayProtocolV2 = await ethers.getContractFactory('NedaPayProtocolUpgradeable');
  
  console.log('📦 Deploying new implementation...');
  
  // Upgrade the contract
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NedaPayProtocolV2);
  
  console.log('✅ Contract upgraded successfully!');
  
  // Get new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('📍 New Implementation Address:', newImplementationAddress);
  
  // Verify the upgrade
  console.log('');
  console.log('🔍 Verifying upgrade...');
  
  const contract = await ethers.getContractAt('NedaPayProtocolUpgradeable', proxyAddress);
  
  // Check version (if implemented)
  try {
    const version = await contract.version();
    console.log('📋 Contract Version:', version);
  } catch (error) {
    console.log('📋 Version method not available');
  }
  
  // Verify fee recipient is still correct
  const feeRecipient = await contract.FEE_RECIPIENT();
  console.log('💰 Fee Recipient:', feeRecipient);
  
  // Check if fee tiers are still working
  const tiersLength = await contract.getFeeTiersLength();
  console.log('📊 Fee Tiers Count:', tiersLength.toString());
  
  // Test a fee calculation
  const testAmount = ethers.utils.parseUnits('1000', 6); // $1000
  const fee = await contract.calculateFee(
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    testAmount
  );
  const feeUSD = ethers.utils.formatUnits(fee, 6);
  console.log('🧮 Test Fee Calculation: $1000 → $' + feeUSD + ' fee');
  
  // Update deployment info
  deploymentInfo.implementationAddress = newImplementationAddress;
  deploymentInfo.upgradedAt = new Date().toISOString();
  deploymentInfo.previousImplementations = deploymentInfo.previousImplementations || [];
  deploymentInfo.previousImplementations.push({
    address: deploymentInfo.implementationAddress,
    upgradedAt: deploymentInfo.upgradedAt
  });
  
  // Save updated deployment info
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('');
  console.log('💾 Deployment info updated');
  console.log('🎉 Upgrade completed successfully!');
  
  return {
    proxy: proxyAddress,
    newImplementation: newImplementationAddress
  };
}

// Handle both direct execution and module export
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Upgrade failed:', error);
      process.exit(1);
    });
}

module.exports = main;
