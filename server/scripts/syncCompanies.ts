// Manual sync script to update MongoDB from blockchain data
// Usage: node --loader ts-node/esm scripts/syncCompanies.ts

import mongoose from "mongoose";
import { config } from "dotenv";
import { ethers } from "ethers";
import Safe from "@safe-global/protocol-kit";
import Company from "../models/Company.js";

config();

interface SafeInfo {
  owners: string[];
  threshold: number;
}

async function getSafeInfoFromBlockchain(
  safeAddress: string,
  rpcUrl: string
): Promise<SafeInfo> {
  const safe = await Safe.init({
    provider: rpcUrl,
    safeAddress,
  });

  const owners = await safe.getOwners();
  const threshold = await safe.getThreshold();

  return {
    owners,
    threshold,
  };
}

async function syncAllCompanies() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("Connected to MongoDB");

    const rpcUrl = process.env.INFURA_RPC_URL!;

    // Get all companies
    const companies = await Company.find();
    console.log(`Found ${companies.length} companies to sync\n`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      try {
        console.log(`\n📋 Syncing: ${company.name}`);
        console.log(`   Safe Address: ${company.safeAddress}`);

        // Get current DB data
        console.log(`   Current DB: ${company.owners.length} owners, threshold ${company.threshold}`);

        // Get blockchain data
        const blockchainInfo = await getSafeInfoFromBlockchain(
          company.safeAddress,
          rpcUrl
        );
        console.log(`   Blockchain: ${blockchainInfo.owners.length} owners, threshold ${blockchainInfo.threshold}`);

        // Check if update needed
        const ownersChanged =
          JSON.stringify(company.owners.sort()) !==
          JSON.stringify(blockchainInfo.owners.sort());
        const thresholdChanged = company.threshold !== blockchainInfo.threshold;

        if (ownersChanged || thresholdChanged) {
          company.owners = blockchainInfo.owners;
          company.threshold = blockchainInfo.threshold;
          await company.save();
          console.log(`   ✅ Updated in MongoDB`);
          syncedCount++;
        } else {
          console.log(`   ✓ Already in sync`);
        }
      } catch (error) {
        console.error(`   ❌ Error syncing ${company.name}:`, error);
        errorCount++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total companies: ${companies.length}`);
    console.log(`   Synced: ${syncedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Already synced: ${companies.length - syncedCount - errorCount}`);
  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✓ Disconnected from MongoDB");
  }
}

// Run the sync
syncAllCompanies();
