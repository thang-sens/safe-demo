import React, { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { getCompanySafe } from "../lib/api";
import { getProvider, getAddress } from "../lib/web3auth";
import SafeTransactions from "./SafeTransactions";

interface SafeInfo {
  safeAddress: string;
  owners: string[];
  threshold: number;
}

const CompanyDashboard: React.FC = () => {
  const [companyId, setCompanyId] = useState("");
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Initialize provider and get user address on component mount
  useEffect(() => {
    initializeProvider();
  }, []);

  const initializeProvider = async () => {
    try {
      const ethersProvider = await getProvider();
      const address = await getAddress();
      setProvider(ethersProvider);
      setUserAddress(address);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initialize provider";
      setError(errorMessage);
      console.error("Failed to initialize provider:", err);
    }
  };

  const handleGetSafe = async () => {
    if (!companyId.trim()) {
      setError("Please enter a Company ID or Name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const info = await getCompanySafe(companyId);
      setSafeInfo(info);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get Safe info";
      setError(errorMessage);
      console.error("Failed to get safe:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSafe = () => {
    setSafeInfo(null);
    setCompanyId("");
    setError("");
  };

  return (
    <div className="company-dashboard">
      <h2>Company Dashboard</h2>

      {error && <div className="error-message">{error}</div>}

      {!safeInfo ? (
        <div className="safe-search">
          <h3>Search for Company Safe</h3>
          <p className="info-text">
            Enter the Company ID (MongoDB ID) or Company Name to load the Safe
            wallet
          </p>

          <div className="search-form">
            <input
              type="text"
              placeholder="Company ID or Name (e.g., 'Acme Corp')"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleGetSafe()}
              disabled={loading}
            />
            <button
              onClick={handleGetSafe}
              disabled={loading || !companyId.trim()}
            >
              {loading ? "Loading..." : "Get Safe Info"}
            </button>
          </div>

          {userAddress && (
            <p className="user-info">
              Your address: <code>{userAddress}</code>
            </p>
          )}
        </div>
      ) : (
        <div className="safe-loaded">
          <div className="safe-header">
            <div>
              <h3>Safe Wallet Loaded</h3>
              <p className="safe-address">
                <strong>Safe Address:</strong>
                <code>{safeInfo.safeAddress}</code>
                <a
                  href={`https://sepolia.etherscan.io/address/${safeInfo.safeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  View on Etherscan ↗
                </a>
              </p>
              <p>
                <strong>Owners:</strong> {safeInfo.owners.length} |
                <strong> Threshold:</strong> {safeInfo.threshold}
              </p>
            </div>
            <button onClick={handleClearSafe} className="clear-button">
              ← Back to Search
            </button>
          </div>

          {provider && userAddress ? (
            <SafeTransactions
              safeAddress={safeInfo.safeAddress}
              provider={provider}
              userAddress={userAddress}
            />
          ) : (
            <div className="loading">
              <p>Initializing Web3 Provider...</p>
              <button onClick={initializeProvider}>Retry</button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .company-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .error-message {
          background: #fee;
          color: #c00;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #fcc;
        }

        .safe-search {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .safe-search h3 {
          margin-top: 0;
          color: #333;
        }

        .info-text {
          color: #666;
          margin-bottom: 20px;
        }

        .search-form {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .search-form input {
          flex: 1;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .search-form input:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .search-form button {
          padding: 12px 24px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .search-form button:hover:not(:disabled) {
          background: #45a049;
        }

        .search-form button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .user-info {
          font-size: 14px;
          color: #666;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
        }

        .user-info code {
          background: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .safe-loaded {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .safe-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #eee;
        }

        .safe-header h3 {
          margin-top: 0;
          color: #333;
        }

        .safe-address {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
        }

        .safe-address code {
          background: #f5f5f5;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .explorer-link {
          color: #4CAF50;
          text-decoration: none;
          font-size: 12px;
          white-space: nowrap;
        }

        .explorer-link:hover {
          text-decoration: underline;
        }

        .clear-button {
          padding: 10px 20px;
          background: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .clear-button:hover {
          background: #e0e0e0;
          border-color: #bbb;
        }

        .loading {
          text-align: center;
          padding: 40px;
        }

        .loading button {
          margin-top: 15px;
          padding: 10px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .loading button:hover {
          background: #45a049;
        }
      `}</style>
    </div>
  );
};

export default CompanyDashboard;
