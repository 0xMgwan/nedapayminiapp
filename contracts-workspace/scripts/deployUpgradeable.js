const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Deploying NedaPayProtocolUpgradeable...\n');

  // Get the contract factory
  const NedaPayProtocolUpgradeable = await ethers.getContractFactory('NedaPayProtocolUpgradeable');

  // Deploy the upgradeable contract
  console.log('📦 Deploying proxy and implementation...');
  const nedaPayProtocol = await upgrades.deployProxy(
    NedaPayProtocolUpgradeable,
    [], // No constructor args, using initialize()
    {
      initializer: 'initialize',
      kind: 'uups'
    }
  );

  await nedaPayProtocol.waitForDeployment();
  const proxyAddress = await nedaPayProtocol.getAddress();

  console.log('✅ NedaPayProtocolUpgradeable deployed!');
  console.log('📍 Proxy Address:', proxyAddress);

  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('📍 Implementation Address:', implementationAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log('🌐 Network:', network.name, `(Chain ID: ${network.chainId})`);

  // Display fee tiers
  console.log('\n💰 Fee Tiers:');
  const feeTiersLength = await nedaPayProtocol.getFeeTiersLength();
  for (let i = 0; i < feeTiersLength; i++) {
    const tier = await nedaPayProtocol.feeTiers(i);
    const minUSD = ethers.formatEther(tier.minAmount);
    const maxUSD = tier.maxAmount === 0n ? '∞' : ethers.formatEther(tier.maxAmount);
    const feePercent = (Number(tier.feeRate) / 100).toFixed(2);
    console.log(`   Tier ${i + 1}: $${minUSD} - $${maxUSD} → ${feePercent}%`);
  }

  // Display supported tokens (first few)
  console.log('\n🪙 Supported Tokens:');
  const supportedTokens = [
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

  for (const token of supportedTokens) {
    const isSupported = await nedaPayProtocol.isTokenSupported(token.address);
    console.log(`   ${token.symbol}: ${isSupported ? '✅' : '❌'} ${token.address}`);
  }

  // Fee examples
  console.log('\n📊 Fee Examples:');
  const examples = [
    { amount: '50', expected: '1.0%' },
    { amount: '250', expected: '0.75%' },
    { amount: '1000', expected: '0.5%' },
    { amount: '3000', expected: '0.3%' },
    { amount: '10000', expected: '0.2%' }
  ];

  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  for (const example of examples) {
    const amount = ethers.parseUnits(example.amount, 6); // USDC has 6 decimals
    const fee = await nedaPayProtocol.calculateFee(usdcAddress, amount);
    const feeAmount = ethers.formatUnits(fee, 6);
    console.log(`   $${example.amount} → $${feeAmount} fee (${example.expected})`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    deployedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  const deploymentPath = path.join(__dirname, '..', 'deployments.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved to deployments.json');

  console.log('\n🎉 Deployment completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Verify the contract on Basescan');
  console.log('2. Update frontend with proxy address');
  console.log('3. Test contract functions');
  console.log('4. Deploy to mainnet when ready');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
