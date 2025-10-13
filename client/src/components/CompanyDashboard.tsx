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
          text-align: left;
        }

        .safe-search {
          background: var(--bg-primary);
          padding: 2rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-md);
        }

        .safe-search h3 {
          margin-top: 0;
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 600;
        }

        .info-text {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .search-form {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .search-form input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.875rem;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          transition: all 0.2s ease;
        }

        .search-form input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-light);
        }

        .search-form button {
          padding: 0.75rem 1.5rem;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .search-form button:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .search-form button:disabled {
          background: var(--secondary-color);
          cursor: not-allowed;
          opacity: 0.5;
        }

        .user-info {
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding: 0.875rem 1rem;
          background: var(--primary-light);
          border-radius: 8px;
          border: 1px solid #ABEFC6;
        }

        .user-info code {
          background: var(--bg-primary);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.75rem;
          color: var(--primary-color);
          font-weight: 500;
        }

        .safe-loaded {
          background: var(--bg-primary);
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-md);
        }

        .safe-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-light);
        }

        .safe-header h3 {
          margin-top: 0;
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 600;
        }

        .safe-address {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0.75rem 0;
          flex-wrap: wrap;
        }

        .safe-address code {
          background: var(--bg-tertiary);
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.75rem;
          word-break: break-all;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .explorer-link {
          color: var(--primary-color);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          transition: color 0.2s ease;
        }

        .explorer-link:hover {
          color: var(--primary-hover);
        }

        .clear-button {
          padding: 0.625rem 1.25rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .clear-button:hover {
          background: var(--bg-tertiary);
          border-color: var(--secondary-color);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        .loading button {
          margin-top: 1rem;
          padding: 0.625rem 1.25rem;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .loading button:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export default CompanyDashboard;
