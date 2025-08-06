const { ethers } = require('hardhat');

async function main() {
  console.log('🔧 Initializing supported tokens...');
  
  // Get the proxy address
  const proxyAddress = '0xfBc307eabd9F50cc903f9569A3B92C9491eBaB3C'; // Base Sepolia testnet
  
  console.log('📍 Contract address:', proxyAddress);
  
  // Get contract instance
  const NedaPayProtocolUpgradeable = await ethers.getContractFactory('NedaPayProtocolUpgradeable');
  const contract = NedaPayProtocolUpgradeable.attach(proxyAddress);
  
  console.log('🚀 Calling initializeSupportedTokens()...');
  
  // Call the initialization function
  const tx = await contract.initializeSupportedTokens();
  console.log('📝 Transaction hash:', tx.hash);
  
  // Wait for confirmation
  const receipt = await tx.wait();
  console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
  
  // Verify all tokens are now supported
  console.log('\n🔍 Verifying all tokens are now supported...');
  
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
  
  let supportedCount = 0;
  
  for (let i = 0; i < correctAddresses.length; i++) {
    try {
      const isSupported = await contract.isTokenSupported(correctAddresses[i]);
      console.log(`${isSupported ? '✅' : '❌'} ${tokenNames[i]} (${correctAddresses[i]}): ${isSupported ? 'Supported' : 'Not Supported'}`);
      if (isSupported) supportedCount++;
    } catch (error) {
      console.log(`❌ ${tokenNames[i]} (${correctAddresses[i]}): Error checking support`);
    }
  }
  
  console.log(`\n🎉 Initialization completed! ${supportedCount}/11 stablecoins are now supported.`);
  
  if (supportedCount === 11) {
    console.log('🚀 All stablecoins are now supported! Ready for testing.');
  } else {
    console.log('⚠️  Some tokens may need manual addition.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Token initialization failed:', error);
    process.exit(1);
  });
