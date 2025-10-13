import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { BrowserProvider } from "ethers";

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;

// Configure the Ethereum provider
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: import.meta.env.VITE_CHAIN_ID,
  rpcTarget: import.meta.env.VITE_INFURA_RPC_URL,
  displayName: "Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

// Initialize the Ethereum provider
const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

// Initialize Web3Auth with modal
const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET, // Use SAPPHIRE_MAINNET for production
  chainConfig,
  privateKeyProvider,
  uiConfig: {
    appName: "Safe Multisig Demo",
    mode: "light",
    loginMethodsOrder: ["google", "github"],
    defaultLanguage: "en",
  },
});

export const initWeb3Auth = async () => {
  console.log("Initializing Web3Auth...");
  await web3auth.initModal();
  console.log("Web3Auth initialized successfully");
};

export const login = async () => {
  console.log("Logging in with Web3Auth...");

  const web3authProvider = await web3auth.connect();
  if (!web3authProvider) {
    throw new Error("Failed to connect to Web3Auth");
  }
  console.log("Successfully connected to Web3Auth");
  return web3authProvider;
};

export const getSigner = async () => {
  console.log("Getting signer from Web3Auth...");

  const web3authProvider = await login();
  const ethersProvider = new BrowserProvider(web3authProvider);
  const signer = await ethersProvider.getSigner();
  return signer;
};

export const getProvider = async (): Promise<BrowserProvider> => {
  console.log("Getting provider from Web3Auth...");

  const web3authProvider = web3auth.provider || (await login());
  const ethersProvider = new BrowserProvider(web3authProvider);
  return ethersProvider;
};

export const getAddress = async () => {
  const signer = await getSigner();
  return await signer.getAddress();
};

export const logout = async () => {
  console.log("Logging out from Web3Auth...");
  await web3auth.logout();
  console.log("Successfully logged out");
};

export const getUserInfo = async () => {
  const userInfo = await web3auth.getUserInfo();
  return userInfo;
};

export { web3auth };
