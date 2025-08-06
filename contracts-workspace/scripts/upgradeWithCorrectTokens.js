const { ethers, upgrades } = require('hardhat');

async function main() {
  console.log('🔄 Upgrading NedaPay Protocol with correct token addresses...');
  
  // Get the existing proxy address
  const proxyAddress = '0xfBc307eabd9F50cc903f9569A3B92C9491eBaB3C'; // Base Sepolia testnet
  
  console.log('📍 Proxy address:', proxyAddress);
  
  // Deploy new implementation
  console.log('🚀 Deploying new implementation...');
  const NedaPayProtocolUpgradeable = await ethers.getContractFactory('NedaPayProtocolUpgradeable');
  
  // Upgrade the contract
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NedaPayProtocolUpgradeable);
  await upgraded.waitForDeployment();
  
  console.log('✅ Contract upgraded successfully!');
  console.log('📍 Proxy address (unchanged):', await upgraded.getAddress());
  
  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('📍 New implementation address:', implementationAddress);
  
  // Verify the supported tokens are now correct
  console.log('\n🔍 Verifying supported tokens...');
  
  const correctAddresses = [
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    '0x46C85152bFe9f96829aA94755D9f915F9B10EF5F', // cNGN
    '0xe743f13623E000261b634f0e5676F294475ec24d', // NGNC
    '0xb755506531786C8aC63B756BaB1ac387bACB0C04', // ZARP
    '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', // IDRX
    '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', // EURC
    '0x043eB4B75d0805c43D7C834902E335621983Cf03', // CADC
    '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4', // BRL
    '0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294', // TRYB
    '0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7', // NZDD
    '0x269caE7Dc59803e5C596c95756faEeBb6030E0aF'  // MXNe
  ];
  
  const tokenNames = [
    'USDC', 'cNGN', 'NGNC', 'ZARP', 'IDRX', 
    'EURC', 'CADC', 'BRL', 'TRYB', 'NZDD', 'MXNe'
  ];
  
  for (let i = 0; i < correctAddresses.length; i++) {
    try {
      const isSupported = await upgraded.isTokenSupported(correctAddresses[i]);
      console.log(`${isSupported ? '✅' : '❌'} ${tokenNames[i]} (${correctAddresses[i]}): ${isSupported ? 'Supported' : 'Not Supported'}`);
    } catch (error) {
      console.log(`❌ ${tokenNames[i]} (${correctAddresses[i]}): Error checking support`);
    }
  }
  
  console.log('\n🎉 Upgrade completed! All 11 stablecoins should now be supported.');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'base-sepolia',
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    upgradeTimestamp: new Date().toISOString(),
    supportedTokens: correctAddresses.length
  };
  
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'base-sepolia-upgrade.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('💾 Deployment info saved to deployments/base-sepolia-upgrade.json');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Upgrade failed:', error);
    process.exit(1);
  });
