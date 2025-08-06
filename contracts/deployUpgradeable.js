const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Deploying NedaPay Protocol (Upgradeable)...');
  
  // Get the contract factory
  const NedaPayProtocol = await ethers.getContractFactory('NedaPayProtocolUpgradeable');
  
  console.log('📦 Deploying proxy and implementation...');
  
  // Deploy the upgradeable contract
  const nedaPayProtocol = await upgrades.deployProxy(
    NedaPayProtocol,
    [], // No constructor args needed for initialize()
    { 
      initializer: 'initialize',
      kind: 'uups' // Use UUPS proxy pattern
    }
  );
  
  await nedaPayProtocol.deployed();
  
  console.log('✅ NedaPay Protocol deployed successfully!');
  console.log('📍 Proxy Address:', nedaPayProtocol.address);
  
  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(nedaPayProtocol.address);
  console.log('📍 Implementation Address:', implementationAddress);
  
  console.log('');
  console.log('🔧 Contract Configuration:');
  console.log('💰 Fee Recipient:', await nedaPayProtocol.FEE_RECIPIENT());
  console.log('📊 Basis Points:', (await nedaPayProtocol.BASIS_POINTS()).toString());
  
  // Check fee tiers
  console.log('');
  console.log('📈 Fee Tiers:');
  const tiersLength = await nedaPayProtocol.getFeeTiersLength();
  for (let i = 0; i < tiersLength; i++) {
    const tier = await nedaPayProtocol.feeTiers(i);
    const minUSD = ethers.utils.formatUnits(tier.minAmount, 6);
    const maxUSD = tier.maxAmount.eq(ethers.constants.MaxUint256) 
      ? 'Infinity' 
      : ethers.utils.formatUnits(tier.maxAmount, 6);
    const feePercent = (tier.feeRate / 100).toFixed(2);
    console.log(`   Tier ${i + 1}: $${minUSD} - $${maxUSD} → ${feePercent}%`);
  }
  
  // Test fee calculations
  console.log('');
  console.log('🧮 Fee Examples:');
  const testAmounts = [
    { amount: '50', label: '$50' },
    { amount: '300', label: '$300' },
    { amount: '1000', label: '$1,000' },
    { amount: '3000', label: '$3,000' },
    { amount: '10000', label: '$10,000' }
  ];
  
  for (const test of testAmounts) {
    const amount = ethers.utils.parseUnits(test.amount, 6);
    const fee = await nedaPayProtocol.calculateFee(
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      amount
    );
    const feeUSD = ethers.utils.formatUnits(fee, 6);
    const feeRate = await nedaPayProtocol.calculateDynamicFeeRate(amount);
    const feePercent = (feeRate / 100).toFixed(2);
    console.log(`   ${test.label} → $${feeUSD} fee (${feePercent}%)`);
  }
  
  // Verify supported tokens
  console.log('');
  console.log('🪙 Supported Tokens:');
  const tokens = [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'cNGN', address: '0x46C85152bFe9f96829aA94755D9f915F9B10EF5F' },
    { symbol: 'NGNC', address: '0xe743f13623E000261b634f0e5676F294475ec24d' },
    { symbol: 'ZARP', address: '0xb755506531786C8aC63B756BaB1ac387bACB0C04' },
    { symbol: 'IDRX', address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22' },
    { symbol: 'EURC', address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42' },
    { symbol: 'CADC', address: '0x043eB4B75d0805c43D7C834902E335621983Cf03' },
    { symbol: 'BRL', address: '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4' },
    { symbol: 'TRYB', address: '0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294' },
    { symbol: 'NZDD', address: '0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7' },
    { symbol: 'MXNe', address: '0x269caE7Dc59803e5C596c95756faEeBb6030E0aF' }
  ];
  
  for (const token of tokens) {
    const isSupported = await nedaPayProtocol.isTokenSupported(token.address);
    console.log(`   ✅ ${token.symbol}: ${isSupported ? 'Supported' : 'Not Supported'}`);
  }
  
  // Save deployment info
  const deploymentInfo = {
    contractName: 'NedaPayProtocolUpgradeable',
    proxyAddress: nedaPayProtocol.address,
    implementationAddress: implementationAddress,
    feeRecipient: '0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459',
    network: 'base-mainnet',
    deployedAt: new Date().toISOString(),
    version: '1.0.0',
    upgradeable: true,
    proxyType: 'UUPS',
    feeTiers: [
      { range: '$0-$100', rate: '1.0%', basisPoints: 100 },
      { range: '$101-$500', rate: '0.75%', basisPoints: 75 },
      { range: '$501-$2,000', rate: '0.5%', basisPoints: 50 },
      { range: '$2,001-$5,000', rate: '0.3%', basisPoints: 30 },
      { range: '$5,001+', rate: '0.2%', basisPoints: 20 }
    ],
    supportedTokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USD Coin
      cNGN: '0x46C85152bFe9f96829aA94755D9f915F9B10EF5F', // Nigerian Naira Coin
      NGNC: '0xe743f13623E000261b634f0e5676F294475ec24d', // Nigerian Naira Coin
      ZARP: '0xb755506531786C8aC63B756BaB1ac387bACB0C04', // South African Rand Coin
      IDRX: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', // Indonesian Rupiah Coin
      EURC: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', // Euro Coin
      CADC: '0x043eB4B75d0805c43D7C834902E335621983Cf03', // Canadian Dollar Coin
      BRL: '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4', // Brazilian Real Coin
      TRYB: '0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294', // Turkish Lira Coin
      NZDD: '0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7', // New Zealand Dollar Coin
      MXNe: '0x269caE7Dc59803e5C596c95756faEeBb6030E0aF'  // Mexican Peso Coin
    }
  };
  
  // Save to file
  const deploymentPath = path.join(__dirname, 'deployment-upgradeable.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('');
  console.log('💾 Deployment info saved to:', deploymentPath);
  console.log('');
  console.log('🎉 Deployment completed successfully!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('1. Update NEDAPAY_PROTOCOL_ADDRESS in app/utils/nedaPayProtocol.ts');
  console.log('2. Test the contract on testnet first');
  console.log('3. Consider setting up a multisig for upgrades');
  console.log('4. Implement monitoring for fee collection');
  
  return {
    proxy: nedaPayProtocol.address,
    implementation: implementationAddress
  };
}

// Handle both direct execution and module export
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = main;
