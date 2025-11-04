/**
 * Test Script: Check CCIP Token Support
 *
 * This script tests if a token is supported for CCIP transfer between chains
 * Run: node test-token-support.js
 */

import { createClient } from "@chainlink/ccip-js";
import { ethers } from "ethers";

// Configuration
const config = {
  // Source network
  sourceNetwork: {
    name: "Ethereum Sepolia",
    rpcUrl:
      process.env.VITE_INFURA_RPC_URL ||
      "https://sepolia.infura.io/v3/YOUR_KEY",
    routerAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // CCIP Router Sepolia
  },

  // Destination networks
  destinations: {
    arbitrumSepolia: {
      name: "Arbitrum Sepolia",
      chainSelector: "3478487238524512106",
    },
    avalancheFuji: {
      name: "Avalanche Fuji",
      chainSelector: "14767482510784806043",
    },
    polygonAmoy: {
      name: "Polygon Amoy",
      chainSelector: "16281711391670634445",
    },
  },

  // Test tokens
  tokens: {
    ccipBnM: {
      name: "CCIP-BnM",
      address: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05",
      expected: true, // Should be supported
    },
    ccipLnM: {
      name: "CCIP-LnM",
      address: "0x466D489b6d36E7E3b824ef491C225F5830E81cC1",
      expected: true, // Should be supported
    },
    link: {
      name: "LINK",
      address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      expected: true, // Should be supported (fee token)
    },
    // Add a random token that should NOT be supported
    randomToken: {
      name: "Random ERC20",
      address: "0x1234567890123456789012345678901234567890",
      expected: false, // Should NOT be supported
    },
  },
};

/**
 * Check if token is supported for CCIP transfer
 */
async function checkTokenSupport(tokenName, tokenAddress, destination) {
  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔍 Checking: ${tokenName} → ${destination.name}`);
    console.log(`${"=".repeat(60)}`);

    // Create provider
    const provider = new ethers.JsonRpcProvider(config.sourceNetwork.rpcUrl);

    // Create CCIP client
    const ccipClient = createClient();

    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Router: ${config.sourceNetwork.routerAddress}`);
    console.log(`Destination Chain Selector: ${destination.chainSelector}`);

    // Check if token is supported
    console.log(`\n⏳ Checking on-chain...`);

    const isSupported = await ccipClient.isTokenSupported({
      client: provider,
      routerAddress: config.sourceNetwork.routerAddress,
      destinationChainSelector: destination.chainSelector,
      tokenAddress: tokenAddress,
    });

    if (isSupported) {
      console.log(`✅ SUPPORTED - Token CAN be transferred via CCIP`);
    } else {
      console.log(`❌ NOT SUPPORTED - Token CANNOT be transferred via CCIP`);
    }

    return {
      token: tokenName,
      destination: destination.name,
      isSupported,
      tokenAddress,
    };
  } catch (error) {
    console.error(`\n❌ Error checking ${tokenName}:`, error.message);
    return {
      token: tokenName,
      destination: destination.name,
      isSupported: false,
      error: error.message,
    };
  }
}

/**
 * Run comprehensive test
 */
async function runTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         CCIP Token Support Validation Test                ║
║         Source: ${config.sourceNetwork.name.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
  `);

  const results = [];

  // Test all token-destination combinations
  for (const [tokenKey, token] of Object.entries(config.tokens)) {
    for (const [destKey, destination] of Object.entries(config.destinations)) {
      const result = await checkTokenSupport(
        token.name,
        token.address,
        destination
      );

      results.push({
        ...result,
        expected: token.expected,
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${"=".repeat(60)}\n`);

  const grouped = results.reduce((acc, result) => {
    const key = result.token;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {});

  for (const [token, tokenResults] of Object.entries(grouped)) {
    console.log(`\n${token}:`);
    tokenResults.forEach((r) => {
      const icon = r.isSupported ? "✅" : "❌";
      const status = r.isSupported ? "SUPPORTED" : "NOT SUPPORTED";
      console.log(`  ${icon} ${r.destination.padEnd(20)} - ${status}`);
    });
  }

  // Validation check
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`🧪 VALIDATION CHECK`);
  console.log(`${"=".repeat(60)}\n`);

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.expected === result.isSupported) {
      passed++;
    } else {
      failed++;
      console.log(
        `⚠️  Unexpected result for ${result.token} → ${result.destination}`
      );
      console.log(
        `   Expected: ${result.expected ? "SUPPORTED" : "NOT SUPPORTED"}`
      );
      console.log(
        `   Got: ${result.isSupported ? "SUPPORTED" : "NOT SUPPORTED"}\n`
      );
    }
  }

  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`);
  } else {
    console.log(`\n⚠️  Some tests failed. Review results above.`);
  }
}

// Run tests
runTests().catch(console.error);
