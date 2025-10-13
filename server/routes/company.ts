import express from "express";
import Company from "../models/Company.js";
import { deploySafe } from "../services/safeService.js";

const router = express.Router();

// POST /api/companies - Register a new company and deploy Safe
router.post("/", async (req, res) => {
  try {
    const { name, owners, threshold } = req.body;

    // Validation
    if (!name || !owners || !threshold) {
      return res
        .status(400)
        .json({
          error:
            "Missing required fields: name, owners, and threshold are required",
        });
    }

    if (!Array.isArray(owners) || owners.length === 0) {
      return res
        .status(400)
        .json({ error: "Owners must be a non-empty array" });
    }

    if (
      typeof threshold !== "number" ||
      threshold < 1 ||
      threshold > owners.length
    ) {
      return res
        .status(400)
        .json({ error: `Threshold must be between 1 and ${owners.length}` });
    }

    // Check if company name already exists
    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res
        .status(409)
        .json({ error: "Company with this name already exists" });
    }

    console.log(
      `Creating company "${name}" with ${owners.length} owners and threshold ${threshold}`
    );

    // Deploy Safe
    const safeAddress = await deploySafe(owners, threshold);
    console.log(`Safe deployed at address: ${safeAddress}`);

    // Save to DB
    const company = new Company({
      name,
      safeAddress,
      owners,
      threshold,
    });

    await company.save();
    console.log(`Company "${name}" saved to database`);

    res.status(201).json(company);
  } catch (error: unknown) {
    console.error("Error creating company:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      error: "Failed to create company",
      details: errorMessage,
    });
  }
});

// GET /api/companies - Get all companies
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get companies" });
  }
});

// GET /api/companies/by-name/:name - Get company by name
router.get("/by-name/:name", async (req, res) => {
  try {
    const company = await Company.findOne({ name: req.params.name });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get company" });
  }
});

// GET /api/companies/:id/safe - Get Safe info for a company
router.get("/:id/safe", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({
      safeAddress: company.safeAddress,
      owners: company.owners,
      threshold: company.threshold,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get company safe" });
  }
});

export default router;
