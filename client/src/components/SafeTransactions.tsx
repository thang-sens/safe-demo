import { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import {
  proposeTransaction,
  confirmTransaction,
  executeTransaction,
  getPendingTransactions,
  getTransactionHistory,
  addOwner,
  removeOwner,
  changeThreshold,
} from "../lib/safeFlow";
import type { TransactionData, SafeTransaction } from "../lib/safeFlow";
import { getSafeInfo, getChainId } from "../lib/safe";
import { syncCompanyData } from "../lib/api";
import CCIPTransfer from "./CCIPTransfer";

interface SafeTransactionsProps {
  safeAddress: string;
  provider: BrowserProvider;
  userAddress: string;
}

interface SafeInfo {
  address: string;
  owners: string[];
  threshold: number;
  nonce: number;
  balance: string;
}

export default function SafeTransactions({
  safeAddress,
  provider,
  userAddress,
}: SafeTransactionsProps) {
  const [pendingTxs, setPendingTxs] = useState<SafeTransaction[]>([]);
  const [history, setHistory] = useState<SafeTransaction[]>([]);
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"transactions" | "ccip" | "owners">("transactions");

  // Form states
  const [txForm, setTxForm] = useState<TransactionData>({
    to: "",
    value: "0",
    data: "0x",
    operation: 0,
  });
  const [newOwner, setNewOwner] = useState("");
  const [ownerToRemove, setOwnerToRemove] = useState("");
  const [newThreshold, setNewThreshold] = useState(1);

  // Helper function to sync backend after owner/threshold changes
  const syncBackendData = async () => {
    try {
      if (safeInfo) {
        await syncCompanyData(safeAddress, safeInfo.owners, safeInfo.threshold);
        console.log("Backend synced successfully");
      }
    } catch (error) {
      console.error("Error syncing backend:", error);
      // Don't throw error - this is non-critical
    }
  };

  // Load Safe data
  const loadSafeData = async () => {
    try {
      setLoading(true);
      setError("");

      const chain = await getChainId(provider);
      const [info, pending, hist] = await Promise.all([
        getSafeInfo(safeAddress, provider),
        getPendingTransactions(safeAddress, chain),
        getTransactionHistory(safeAddress, chain),
      ]);

      setSafeInfo(info);
      setPendingTxs(pending);
      setHistory(hist);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Error loading Safe data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSafeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeAddress]);

  // Propose a new transaction
  const handleProposeTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const safeTxHash = await proposeTransaction(
        safeAddress,
        txForm,
        provider
      );
      alert(`Transaction proposed successfully!\nSafe TX Hash: ${safeTxHash}`);

      // Reset form and reload
      setTxForm({ to: "", value: "0", data: "0x", operation: 0 });
      await loadSafeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to propose transaction";
      setError(errorMessage);
      console.error("Error proposing transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Confirm a pending transaction
  const handleConfirmTransaction = async (safeTxHash: string) => {
    try {
      setLoading(true);
      setError("");

      await confirmTransaction(safeAddress, safeTxHash, provider);
      alert("Transaction confirmed successfully!");
      await loadSafeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to confirm transaction";
      setError(errorMessage);
      console.error("Error confirming transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Execute a transaction
  const handleExecuteTransaction = async (safeTxHash: string) => {
    try {
      setLoading(true);
      setError("");

      const txHash = await executeTransaction(
        safeAddress,
        safeTxHash,
        provider
      );
      alert(`Transaction executed successfully!\nTX Hash: ${txHash}`);
      
      // Reload Safe data to get updated owners/threshold
      await loadSafeData();
      
      // Sync backend with updated data
      // Wait a bit for blockchain state to be fully updated
      setTimeout(async () => {
        await syncBackendData();
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to execute transaction";
      setError(errorMessage);
      console.error("Error executing transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Add a new owner
  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const safeTxHash = await addOwner(
        safeAddress,
        newOwner,
        newThreshold,
        provider
      );
      alert(
        `Add owner transaction proposed!\nSafe TX Hash: ${safeTxHash}\nOther owners must confirm this transaction.`
      );

      setNewOwner("");
      await loadSafeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add owner";
      setError(errorMessage);
      console.error("Error adding owner:", err);
    } finally {
      setLoading(false);
    }
  };

  // Remove an owner
  const handleRemoveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const safeTxHash = await removeOwner(
        safeAddress,
        ownerToRemove,
        newThreshold,
        provider
      );
      alert(
        `Remove owner transaction proposed!\nSafe TX Hash: ${safeTxHash}\nOther owners must confirm this transaction.`
      );

      setOwnerToRemove("");
      await loadSafeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove owner";
      setError(errorMessage);
      console.error("Error removing owner:", err);
    } finally {
      setLoading(false);
    }
  };

  // Change threshold
  const handleChangeThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const safeTxHash = await changeThreshold(
        safeAddress,
        newThreshold,
        provider
      );
      alert(
        `Change threshold transaction proposed!\nSafe TX Hash: ${safeTxHash}\nOther owners must confirm this transaction.`
      );

      await loadSafeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to change threshold";
      setError(errorMessage);
      console.error("Error changing threshold:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has already confirmed a transaction
  const hasUserConfirmed = (tx: SafeTransaction): boolean => {
    return tx.confirmations.some(
      (conf) => conf.owner.toLowerCase() === userAddress.toLowerCase()
    );
  };

  if (loading && !safeInfo) {
    return <div className="loading">Loading Safe data...</div>;
  }

  return (
    <div className="safe-transactions">
      <h2>Safe Transactions</h2>

      {error && <div className="error">{error}</div>}

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={activeTab === "transactions" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("transactions")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
            <path d="M3 8L10 3L17 8M4 9V16C4 16.5523 4.44772 17 5 17H15C15.5523 17 16 16.5523 16 16V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Transactions
        </button>
        <button
          className={activeTab === "ccip" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("ccip")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
            <path d="M14 6L18 10M18 10L14 14M18 10H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Cross-Chain Transfer
        </button>
        <button
          className={activeTab === "owners" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("owners")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
            <path d="M13 7C13 8.65685 11.6569 10 10 10C8.34315 10 7 8.65685 7 7C7 5.34315 8.34315 4 10 4C11.6569 4 13 5.34315 13 7Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 16C5 13.7909 6.79086 12 9 12H11C13.2091 12 15 13.7909 15 16V17H5V16Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Owner Management
        </button>
      </div>

      {/* Safe Info */}
      {safeInfo && (
        <div className="safe-info">
          <h3>Safe Information</h3>
          <p>
            <strong>Address:</strong> {safeInfo.address}
          </p>
          <p>
            <strong>Balance:</strong> {safeInfo.balance} ETH
          </p>
          <p>
            <strong>Threshold:</strong> {safeInfo.threshold} of{" "}
            {safeInfo.owners.length}
          </p>
          <p>
            <strong>Nonce:</strong> {safeInfo.nonce}
          </p>
          <details>
            <summary>Owners ({safeInfo.owners.length})</summary>
            <ul>
              {safeInfo.owners.map((owner: string) => (
                <li key={owner}>
                  {owner}
                  {owner.toLowerCase() === userAddress.toLowerCase() &&
                    " (You)"}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "transactions" && (
        <>
          {/* Propose Transaction Form */}
          <div className="propose-transaction">
        <h3>Propose New Transaction</h3>
        <form onSubmit={handleProposeTransaction}>
          <div>
            <label>To Address:</label>
            <input
              type="text"
              value={txForm.to}
              onChange={(e) => setTxForm({ ...txForm, to: e.target.value })}
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label>Value (in wei):</label>
            <input
              type="text"
              value={txForm.value}
              onChange={(e) => setTxForm({ ...txForm, value: e.target.value })}
              placeholder="0"
              required
            />
          </div>
          <div>
            <label>Data (hex):</label>
            <input
              type="text"
              value={txForm.data}
              onChange={(e) => setTxForm({ ...txForm, data: e.target.value })}
              placeholder="0x"
              required
            />
          </div>
          <div>
            <label>Operation:</label>
            <select
              value={txForm.operation}
              onChange={(e) =>
                setTxForm({
                  ...txForm,
                  operation: Number(e.target.value) as 0 | 1,
                })
              }
            >
              <option value={0}>Call</option>
              <option value={1}>DelegateCall</option>
            </select>
          </div>
          <button type="submit" disabled={loading}>
            Propose Transaction
          </button>
        </form>
      </div>

      {/* Pending Transactions */}
      <div className="pending-transactions">
        <h3>Pending Transactions ({pendingTxs.length})</h3>
        {pendingTxs.length === 0 ? (
          <p>No pending transactions</p>
        ) : (
          <div className="transactions-list">
            {pendingTxs.map((tx) => (
              <div key={tx.safeTxHash} className="transaction-card">
                <p>
                  <strong>Safe TX Hash:</strong>{" "}
                  {tx.safeTxHash.substring(0, 20)}...
                </p>
                <p>
                  <strong>To:</strong> {tx.to}
                </p>
                <p>
                  <strong>Value:</strong> {tx.value} wei
                </p>
                <p>
                  <strong>Confirmations:</strong> {tx.confirmations.length} /{" "}
                  {tx.confirmationsRequired}
                </p>
                <div className="transaction-actions">
                  {!hasUserConfirmed(tx) && (
                    <button
                      onClick={() => handleConfirmTransaction(tx.safeTxHash)}
                      disabled={loading}
                    >
                      Confirm
                    </button>
                  )}
                  {tx.confirmations.length >= tx.confirmationsRequired && (
                    <button
                      onClick={() => handleExecuteTransaction(tx.safeTxHash)}
                      disabled={loading}
                    >
                      Execute
                    </button>
                  )}
                  {hasUserConfirmed(tx) && (
                    <span className="confirmed-badge">✓ You confirmed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="transaction-history">
        <h3>Transaction History ({history.length})</h3>
        {history.length === 0 ? (
          <p>No transaction history</p>
        ) : (
          <div className="transactions-list">
            {history.slice(0, 10).map((tx) => (
              <div key={tx.safeTxHash} className="transaction-card">
                <p>
                  <strong>Safe TX Hash:</strong>{" "}
                  {tx.safeTxHash.substring(0, 20)}...
                </p>
                <p>
                  <strong>To:</strong> {tx.to}
                </p>
                <p>
                  <strong>Value:</strong> {tx.value} wei
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {tx.isExecuted ? "✓ Executed" : "Pending"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* CCIP Tab Content */}
      {activeTab === "ccip" && (
        <CCIPTransfer
          safeAddress={safeAddress}
          provider={provider}
          userAddress={userAddress}
          onSuccess={loadSafeData}
        />
      )}

      {/* Owner Management Tab Content */}
      {activeTab === "owners" && (
      <div className="owner-management">
        <h3>Owner Management</h3>

        {/* Add Owner */}
        <form onSubmit={handleAddOwner}>
          <h4>Add Owner</h4>
          <div>
            <label>New Owner Address:</label>
            <input
              type="text"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label>New Threshold:</label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(Number(e.target.value))}
              min={1}
              max={(safeInfo?.owners.length ?? 0) + 1}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            Propose Add Owner
          </button>
        </form>

        {/* Remove Owner */}
        <form onSubmit={handleRemoveOwner}>
          <h4>Remove Owner</h4>
          <div>
            <label>Owner to Remove:</label>
            <select
              value={ownerToRemove}
              onChange={(e) => setOwnerToRemove(e.target.value)}
              required
            >
              <option value="">Select owner...</option>
              {safeInfo?.owners.map((owner: string) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>New Threshold:</label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(Number(e.target.value))}
              min={1}
              max={Math.max((safeInfo?.owners.length ?? 1) - 1, 1)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            Propose Remove Owner
          </button>
        </form>

        {/* Change Threshold */}
        <form onSubmit={handleChangeThreshold}>
          <h4>Change Threshold</h4>
          <div>
            <label>New Threshold:</label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(Number(e.target.value))}
              min={1}
              max={safeInfo?.owners.length || 1}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            Propose Change Threshold
          </button>
        </form>
      </div>
      )}

      <style>{`
        .safe-transactions {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid var(--border-light);
          padding-bottom: 0.5rem;
        }

        .tab-button {
          display: flex;
          align-items: center;
          padding: 0.625rem 1.25rem;
          background-color: transparent;
          color: var(--text-secondary);
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
          border-radius: 8px 8px 0 0;
        }

        .tab-button.active {
          color: var(--primary-color);
          border-bottom-color: var(--primary-color);
          font-weight: 600;
        }

        .safe-info {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .safe-info details {
          margin-top: 10px;
        }

        .safe-info ul {
          list-style: none;
          padding: 0;
        }

        .safe-info li {
          padding: 5px 0;
          font-family: monospace;
          font-size: 12px;
        }

        .propose-transaction,
        .pending-transactions,
        .transaction-history,
        .owner-management {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-bottom: 20px;
        }

        form div {
          display: flex;
          flex-direction: column;
        }

        label {
          font-weight: bold;
          margin-bottom: 5px;
        }

        input,
        select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        button {
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        button:hover:not(:disabled) {
          background: #0056b3;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .transactions-list {
          display: grid;
          gap: 15px;
        }

        .transaction-card {
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 8px;
          background: #fafafa;
        }

        .transaction-card p {
          margin: 5px 0;
          font-size: 14px;
        }

        .transaction-actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          align-items: center;
        }

        .confirmed-badge {
          color: green;
          font-weight: bold;
        }

        .error {
          background: #fee;
          color: #c00;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          font-size: 18px;
        }

        h2 {
          margin-bottom: 20px;
        }

        h3 {
          margin-bottom: 15px;
          color: #333;
        }

        h4 {
          margin-top: 20px;
          margin-bottom: 10px;
          color: #555;
        }
      `}</style>
    </div>
  );
}
