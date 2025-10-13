import React, { useState } from "react";
import { getCompanySafe } from "../lib/api";

interface SafeInfo {
  safeAddress: string;
  owners: string[];
  threshold: number;
}

const CompanyDashboard: React.FC = () => {
  const [companyId, setCompanyId] = useState("");
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);

  const handleGetSafe = async () => {
    try {
      const info = await getCompanySafe(companyId);
      setSafeInfo(info);
    } catch (error) {
      console.error("Failed to get safe", error);
    }
  };

  const handlePropose = () => {
    // TODO: Implement with provider
    // Use SafeTransactions component instead
    console.log("Use SafeTransactions component for transaction management");
  };

  const handleConfirm = () => {
    // TODO: Implement with provider
    // Use SafeTransactions component instead
    console.log("Use SafeTransactions component for transaction management");
  };

  const handleExecute = () => {
    // TODO: Implement with provider
    // Use SafeTransactions component instead
    console.log("Use SafeTransactions component for transaction management");
  };

  return (
    <div>
      <h2>Company Dashboard</h2>
      <input
        type="text"
        placeholder="Company ID"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
      />
      <button onClick={handleGetSafe}>Get Safe Info</button>
      {safeInfo && (
        <div>
          <p>Safe Address: {safeInfo.safeAddress}</p>
          <p>Owners: {safeInfo.owners.join(", ")}</p>
          <p>Threshold: {safeInfo.threshold}</p>
          <button onClick={handlePropose}>Propose Transaction</button>
          <button onClick={handleConfirm}>Confirm Transaction</button>
          <button onClick={handleExecute}>Execute Transaction</button>
        </div>
      )}
    </div>
  );
};

export default CompanyDashboard;
