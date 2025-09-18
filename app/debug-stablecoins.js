console.log('🔍 Stablecoins array:', JSON.stringify(stablecoins.map(s => ({ baseToken: s.baseToken, name: s.name, chainId: s.chainId })), null, 2));
