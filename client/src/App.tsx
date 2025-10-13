import { useState } from "react";
import Login from "./components/Login";
import CreateCompany from "./components/CreateCompany";
import CompanyDashboard from "./components/CompanyDashboard";
import "./App.css";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<"create" | "dashboard">("create");

  return (
    <div className="App">
      <h1>Safe Multisig Management</h1>

      {!loggedIn ? (
        <Login onLogin={() => setLoggedIn(true)} />
      ) : (
        <div>
          {/* Navigation */}
          <div
            style={{
              marginBottom: "20px",
              borderBottom: "2px solid #ddd",
              paddingBottom: "10px",
            }}
          >
            <button
              onClick={() => setView("create")}
              style={{
                padding: "10px 20px",
                marginRight: "10px",
                background: view === "create" ? "#4CAF50" : "#ddd",
                color: view === "create" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Create Company
            </button>
            <button
              onClick={() => setView("dashboard")}
              style={{
                padding: "10px 20px",
                background: view === "dashboard" ? "#4CAF50" : "#ddd",
                color: view === "dashboard" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Company Dashboard
            </button>
          </div>

          {/* Content */}
          {view === "create" ? (
            <CreateCompany
              onSuccess={(company) => {
                console.log("Company created:", company);
                // Optionally switch to dashboard view
                // setView("dashboard");
              }}
            />
          ) : (
            <CompanyDashboard />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
