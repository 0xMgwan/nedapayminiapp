// Stablecoins data from stablecoins.earth
export const stablecoins = [
  {
    region: 'Tanzania',
    flag: '🇹🇿',
    currency: 'TZS',
    baseToken: 'TSHC',
    name: 'Tanzania Shilling Coin',
    address: '0x123456789abcdef123456789abcdef123456789a', // Placeholder address
    issuer: 'NEDA Pay',
    description: 'Stablecoin pegged 1:1 to the Tanzania Shilling (TZS)',
    website: 'https://nedapay.app',
    chainId: 11155111 // Sepolia Testnet
  },
  {
    region: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    baseToken: 'cNGN',
    name: 'Nigerian Naira Coin',
    address: '0x46C85152bFe9f96829aA94755D9f915F9B10EF5F', // Updated to correct cNGN address
    issuer: 'Convexity',
    description: 'Stablecoin pegged 1:1 to the Nigerian Naira (NGN)',
    website: 'https://stablecoins.earth',
    chainId: 8453, // Base Mainnet
    decimals: 6
  },
  {
    region: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    baseToken: 'NGNC',
    decimals: 18,
    name: 'Nigerian Naira Coin',
    address: '0xe743f13623E000261b634f0e5676F294475ec24d', // Updated NGNC address
    issuer: 'Link',
    description: 'Stablecoin pegged 1:1 to the Nigerian Naira (NGN)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'South Africa',
    flag: '🇿🇦',
    currency: 'ZAR',
    baseToken: 'ZARP',
    decimals: 18,
    name: 'South African Rand Coin',
    address: '0xb755506531786C8aC63B756BaB1ac387bACB0C04', // Updated ZARP address
    issuer: 'inv.es',
    description: 'Stablecoin pegged 1:1 to the South African Rand (ZAR)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'Indonesia',
    flag: '🇮🇩',
    currency: 'IDR',
    baseToken: 'IDRX',
    name: 'Indonesian Rupiah Coin',
    address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', // Updated to correct IDRX address
    issuer: 'IDRX.co',
    description: 'Stablecoin pegged 1:1 to the Indonesian Rupiah (IDR)',
    website: 'https://stablecoins.earth',
    chainId: 8453, // Base Mainnet
    decimals: 2
  },
  {
    region: 'Europe',
    flag: '🇪🇺',
    currency: 'EUR',
    baseToken: 'EURC',
    decimals: 6,
    name: 'Euro Coin',
    address: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42', // EURC address confirmed
    issuer: 'Circle',
    description: 'Stablecoin pegged 1:1 to the Euro (EUR)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'Canada',
    flag: '🇨🇦',
    currency: 'CAD',
    baseToken: 'CADC',
    decimals: 18,
    name: 'Canadian Dollar Coin',
    address: '0x043eB4B75d0805c43D7C834902E335621983Cf03', // CADC address confirmed
    issuer: 'PayTrie',
    description: 'Stablecoin pegged 1:1 to the Canadian Dollar (CAD)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'Brazil',
    flag: '🇧🇷',
    currency: 'BRL',
    baseToken: 'BRL',
    decimals: 18,
    name: 'Brazilian Real Coin',
    address: '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4', // address confirmed
    issuer: 'Transfero',
    description: 'Stablecoin pegged 1:1 to the Brazilian Real (BRL)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'Turkey',
    flag: '🇹🇷',
    currency: 'TRY',
    baseToken: 'TRYB',
    decimals: 6,
    name: 'Turkish Lira Coin',
    address: '0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294', // address confirmed
    issuer: 'BiLira',
    description: 'Stablecoin pegged 1:1 to the Turkish Lira (TRY)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'New Zealand',
    flag: '🇳🇿',
    currency: 'NZD',
    baseToken: 'NZDD',
    decimals: 6,
    name: 'New Zealand Dollar Coin',
    address: '0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7', // NZD address confirmed
    issuer: 'Easy Crypto',
    description: 'Stablecoin pegged 1:1 to the New Zealand Dollar (NZD)',
    website: 'https://stablecoins.earth',
    chainId: 8453 // Base Mainnet
  },
  {
    region: 'Mexico',
    flag: '🇲🇽',
    currency: 'MXN',
    baseToken: 'MXNe',
    decimals: 6,
    name: 'Mexican Peso Coin',
    address: '0x269caE7Dc59803e5C596c95756faEeBb6030E0aF', // address confirmed
    issuer: 'Etherfuse/Brale',
    description: 'Stablecoin pegged 1:1 to the Mexican Peso (MXN)',
    website: 'https://stablecoins.earth',
  },
  {
    region: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    baseToken: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet
    issuer: 'Circle',
    description: 'USD-backed stablecoin by Circle (Base Mainnet)',
    website: 'https://www.circle.com/usdc',
    chainId: 8453, // Base Mainnet
    decimals: 6
  }
];
