/**
 * Chainlink CCIP Configuration
 * Defines supported networks, routers, and tokens for cross-chain transfers
 */

export interface TokenConfig {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  chainSelector: string;
  routerAddress: string;
  rpcUrl: string;
  supportedTokens: TokenConfig[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export type NetworkName =
  | "ethereum-sepolia"
  | "arbitrum-sepolia"
  | "avalanche-fuji"
  | "polygon-amoy"
  | "base-sepolia";

/**
 * CCIP Network Configurations
 * Based on Chainlink CCIP documentation:
 * https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet
 */
export const CCIP_NETWORKS: Record<NetworkName, NetworkConfig> = {
  "ethereum-sepolia": {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    chainSelector: "16015286601757825753", // Sepolia chain selector
    routerAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // CCIP Router on Sepolia
    rpcUrl:
      import.meta.env.VITE_INFURA_RPC_URL ||
      "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    supportedTokens: [
      {
        name: "Chainlink Token",
        symbol: "LINK",
        address: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK on Sepolia
        decimals: 18,
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
        decimals: 6,
      },
      {
        name: "CCIP-BnM Test Token",
        symbol: "CCIP-BnM",
        address: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05", // CCIP-BnM on Sepolia
        decimals: 18,
      },
      {
        name: "CCIP-LnM Test Token",
        symbol: "CCIP-LnM",
        address: "0x466D489b6d36E7E3b824ef491C225F5830E81cC1", // CCIP-LnM on Sepolia
        decimals: 18,
      },
    ],
  },
  "arbitrum-sepolia": {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    chainSelector: "3478487238524512106", // Arbitrum Sepolia chain selector
    routerAddress: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165", // CCIP Router on Arbitrum Sepolia
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeCurrency: {
      name: "Arbitrum Ether",
      symbol: "ETH",
      decimals: 18,
    },
    supportedTokens: [
      {
        name: "Chainlink Token",
        symbol: "LINK",
        address: "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E", // LINK on Arbitrum Sepolia
        decimals: 18,
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC on Arbitrum Sepolia
        decimals: 6,
      },
      {
        name: "CCIP-BnM Test Token",
        symbol: "CCIP-BnM",
        address: "0xA8C0c11bf64AF62CDCA6f93D3769B88BdD7cb93D", // CCIP-BnM on Arbitrum Sepolia
        decimals: 18,
      },
      {
        name: "CCIP-LnM Test Token",
        symbol: "CCIP-LnM",
        address: "0x139E99f0ab4084E14e6bb7DacA289a91a2d92927", // CCIP-LnM on Arbitrum Sepolia
        decimals: 18,
      },
    ],
  },
  "avalanche-fuji": {
    chainId: 43113,
    name: "Avalanche Fuji",
    chainSelector: "14767482510784806043", // Avalanche Fuji chain selector
    routerAddress: "0xF694E193200268f9a4868e4Aa017A0118C9a8177", // CCIP Router on Avalanche Fuji
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    nativeCurrency: {
      name: "Avalanche",
      symbol: "AVAX",
      decimals: 18,
    },
    supportedTokens: [
      {
        name: "Chainlink Token",
        symbol: "LINK",
        address: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846", // LINK on Fuji
        decimals: 18,
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        address: "0x5425890298aed601595a70AB815c96711a31Bc65", // USDC on Fuji
        decimals: 6,
      },
      {
        name: "CCIP-BnM Test Token",
        symbol: "CCIP-BnM",
        address: "0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4", // CCIP-BnM on Fuji
        decimals: 18,
      },
      {
        name: "CCIP-LnM Test Token",
        symbol: "CCIP-LnM",
        address: "0x70F5c5C40b873EA597776DA2C21929A8282A953a", // CCIP-LnM on Fuji (clCCIP-LnM)
        decimals: 18,
      },
    ],
  },
  "polygon-amoy": {
    chainId: 80002,
    name: "Polygon Amoy",
    chainSelector: "16281711391670634445", // Polygon Amoy chain selector
    routerAddress: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2", // CCIP Router on Polygon Amoy
    rpcUrl: "https://rpc-amoy.polygon.technology",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    supportedTokens: [
      {
        name: "Chainlink Token",
        symbol: "LINK",
        address: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904", // LINK on Amoy
        decimals: 18,
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC on Amoy
        decimals: 6,
      },
      {
        name: "CCIP-BnM Test Token",
        symbol: "CCIP-BnM",
        address: "0xcab0EF91Bee323d1A617c0a027eE753aFd6997E4", // CCIP-BnM on Amoy
        decimals: 18,
      },
      {
        name: "CCIP-LnM Test Token",
        symbol: "CCIP-LnM",
        address: "0x3d357fb52253e86c8Ee0f80F5FaE4475b68503FF2", // CCIP-LnM on Amoy
        decimals: 18,
      },
    ],
  },
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    chainSelector: "10344971235874465080", // Base Sepolia chain selector
    routerAddress: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93", // CCIP Router on Base Sepolia
    rpcUrl: "https://sepolia.base.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    supportedTokens: [
      {
        name: "Chainlink Token",
        symbol: "LINK",
        address: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // LINK on Base Sepolia
        decimals: 18,
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
        decimals: 6,
      },
      {
        name: "CCIP-BnM Test Token",
        symbol: "CCIP-BnM",
        address: "0x88A2d74F47a237a62e7A51cdDa67270CE381555e", // CCIP-BnM on Base Sepolia
        decimals: 18,
      },
      {
        name: "CCIP-LnM Test Token",
        symbol: "CCIP-LnM",
        address: "0xA98FA8A008371b9408195e52734b1768c0d1Cb5c", // CCIP-LnM on Base Sepolia
        decimals: 18,
      },
    ],
  },
};

export const NetworkNameMapping: Record<string, NetworkName> = {
  "Ethereum Sepolia": "ethereum-sepolia",
  "Arbitrum Sepolia": "arbitrum-sepolia",
  "Avalanche Fuji": "avalanche-fuji",
  "Polygon Amoy": "polygon-amoy",
  "Base Sepolia": "base-sepolia",
};

/**
 * Get network configuration by name
 */
export const getNetworkConfig = (networkName: NetworkName): NetworkConfig => {
  const config = CCIP_NETWORKS[networkName];
  if (!config) {
    throw new Error(`Network ${networkName} not supported`);
  }
  return config;
};

/**
 * Get network configuration by chain ID
 */
export const getNetworkConfigByChainId = (
  chainId: number
): NetworkConfig | undefined => {
  return Object.values(CCIP_NETWORKS).find(
    (config) => config.chainId === chainId
  );
};

/**
 * Get all available destination networks (excluding the current network)
 */
export const getAvailableDestinationNetworks = (
  currentNetworkName: NetworkName
): NetworkConfig[] => {
  return Object.entries(CCIP_NETWORKS)
    .filter(([name]) => name !== currentNetworkName)
    .map(([, config]) => config);
};

/**
 * Get supported tokens for a network
 */
export const getSupportedTokens = (networkName: NetworkName): TokenConfig[] => {
  const config = getNetworkConfig(networkName);
  return config.supportedTokens;
};

/**
 * Find token by symbol on a specific network
 */
export const getTokenBySymbol = (
  networkName: NetworkName,
  symbol: string
): TokenConfig | undefined => {
  const tokens = getSupportedTokens(networkName);
  return tokens.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
};

/**
 * Check if a network pair is supported for CCIP transfers
 */
export const isSupportedNetworkPair = (
  sourceNetwork: NetworkName,
  destNetwork: NetworkName
): boolean => {
  // For now, all combinations are supported on testnet
  // In production, you might want to check specific lane support
  return (
    sourceNetwork !== destNetwork &&
    CCIP_NETWORKS[sourceNetwork] !== undefined &&
    CCIP_NETWORKS[destNetwork] !== undefined
  );
};

/**
 * Default source network (matching the current .env configuration)
 */
export const DEFAULT_SOURCE_NETWORK: NetworkName = "ethereum-sepolia";
