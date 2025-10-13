import { ethers } from "ethers";
import Safe, {
  SafeAccountConfig,
  PredictedSafeProps,
} from "@safe-global/protocol-kit";

export async function deploySafe(
  owners: string[],
  threshold: number
): Promise<string> {
  // Load environment variables
  const rpcUrl = process.env.INFURA_RPC_URL!;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY!;

  // Validate private key
  if (!privateKey || privateKey === "YOUR_PRIVATE_KEY_HERE") {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set in .env file. Please add a valid 64-character private key."
    );
  }

  // Create provider and signer
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // Safe account configuration
  const safeAccountConfig: SafeAccountConfig = {
    owners,
    threshold,
  };

  // Predicted Safe configuration
  const predictedSafe: PredictedSafeProps = {
    safeAccountConfig,
  };

  // Initialize Safe for deployment
  const safe = await Safe.init({
    provider: rpcUrl,
    signer: privateKey,
    predictedSafe,
  });

  // Get the predicted Safe address
  const safeAddress = await safe.getAddress();

  // Create deployment transaction
  const deploymentTransaction = await safe.createSafeDeploymentTransaction();

  // Execute the deployment transaction using ethers signer
  const txResponse = await signer.sendTransaction({
    to: deploymentTransaction.to,
    value: ethers.BigNumber.from(deploymentTransaction.value),
    data: deploymentTransaction.data,
  });

  // Wait for transaction to be mined
  await txResponse.wait();

  // Reconnect to the deployed Safe
  const deployedSafe = await safe.connect({ safeAddress });

  return safeAddress;
}
