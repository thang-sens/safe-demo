import React, { useState } from "react";
import { getCompanySafe } from "../lib/api";
import {
  proposeTransaction,
  confirmTransaction,
  executeTransaction,
} from "../lib/safeFlow";

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
    if (safeInfo) {
      proposeTransaction(safeInfo.safeAddress, {
        to: "0x...",
        value: "0",
        data: "0x",
      });
    }
  };

  const handleConfirm = () => {
    if (safeInfo) {
      confirmTransaction(safeInfo.safeAddress, "txHash");
    }
  };

  const handleExecute = () => {
    if (safeInfo) {
      executeTransaction(safeInfo.safeAddress, "txHash");
    }
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
