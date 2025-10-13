import { useState } from "react";
import { createCompany } from "../lib/api";
import { getAddress } from "../lib/web3auth";

interface Company {
  _id: string;
  name: string;
  safeAddress: string;
  owners: string[];
  threshold: number;
  createdAt: string;
}

interface CreateCompanyProps {
  onSuccess?: (companyData: Company) => void;
}

const CreateCompany: React.FC<CreateCompanyProps> = ({ onSuccess }) => {
  const [companyName, setCompanyName] = useState("");
  const [owners, setOwners] = useState<string[]>([""]);
  const [threshold, setThreshold] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Company | null>(null);

  // Add current user as owner
  const handleAddCurrentUser = async () => {
    try {
      const userAddress = await getAddress();
      if (!owners.includes(userAddress)) {
        setOwners([...owners, userAddress]);
      }
    } catch {
      setError(
        "Failed to get your address. Please make sure you're logged in."
      );
    }
  };

  // Add a new empty owner input
  const handleAddOwner = () => {
    setOwners([...owners, ""]);
  };

  // Update owner at specific index
  const handleOwnerChange = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };

  // Remove owner at specific index
  const handleRemoveOwner = (index: number) => {
    if (owners.length > 1) {
      const newOwners = owners.filter((_, i) => i !== index);
      setOwners(newOwners);

      // Adjust threshold if needed
      if (threshold > newOwners.length) {
        setThreshold(newOwners.length);
      }
    }
  };

  // Validate Ethereum address
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    // Filter out empty owners
    const validOwners = owners.filter((owner) => owner.trim() !== "");

    if (validOwners.length === 0) {
      setError("At least one owner is required");
      return;
    }

    // Validate all addresses
    const invalidAddresses = validOwners.filter(
      (owner) => !isValidAddress(owner)
    );
    if (invalidAddresses.length > 0) {
      setError(`Invalid Ethereum address(es): ${invalidAddresses.join(", ")}`);
      return;
    }

    // Check for duplicate owners
    const uniqueOwners = [...new Set(validOwners)];
    if (uniqueOwners.length !== validOwners.length) {
      setError("Duplicate owner addresses found. Each owner must be unique.");
      return;
    }

    if (threshold < 1 || threshold > uniqueOwners.length) {
      setError(`Threshold must be between 1 and ${uniqueOwners.length}`);
      return;
    }

    // Create company
    setLoading(true);
    try {
      const result = await createCompany({
        name: companyName.trim(),
        owners: uniqueOwners,
        threshold,
      });

      setSuccess(result);
      setCompanyName("");
      setOwners([""]);
      setThreshold(1);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error("Failed to create company:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response
              ?.data?.error || "Failed to create company. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-company">
      <h2>Create New Company Safe</h2>

      {error && (
        <div
          className="error-message"
          style={{ color: "red", marginBottom: "10px" }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="success-message"
          style={{ color: "green", marginBottom: "10px" }}
        >
          <p>✅ Company created successfully!</p>
          <p>
            <strong>Name:</strong> {success.name}
          </p>
          <p>
            <strong>Safe Address:</strong> {success.safeAddress}
          </p>
          <p>
            <strong>Threshold:</strong> {success.threshold}/
            {success.owners.length}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Company Name */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label htmlFor="companyName">
            Company Name:
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              disabled={loading}
              style={{ marginLeft: "10px", padding: "5px", width: "300px" }}
            />
          </label>
        </div>

        {/* Owners */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Owners (Ethereum Addresses):</label>
          <button
            type="button"
            onClick={handleAddCurrentUser}
            disabled={loading}
            style={{ marginLeft: "10px", padding: "5px 10px" }}
          >
            Add Me as Owner
          </button>

          <div style={{ marginTop: "10px" }}>
            {owners.map((owner, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => handleOwnerChange(index, e.target.value)}
                  placeholder="0x..."
                  disabled={loading}
                  style={{
                    padding: "5px",
                    width: "400px",
                    fontFamily: "monospace",
                  }}
                />
                {owners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOwner(index)}
                    disabled={loading}
                    style={{
                      marginLeft: "10px",
                      padding: "5px 10px",
                      background: "#ff4444",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOwner}
              disabled={loading}
              style={{ marginTop: "5px", padding: "5px 10px" }}
            >
              + Add Another Owner
            </button>
          </div>
        </div>

        {/* Threshold */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label htmlFor="threshold">
            Signature Threshold:
            <input
              id="threshold"
              type="number"
              min="1"
              max={owners.filter((o) => o.trim()).length || 1}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
              disabled={loading}
              style={{ marginLeft: "10px", padding: "5px", width: "100px" }}
            />
          </label>
          <span style={{ marginLeft: "10px", color: "#666" }}>
            (Requires {threshold} out of {owners.filter((o) => o.trim()).length}{" "}
            signatures)
          </span>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              background: loading ? "#ccc" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Creating Company & Deploying Safe..."
              : "Create Company"}
          </button>
        </div>
      </form>

      {loading && (
        <div style={{ marginTop: "15px", color: "#666" }}>
          <p>⏳ Deploying Safe to blockchain... This may take a minute.</p>
        </div>
      )}
    </div>
  );
};

export default CreateCompany;
