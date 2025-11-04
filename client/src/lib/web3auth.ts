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

/**
 * Check if user is already logged in (session persistence)
 * Returns true if session exists, false otherwise
 */
export const isLoggedIn = (): boolean => {
  return web3auth.connected;
};

/**
 * Try to restore existing session without showing login modal
 * Returns provider if session exists, null otherwise
 */
export const restoreSession = async () => {
  console.log("Checking for existing Web3Auth session...");

  if (web3auth.connected && web3auth.provider) {
    console.log("✅ Session found! User is already logged in");
    return web3auth.provider;
  }

  console.log("ℹ️ No existing session found");
  return null;
};

export const login = async () => {
  console.log("Logging in with Web3Auth...");

  const web3authProvider = await web3auth.connect();
  if (!web3authProvider) {
    throw new Error("Failed to connect to Web3Auth");
  }

  // Log successful login with user details
  console.log("✅ Successfully connected to Web3Auth");

  try {
    // Get and log user info
    const userInfo = await web3auth.getUserInfo();
    console.log("👤 User Info:", {
      email: userInfo.email,
      name: userInfo.name,
      profileImage: userInfo.profileImage,
      verifier: userInfo.verifier,
      verifierId: userInfo.verifierId,
    });

    // Get and log wallet address
    const ethersProvider = new BrowserProvider(web3authProvider);
    const signer = await ethersProvider.getSigner();
    const address = await signer.getAddress();
    console.log("🔑 Wallet Address:", address);

    // ⚠️ WARNING: Logging private key - ONLY FOR DEVELOPMENT
    // NEVER log private keys in production!
    // try {
    //   const privateKey = await web3authProvider.request({
    //     method: "eth_private_key",
    //   });
    //   console.log("🔐 Private Key:", privateKey);
    //   console.warn(
    //     "⚠️ WARNING: Private key logged to console. Keep this secure!"
    //   );
    // } catch (pkError) {
    //   console.warn("Could not retrieve private key:", pkError);
    // }
  } catch (error) {
    console.warn("Could not retrieve additional user info:", error);
  }

  return web3authProvider;
};

export const getSigner = async () => {
  console.log("Getting signer from Web3Auth...");

  // Try to use existing provider first, then login if needed
  const web3authProvider = web3auth.provider || (await login());
  const ethersProvider = new BrowserProvider(web3authProvider);
  const signer = await ethersProvider.getSigner();
  return signer;
};

export const getProvider = async (): Promise<BrowserProvider> => {
  console.log("Getting provider from Web3Auth...");

  // Try to use existing provider first, then login if needed
  const web3authProvider = web3auth.provider || (await login());
  const ethersProvider = new BrowserProvider(web3authProvider);
  return ethersProvider;
};

export const getRawProvider = async () => {
  console.log("Getting raw Web3Auth provider...");
  // Try to use existing provider first, then login if needed
  const web3authProvider = web3auth.provider || (await login());
  return web3authProvider;
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

export const getPrivateKey = async (): Promise<string> => {
  console.log("Getting private key from Web3Auth...");

  const web3authProvider = web3auth.provider || (await login());
  if (!web3authProvider) {
    throw new Error("Web3Auth provider not available");
  }

  try {
    // Request private key from Web3Auth provider
    const privateKey = await web3authProvider.request({
      method: "eth_private_key",
    });

    if (typeof privateKey === "string") {
      console.log("Successfully retrieved private key");
      return privateKey;
    }

    throw new Error("Failed to retrieve private key");
  } catch (error) {
    console.error("Error retrieving private key:", error);
    throw new Error("Failed to get private key from Web3Auth");
  }
};

export { web3auth };
